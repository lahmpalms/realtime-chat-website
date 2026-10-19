'use client';

import { MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  userCount: number;
  isConnected: boolean;
  currentUserName?: string;
  onLeave: () => void;
}
export function Header({ userCount, isConnected, currentUserName, onLeave }: HeaderProps) {
  return (
    <header className="shrink-0 border-b bg-background px-3 sm:px-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">Skip to conversation</a>
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-2 py-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold sm:text-lg"><MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" />Real-time Chat</h1>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {isConnected ? <Wifi aria-hidden="true" className="h-3 w-3" /> : <WifiOff aria-hidden="true" className="h-3 w-3" />}
            <span>{isConnected ? `${userCount} online` : 'Reconnecting…'}</span>
            <span className="hidden sm:inline truncate" dir="auto"> · {currentUserName}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button variant="outline" onClick={onLeave} className="h-11 min-w-11 px-3">Leave</Button>
        </div>
      </div>
    </header>
  );
}
