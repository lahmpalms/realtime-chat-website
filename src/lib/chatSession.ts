'use client';

import { Database, onValue, onDisconnect, ref, remove, update, serverTimestamp, goOffline, goOnline } from 'firebase/database';
import { Functions, httpsCallable } from 'firebase/functions';
import { SESSION_LEASE_MS as LEASE_MS, SESSION_HEARTBEAT_MS as HEARTBEAT_MS, type Message, type User } from './types';
export type SessionStatus = 'idle' | 'connecting' | 'ready' | 'offline' | 'error';
export interface SessionSnapshot { status: SessionStatus; user: User | null; error: string | null }
interface Attempt { id: string; busy: boolean; registered: boolean }

// One controller per tab. Every physical reconnection gets a new ID so a delayed
// disconnect or HTTP response cannot remove/restore a replacement connection.
export class ChatSession {
  private stopped = false;
  private connected = false;
  private attempt: Attempt | null = null;
  private unsubscribe: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAck = 0;
  private user: User | null = null;
  private ready = false;
  private typing = false;
  private lastTypingWrite = 0;
  private firstResolve: ((user: User) => void) | null = null;
  private firstReject: ((error: Error) => void) | null = null;

  constructor(private database: Database, private functions: Functions, private uid: string,
    private name: string, private changed: (snapshot: SessionSnapshot) => void) {}

  async start(): Promise<User> {
    const first = new Promise<User>((resolve, reject) => { this.firstResolve = resolve; this.firstReject = reject; });
    window.addEventListener('offline', this.offline);
    window.addEventListener('online', this.online);
    if (navigator.onLine) goOnline(this.database); else goOffline(this.database);
    this.unsubscribe = onValue(ref(this.database, '.info/connected'), snapshot => {
      const wasConnected = this.connected;
      this.connected = snapshot.val() === true;
      if (!this.connected) {
        this.ready = false;
        this.typing = false;
        const previous = this.attempt;
        this.attempt = null;
        if (previous) void this.release(previous.id);
        this.publish('offline');
      } else {
        if (wasConnected && this.attempt) return;
        this.attempt = { id: crypto.randomUUID(), busy: false, registered: false };
        void this.sync();
      }
    });
    this.heartbeat = setInterval(() => { void this.sync(); }, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    const timeout = setTimeout(() => this.firstReject?.(new Error('Could not connect. Please try again.')), 20_000);
    try { return await first; } finally { clearTimeout(timeout); this.firstResolve = null; this.firstReject = null; }
  }

  private publish(status: SessionStatus, error: string | null = null) {
    if (!this.stopped) this.changed({ status, user: this.user, error });
  }
  private path(id: string) { return `chatRoom/users/${this.uid}/connections/${id}`; }
  private current(attempt: Attempt) { return !this.stopped && this.connected && this.attempt === attempt; }
  private async release(id: string) {
    // A queued removal is safe: this ID is never reused by a replacement connection.
    void remove(ref(this.database, this.path(id))).catch(() => {});
    try {
      await httpsCallable(this.functions, 'leaveRoom', { timeout: 5000 })({ connectionId: id });
    } catch { /* onDisconnect and lease expiry are the fallback when offline. */ }
  }

  private async sync() {
    const attempt = this.attempt;
    if (this.stopped || !this.connected || !attempt || attempt.busy) return;
    attempt.busy = true;
    if (!this.ready) this.publish('connecting');
    try {
      if (!attempt.registered) {
        await onDisconnect(ref(this.database, this.path(attempt.id))).remove();
        attempt.registered = true;
      }
      if (!this.current(attempt)) return;
      const join = httpsCallable<{ name: string; connectionId: string }, User>(this.functions, 'joinRoom', { timeout: 10_000 });
      const { data: user } = await join({ name: this.name, connectionId: attempt.id });
      if (!this.current(attempt)) { void this.release(attempt.id); return; }
      this.user = user;
      this.lastAck = performance.now();
      this.ready = true;
      if (this.expiry) clearTimeout(this.expiry);
      this.expiry = setTimeout(() => this.reconnect(), LEASE_MS - 15_000);
      this.publish('ready');
      this.firstResolve?.(user);
      if (this.retry) clearTimeout(this.retry);
      this.writeActivity({ state: document.hidden ? 'away' : 'online' });
    } catch (error) {
      if (!this.current(attempt)) { void this.release(attempt.id); return; }
      if (typeof error === 'object' && error && 'details' in error && error.details && typeof error.details === 'object' &&
          'reason' in error.details && error.details.reason === 'connection-closed') {
        this.ready = false;
        this.attempt = { id: crypto.randomUUID(), busy: false, registered: false };
        this.retry = setTimeout(() => { void this.sync(); }, 0);
        return;
      }
      this.ready = false;
      this.publish('error', error instanceof Error ? error.message : 'Unable to reconnect');
      this.firstReject?.(error instanceof Error ? error : new Error('Unable to join room'));
      if (this.retry) clearTimeout(this.retry);
      this.retry = setTimeout(() => { void this.sync(); }, 5000);
    } finally { attempt.busy = false; }
  }

  reconnect = () => {
    if (this.stopped) return;
    if (!this.connected) { if (navigator.onLine) goOnline(this.database); return; }
    if (this.attempt?.busy) return;
    this.ready = false;
    void this.sync();
  };

  private offline = () => { this.ready = false; this.publish('offline'); goOffline(this.database); };
  private online = () => { if (!this.stopped) goOnline(this.database); };
  private visibilityChanged = () => {
    this.setTyping(false);
    this.writeActivity({ state: document.hidden ? 'away' : 'online' });
    if (!document.hidden) void this.sync();
  };
  private writeActivity(patch: Record<string, unknown>) {
    const attempt = this.attempt;
    if (!attempt || !this.ready || !this.current(attempt)) return;
    void update(ref(this.database, this.path(attempt.id)), { ...patch, typingAt: serverTimestamp() }).catch(() => {
      if (this.current(attempt)) this.reconnect();
    });
  }
  setTyping = (typing: boolean) => {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.typing !== typing || (typing && performance.now() - this.lastTypingWrite > 1000)) {
      this.lastTypingWrite = performance.now();
      this.typing = typing;
      this.writeActivity({ isTyping: typing });
    }
    if (typing) this.typingTimer = setTimeout(() => this.setTyping(false), 2500);
  };

  async send(text: string, requestId: string): Promise<Message> {
    if (!this.ready || !this.connected || !this.attempt || performance.now() - this.lastAck > LEASE_MS - 15_000) {
      this.reconnect();
      throw new Error('Reconnecting. Your draft is saved; retry when connected.');
    }
    const connectionId = this.attempt.id;
    const send = httpsCallable<{ text: string; requestId: string; connectionId: string }, Message>(this.functions, 'sendMessage', { timeout: 10_000 });
    try { return (await send({ text, requestId, connectionId })).data; }
    catch (error) {
      if (typeof error === 'object' && error && 'details' in error && error.details && typeof error.details === 'object' &&
          'reason' in error.details && error.details.reason === 'session-expired') this.reconnect();
      throw error;
    }
  }

  stop = () => {
    if (this.stopped) return;
    const attempt = this.attempt;
    this.stopped = true;
    this.ready = false;
    this.attempt = null;
    this.unsubscribe?.();
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.retry) clearTimeout(this.retry);
    if (this.expiry) clearTimeout(this.expiry);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('offline', this.offline);
    window.removeEventListener('online', this.online);
    this.firstReject?.(new Error('Session closed'));
    if (attempt) void this.release(attempt.id);
  };
}
