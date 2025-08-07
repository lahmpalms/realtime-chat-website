'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClickOutside: () => void;
}

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
  '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
  '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
  '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
  '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
  '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
  '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋',
  '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️',
  '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
  '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜',
  '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
  '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
  '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
  '👅', '👄', '💋', '🩸', '👶', '🧒', '👦', '👧',
];

export function EmojiPicker({ onEmojiSelect, onClickOutside }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClickOutside]);

  return (
    <Card ref={containerRef} className="p-2 sm:p-4 w-72 sm:w-80 max-h-48 sm:max-h-64 overflow-y-auto">
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 sm:gap-2">
        {COMMON_EMOJIS.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            className="text-base sm:text-lg hover:bg-muted rounded p-1.5 sm:p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-ring min-w-8 min-h-8 flex items-center justify-center"
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