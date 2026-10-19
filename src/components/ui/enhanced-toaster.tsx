'use client';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

// A single live region prevents duplicate toast announcements.
export function EnhancedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-center" theme={resolvedTheme === 'dark' ? 'dark' : 'light'} richColors closeButton
    toastOptions={{ style: { maxWidth: 'calc(100vw - 2rem)' } }} />;
}
