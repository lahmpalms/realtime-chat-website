'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContainerProps = { children: ReactNode; className?: string };
export function ResponsiveChatWrapper({ children, className }: ContainerProps) {
  return <div className={cn('flex h-full min-h-0 min-w-0 bg-muted/30 sm:p-3', className)}>{children}</div>;
}
export function ResponsiveChatContent({ children, className }: ContainerProps) {
  return <section aria-label="Chat messages and input" className={cn('mx-auto flex min-h-0 min-w-0 w-full max-w-5xl flex-col overflow-hidden bg-background sm:rounded-xl sm:border', className)}>{children}</section>;
}
export function ResponsiveMessageContainer({ children, className }: ContainerProps) {
  return <div className={cn('relative min-h-0 flex-1', className)}>{children}</div>;
}
export function ResponsiveInputContainer({ children, className }: ContainerProps) {
  return <div className={cn('shrink-0', className)} style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>{children}</div>;
}
export function ResponsiveStatusContainer({ children, className }: ContainerProps) {
  return <div className={cn('shrink-0 border-b bg-muted/40 px-3 py-2', className)}>{children}</div>;
}
