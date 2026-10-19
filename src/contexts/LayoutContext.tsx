'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Keep the header and composer inside the visible viewport, including when a mobile keyboard opens.
export function LayoutWrapper({ children, className = '' }: { children: ReactNode; className?: string }) {
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      if (!shell.current) return;
      shell.current.style.height = `${viewport.height}px`;
      shell.current.style.top = `${viewport.offsetTop}px`;
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); };
  }, []);
  return <div ref={shell} className={`fixed inset-x-0 top-0 flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-background ${className}`}>{children}</div>;
}
