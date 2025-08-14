'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  error?: string | null;
}

export function ConnectionStatus({ isConnected, isLoading, error }: ConnectionStatusProps) {
  // Prefer explicit connection error messaging first
  if (isLoading) {
    return (
      <Alert className="text-xs sm:text-sm">
        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
        <AlertDescription>
          Connecting to chat...
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="text-xs sm:text-sm">
        <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!isConnected) {
    return (
      <Alert variant="destructive" className="text-xs sm:text-sm">
        <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
        <AlertDescription>
          <span className="hidden sm:inline">Disconnected from chat. Trying to reconnect...</span>
          <span className="sm:hidden">Disconnected. Reconnecting...</span>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}