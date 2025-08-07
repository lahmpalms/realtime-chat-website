'use client';

import { ReactNode } from 'react';
import { useResponsive } from '@/lib/hooks/useResponsive';
import { A11Y_UTILS, PERFORMANCE } from '@/lib/responsive';
import { cn } from '@/lib/utils';

interface ResponsiveChatWrapperProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveChatWrapper({ children, className = '' }: ResponsiveChatWrapperProps) {
  const { isMobile, isTablet, orientation, prefersReducedMotion } = useResponsive();

  return (
    <div 
      className={cn(
        'flex h-full w-full bg-background',
        'transition-all duration-300 ease-in-out',
        isMobile ? 'flex-col' : 'flex-row',
        PERFORMANCE.contain,
        prefersReducedMotion && A11Y_UTILS.reducedMotion,
        className
      )}
      role="main"
      aria-label="Chat application"
      data-responsive="chat-wrapper"
      data-breakpoint={isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}
      data-orientation={orientation}
    >
      {children}
    </div>
  );
}

// Enhanced responsive container for chat content
export function ResponsiveChatContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { prefersReducedMotion } = useResponsive();

  return (
    <section 
      className={cn(
        'flex flex-col min-w-0 min-h-0 h-full flex-1',
        'transition-all duration-300 ease-in-out',
        PERFORMANCE.contain,
        prefersReducedMotion && A11Y_UTILS.reducedMotion,
        className
      )}
      aria-label="Chat messages and input"
      data-responsive="chat-content"
    >
      {children}
    </section>
  );
}

// Enhanced responsive sidebar container
export function ResponsiveSidebar({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isMobile, isTablet, prefersReducedMotion } = useResponsive();

  if (isMobile) {
    return null; // Mobile sidebar is handled by Sheet component
  }

  return (
    <aside 
      className={cn(
        'border-l border-border bg-card/50 backdrop-blur-sm',
        'transition-all duration-300 ease-in-out',
        isTablet ? 'w-80' : 'w-96 xl:w-[420px] 2xl:w-[480px]',
        PERFORMANCE.contain,
        prefersReducedMotion && A11Y_UTILS.reducedMotion,
        className
      )}
      aria-label="Online users list"
      role="complementary"
      data-responsive="chat-sidebar"
    >
      {children}
    </aside>
  );
}

// Enhanced responsive message container with virtualization support
export function ResponsiveMessageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isMobile, prefersReducedMotion } = useResponsive();

  return (
    <div 
      className={cn(
        'flex-1 min-h-0 relative',
        'overflow-y-auto overscroll-contain',
        PERFORMANCE.scroll,
        isMobile ? 'p-3 sm:p-4' : 'p-4 lg:p-6',
        'focus:outline-none',
        className
      )}
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-atomic="false"
      tabIndex={0}
      data-responsive="message-container"
      style={{ 
        height: '100%',
        maxHeight: '100%',
        scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth'
      }}
    >
      <div className="space-y-3 sm:space-y-4">
        {children}
      </div>
    </div>
  );
}

// Enhanced responsive input container
export function ResponsiveInputContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isMobile, prefersReducedMotion } = useResponsive();

  return (
    <div 
      className={cn(
        'border-t border-border bg-background/95 backdrop-blur-sm',
        'flex-shrink-0 transition-all duration-200',
        isMobile ? 'p-3 sm:p-4' : 'p-4 lg:p-6',
        'safe-area-inset-bottom',
        PERFORMANCE.contain,
        prefersReducedMotion && A11Y_UTILS.reducedMotion,
        className
      )}
      role="region"
      aria-label="Message input"
      data-responsive="input-container"
    >
      {children}
    </div>
  );
}

// Enhanced responsive status container
export function ResponsiveStatusContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isMobile, prefersReducedMotion } = useResponsive();

  return (
    <div 
      className={cn(
        'border-b border-border bg-muted/50 flex-shrink-0',
        'transition-all duration-200',
        isMobile ? 'p-3 sm:p-4' : 'p-4 lg:p-6',
        prefersReducedMotion && A11Y_UTILS.reducedMotion,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Connection status"
      data-responsive="status-container"
    >
      {children}
    </div>
  );
}
