'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClickOutside: () => void;
}

const COMMON_EMOJIS = [
  // Most commonly used first
  '😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍',
  '🥰', '😘', '😋', '😎', '🤩', '🥳', '😏', '😌',
  '😆', '😅', '😂', '🤣', '😇', '🙃', '😗', '😙',
  '😚', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
  '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
  '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
  '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
  '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
  '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
  '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
  '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '❤️',
  '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
  '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
  '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜',
  '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✨', '🎉',
  '🎊', '🎈', '🎁', '🎀', '🌟', '⭐', '💫', '⚡',
  '🔥', '💯', '💢', '💥', '💦', '💨', '💤', '💢',
];

export function EmojiPicker({ onEmojiSelect, onClickOutside }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClickOutside]);

  return (
    <Card ref={containerRef} className="p-2 xs:p-3 sm:p-4 w-64 xs:w-72 sm:w-80 max-h-40 xs:max-h-48 sm:max-h-64 overflow-y-auto shadow-lg border-2 backdrop-blur-sm bg-background/95">
      <div className="grid grid-cols-6 xs:grid-cols-7 sm:grid-cols-8 gap-0.5 xs:gap-1 sm:gap-2">
        {COMMON_EMOJIS.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            className="text-sm xs:text-base sm:text-lg hover:bg-muted hover:scale-110 active:scale-95 rounded-md p-1 xs:p-1.5 sm:p-2 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-primary focus:bg-primary/10 min-w-7 min-h-7 xs:min-w-8 xs:min-h-8 sm:min-w-9 sm:min-h-9 flex items-center justify-center"
            onClick={() => onEmojiSelect(emoji)}
            type="button"
            aria-label={`Select emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </Card>
  );
}