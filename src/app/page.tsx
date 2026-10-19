'use client';

import { useEffect, useState } from 'react';
import NameInputForm from '@/components/forms/NameInputForm';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Header } from '@/components/layout/Header';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LayoutWrapper } from '@/contexts/LayoutContext';
import { useChat } from '@/lib/hooks/useChat';
import { useUser } from '@/contexts/UserContext';
import { MAX_USERS } from '@/lib/types';

export default function Home() {
  const { currentUser, hasJoined, joinChat, leaveChat, isAuthLoading, authError } = useUser();
  const { users, isConnected, resetState } = useChat();
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  useEffect(() => { if (!hasJoined) resetState(); }, [hasJoined, resetState]);
  const handleJoinChat = async (name: string) => {
    setIsJoining(true);
    setJoinError('');
    try { await joinChat(name); }
    catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      setJoinError(message.includes('full') ? `The room is full (${MAX_USERS} people). Please try again later.`
        : message.includes('tabs') || message.includes('connections') ? 'Too many active tabs. Close another chat tab and try again.'
        : 'We couldn’t join the room. Check your connection and try again.');
    } finally { setIsJoining(false); }
  };
  const handleLeave = () => { leaveChat(); resetState(); setJoinError(''); };

  if (isAuthLoading) return <main className="grid min-h-[100dvh] place-items-center p-6"><p role="status" className="text-sm text-muted-foreground">Initializing secure session…</p></main>;
  if (authError) return <main className="grid min-h-[100dvh] place-items-center p-6">
    <section aria-labelledby="session-error" className="max-w-md space-y-4">
      <h1 id="session-error" className="text-xl font-semibold">We couldn’t start your session</h1>
      <p role="alert" className="text-sm text-muted-foreground">Check your connection and try again. If the problem continues, please try again later.</p>
      <Button className="h-11" onClick={() => window.location.reload()}>Try again</Button>
    </section>
  </main>;
  if (!hasJoined || !currentUser) return <div className="relative">
    <div className="absolute right-4 top-4"><ThemeToggle /></div>
    <NameInputForm onSubmit={handleJoinChat} isLoading={isJoining} submitError={joinError} />
  </div>;
  return <LayoutWrapper>
    <Header userCount={users.length} isConnected={isConnected} currentUserName={currentUser.name} onLeave={handleLeave} />
    <main id="main-content" className="min-h-0 flex-1" tabIndex={-1} aria-label="Conversation">
      <ChatContainer currentUser={currentUser} />
    </main>
  </LayoutWrapper>;
}
