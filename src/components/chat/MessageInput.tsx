'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { EmojiPicker } from './EmojiPicker';
import { database } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import { MAX_MESSAGE_LENGTH, Message } from '@/lib/types';

interface Draft { text: string; requestId: string | null }
interface MessageInputProps {
  userId: string;
  onSendMessage: (text: string, requestId: string) => Promise<Message>;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}
export function MessageInput({ userId, onSendMessage, onTyping, onStopTyping, disabled = false }: MessageInputProps) {
  const [draft, setDraft] = useState<Draft>({ text: '', requestId: null });
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inFlight = useRef(false);
  const serverOffset = useRef(0);
  useEffect(() => {
    if (database) return onValue(ref(database, '.info/serverTimeOffset'), snapshot => { serverOffset.current = Number(snapshot.val()) || 0; });
  }, []);
  const mounted = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const key = `chat-draft:${userId}`;
  const persist = (next: Draft) => {
    try { if (next.text) sessionStorage.setItem(key, JSON.stringify(next)); else sessionStorage.removeItem(key); } catch { /* Keep draft in memory if storage is unavailable. */ }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (typeof saved?.text === 'string' && saved.text.length <= MAX_MESSAGE_LENGTH) {
        setDraft({ text: saved.text, requestId: typeof saved.requestId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(saved.requestId) ? saved.requestId : null });
      }
    } catch { /* Ignore malformed local drafts. */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = 'auto';
      input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`;
    }
  }, [draft.text, loaded]);
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));

  const change = (text: string) => {
    if (text.length > MAX_MESSAGE_LENGTH || inFlight.current) return;
    const next = { text, requestId: text.trim() === draft.text.trim() ? draft.requestId : null };
    setDraft(next);
    persist(next);
    setError('');
    if (text.trim()) onTyping(); else onStopTyping();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loaded || inFlight.current || disabled || wait || !draft.text.trim()) return;
    inFlight.current = true;
    const pending = { ...draft, requestId: draft.requestId || `${Math.round(Date.now() + serverOffset.current)}_${crypto.randomUUID()}` };
    setDraft(pending);
    persist(pending); // Persist before the network request, including reloads during an uncertain send.
    setSending(true);
    setError('');
    onStopTyping();
    try {
      await onSendMessage(pending.text.trim(), pending.requestId);
      if (!mounted.current) return;
      const empty = { text: '', requestId: null };
      setDraft(empty);
      persist(empty);
      setRetryAt(0);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error ? failure.message : 'Could not confirm delivery. Your draft is saved.');
      if (failure && typeof failure === 'object' && 'details' in failure && failure.details && typeof failure.details === 'object' &&
          'retryAfterMs' in failure.details && typeof failure.details.retryAfterMs === 'number') {
        const current = Date.now();
        setNow(current);
        setRetryAt(current + Math.max(0, Math.min(60_000, failure.details.retryAfterMs)));
      }
    } finally { inFlight.current = false; if (mounted.current) setSending(false); }
  };

  return (
    <div className="border-t border-border bg-background/95 p-3 sm:p-4">
      <form onSubmit={submit} className="flex items-end gap-2" aria-label="Send a message">
        <div className="flex-1 relative">
          <textarea ref={input} aria-label="Message" aria-describedby={`composer-help${error ? ' send-error' : ''}`} aria-invalid={!!error}
            placeholder={disabled ? 'Reconnecting — draft is saved' : 'Type your message...'}
            value={draft.text} onChange={event => change(event.target.value)} disabled={!loaded} readOnly={sending} aria-busy={sending}
            rows={1} maxLength={MAX_MESSAGE_LENGTH} dir="auto"
            className="block min-h-11 max-h-[min(160px,30dvh)] w-full resize-none rounded-lg border border-input bg-background py-2.5 pl-3 pr-12 text-base leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            onKeyDown={event => {
              if (event.key !== 'Enter') return;
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) { event.preventDefault(); return; }
              if (!event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
            }} />
          <Dialog open={emojiOpen} onOpenChange={setEmojiOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 bottom-0 h-11 w-11"
                disabled={sending || !loaded} aria-label="Open emoji picker"><Smile aria-hidden="true" className="h-5 w-5" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
              <DialogTitle>Choose an emoji</DialogTitle>
              <DialogDescription>Select an emoji to add to your message.</DialogDescription>
              <EmojiPicker onEmojiSelect={emoji => { change(draft.text + emoji); setEmojiOpen(false); }} />
            </DialogContent>
          </Dialog>
        </div>
        <Button type="submit" className="h-11 min-w-11" disabled={!loaded || disabled || sending || !draft.text.trim() || wait > 0}
          aria-label={draft.requestId ? 'Retry message' : 'Send message'}>
          <Send aria-hidden="true" className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{sending ? 'Sending…' : draft.requestId ? 'Retry' : 'Send'}</span>
        </Button>
      </form>
      <div id="composer-help" className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
        <span role="status">{sending ? 'Sending…' : wait ? `Retry in ${wait}s` : disabled ? 'Offline or reconnecting. You can keep writing.' : <><span>Enter to send</span><span className="hidden sm:inline"> · Shift+Enter for a new line</span></>}</span>
        <span>{draft.text.length}/{MAX_MESSAGE_LENGTH}</span>
      </div>
      {error && <p id="send-error" role="alert" className="mt-2 text-sm text-destructive">{error} Your draft is saved.</p>}
    </div>
  );
}
