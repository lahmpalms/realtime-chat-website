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
      <Alert className="text-xs sm:text-sm border-l-4 border-l-blue-500 bg-blue-50/10 animate-pulse">
        <Loader2 className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 animate-spin text-blue-500" />
        <AlertDescription className="font-medium">
          <span className="hidden xs:inline">Connecting to chat...</span>
          <span className="xs:hidden">Connecting...</span>
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="text-xs sm:text-sm border-l-4 border-l-red-500 bg-red-50/10">
        <AlertCircle className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 animate-pulse text-red-500" />
        <AlertDescription className="font-medium">
          <span className="hidden sm:inline">{error}</span>
          <span className="sm:hidden">Connection error</span>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isConnected) {
    return (
      <Alert variant="destructive" className="text-xs sm:text-sm border-l-4 border-l-orange-500 bg-orange-50/10">
        <AlertCircle className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 animate-pulse text-orange-500" />
        <AlertDescription className="font-medium">
          <span className="hidden sm:inline">Disconnected from chat. Trying to reconnect...</span>
          <span className="hidden xs:inline sm:hidden">Disconnected. Reconnecting...</span>
          <span className="xs:hidden">Reconnecting...</span>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}