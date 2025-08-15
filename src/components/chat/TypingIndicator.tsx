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
      const shortName = names[0].length > 12 ? names[0].substring(0, 12) + '...' : names[0];
      return `${shortName} typing...`;
    } else if (names.length === 2) {
      const name1 = names[0].length > 8 ? names[0].substring(0, 8) + '...' : names[0];
      const name2 = names[1].length > 8 ? names[1].substring(0, 8) + '...' : names[1];
      return `${name1} & ${name2} typing...`;
    } else {
      return `${names.length} people typing...`;
    }
  };

  return (
    <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2">
      <div className="flex gap-0.5 xs:gap-1">
        <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-2 sm:h-2 bg-primary/60 rounded-full animate-bounce" 
             style={{ animationDelay: '0ms', animationDuration: '1s' }} />
        <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-2 sm:h-2 bg-primary/50 rounded-full animate-bounce" 
             style={{ animationDelay: '150ms', animationDuration: '1s' }} />
        <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-2 sm:h-2 bg-primary/40 rounded-full animate-bounce" 
             style={{ animationDelay: '300ms', animationDuration: '1s' }} />
      </div>
      
      <p className="text-xs xs:text-xs sm:text-sm text-muted-foreground italic font-medium">
        <span className="hidden sm:inline">{getTypingText()}</span>
        <span className="sm:hidden">{getMobileTypingText()}</span>
      </p>
    </div>
  );
}