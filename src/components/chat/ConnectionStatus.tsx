'use client';

import { Button } from '@/components/ui/button';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}
export function ConnectionStatus({ isConnected, isLoading, error, onRetry }: ConnectionStatusProps) {
  if (isConnected && !isLoading && !error) return null;
  return <div className="flex items-center justify-between gap-2">
    <p role="status" className="text-sm text-muted-foreground">
      {!isConnected ? 'Reconnecting automatically. Your draft is saved.'
        : error ? 'We couldn’t update the conversation. Try reconnecting.' : 'Loading conversation…'}
    </p>
    {(!isConnected || error) && <Button type="button" variant="outline" className="h-11 shrink-0" onClick={onRetry}>Reconnect</Button>}
  </div>;
}
