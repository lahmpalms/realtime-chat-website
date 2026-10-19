'use client';
import { TypingStatus } from '@/lib/types';
export function TypingIndicator({ typing }: { typing: TypingStatus[] }) {
  if (!typing.length) return null;
  const names = typing.map(person => person.userName);
  return <p role="status" className="px-2 py-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
    {names.length > 2 ? `${names.length} people are typing…` : `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} typing…`}
  </p>;
}
