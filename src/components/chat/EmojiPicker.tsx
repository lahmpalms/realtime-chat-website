'use client';

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

export function EmojiPicker({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  return (
    <div className="max-h-[45dvh] overflow-y-auto p-1" aria-label="Emoji choices">
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
        {COMMON_EMOJIS.map((emoji, index) => <button key={`${emoji}-${index}`} type="button"
          className="flex h-11 min-w-11 items-center justify-center rounded-lg text-xl hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => onEmojiSelect(emoji)} aria-label={`Select emoji ${emoji}`}>{emoji}</button>)}
      </div>
    </div>
  );
}
