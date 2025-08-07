'use client';

import { TypingStatus } from '@/lib/types';

interface TypingIndicatorProps {
  typing: TypingStatus[];
}

export function TypingIndicator({ typing }: TypingIndicatorProps) {
  if (typing.length === 0) return null;

  const getTypingText = (): string => {
    const names = typing.map(t => t.userName);
    
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are typing...`;
    }
  };

  const getMobileTypingText = (): string => {
    const names = typing.map(t => t.userName);
    
    if (names.length === 1) {
      return `${names[0]} typing...`;
    } else if (names.length === 2) {
      return `${names[0]} & ${names[1]} typing...`;
    } else {
      return `${names.length} people typing...`;
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/60 rounded-full animate-pulse" />
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/60 rounded-full animate-pulse delay-75" />
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/60 rounded-full animate-pulse delay-150" />
      </div>
      
      <p className="text-xs sm:text-sm text-muted-foreground italic">
        <span className="hidden sm:inline">{getTypingText()}</span>
        <span className="sm:hidden">{getMobileTypingText()}</span>
      </p>
    </div>
  );
}