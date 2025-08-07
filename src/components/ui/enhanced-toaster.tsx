'use client';

import { Toaster } from 'sonner';

interface EnhancedToasterProps {
  className?: string;
}

export function EnhancedToaster({ className }: EnhancedToasterProps) {
  return (
    <>
      {/* Desktop Toaster - Top Right */}
      <Toaster
        position="top-right"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          style: {
            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
            maxWidth: '420px',
            minWidth: '356px',
          },
          className: 'toast-custom-desktop',
          duration: 5000, // Longer for desktop users
        }}
        className="hidden md:block"
      />

      {/* Mobile Toaster - Top Center */}
      <Toaster
        position="top-center"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          style: {
            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
            maxWidth: 'calc(100vw - 2rem)',
            margin: '0 1rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          },
          className: 'toast-custom-mobile',
          duration: 6000, // Longer for mobile users
        }}
        className="block md:hidden"
      />
    </>
  );
}

// CSS for enhanced toast styling
export const toastStyles = `
  /* Mobile-first toast styling */
  .toast-custom-mobile {
    /* Mobile positioning */
    max-width: calc(100vw - 2rem);
    margin: 0 1rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      border: 2px solid currentColor;
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transition: none;
    }
  }
  
  /* Desktop toast styling */
  .toast-custom-desktop {
    min-width: 356px;
    max-width: 420px;
    border-radius: 8px;
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      border: 2px solid currentColor;
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transition: none;
    }
  }
  
  /* Enhanced focus styles for accessibility */
  .toast-custom-mobile button,
  .toast-custom-desktop button {
    @apply focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2;
  }
  
  /* Better touch targets on mobile */
  .toast-custom-mobile button {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Improved text contrast */
  .toast-custom-mobile,
  .toast-custom-desktop {
    @apply text-foreground;
  }
  
  /* Dark mode optimizations */
  .dark .toast-custom-mobile,
  .dark .toast-custom-desktop {
    @apply bg-card border border-border;
  }
`;
