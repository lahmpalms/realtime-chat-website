'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_NAME_LENGTH } from '@/lib/types';

interface NameInputFormProps {
  onSubmit: (name: string) => Promise<void> | void;
  isLoading?: boolean;
  submitError?: string;
}

export default function NameInputForm({ onSubmit, isLoading = false, submitError }: NameInputFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || isLoading) return;
    const trimmed = name.trim();
    const invalid = !trimmed ? 'Please enter your display name.'
      : trimmed.length > MAX_NAME_LENGTH ? `Use up to ${MAX_NAME_LENGTH} characters.`
      : [...trimmed].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
        ? 'Please remove control characters from your name.' : '';
    setError(invalid);
    if (invalid) { input.current?.focus(); return; }
    pending.current = true;
    try { await onSubmit(trimmed); } finally { pending.current = false; }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-muted/40 px-4 py-20" id="main-content">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="join-title">
        <h1 id="join-title" className="text-2xl font-bold">Join Chat</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">A shared room for real-time conversations. Your display name and messages are visible to everyone in the room.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-busy={isLoading}>
          <div>
            <label htmlFor="user-name" className="mb-2 block text-sm font-medium">Your display name for the chat</label>
            <input ref={input} id="user-name" value={name} maxLength={MAX_NAME_LENGTH} required
              autoComplete="nickname" spellCheck={false} disabled={isLoading}
              onChange={event => { setName(event.target.value); setError(''); }}
              onKeyDown={event => {
                if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault();
              }}
              aria-invalid={!!error} aria-describedby={`name-help name-count${error ? ' name-error' : ''}${submitError ? ' join-error' : ''}`}
              placeholder="เช่น น้องฟ้า / Alex" dir="auto"
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60" />
            <div className="mt-2 flex justify-between gap-3 text-sm text-muted-foreground">
              <p id="name-help">Thai and other languages welcome. Up to {MAX_NAME_LENGTH} characters.</p>
              <span id="name-count" className="shrink-0" aria-label={`${name.length} of ${MAX_NAME_LENGTH} characters used`}>{name.length}/{MAX_NAME_LENGTH}</span>
            </div>
          </div>
          {error && <p id="name-error" role="alert" className="text-sm text-destructive">{error}</p>}
          {submitError && <p id="join-error" role="alert" className="text-sm text-destructive">{submitError}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={isLoading}>
            {isLoading ? 'Joining chat…' : 'Join Chat Room'}
          </Button>
          <p role="status" className="text-sm text-muted-foreground">{isLoading ? 'Joining the room. Please wait…' : 'Press Enter or use the button to join.'}</p>
        </form>
      </section>
    </main>
  );
}
