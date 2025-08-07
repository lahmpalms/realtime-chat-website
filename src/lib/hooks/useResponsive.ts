'use client';

import { useState, useEffect, useMemo } from 'react';

// Enhanced responsive breakpoint detection
interface ResponsiveBreakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
  isUltraWide: boolean;
  screenWidth: number;
  screenHeight: number;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  orientation: 'portrait' | 'landscape';
  isTouch: boolean;
  hasHover: boolean;
  prefersReducedMotion: boolean;
  isHighDPI: boolean;
}

// Global singleton for performance optimization
let globalResizeObserver: ResizeObserver | null = null;
let globalListeners: Set<(width: number, height: number) => void> = new Set();
let currentWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
let currentHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

// Initialize global resize observer
if (typeof window !== 'undefined' && !globalResizeObserver) {
  globalResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      currentWidth = width;
      currentHeight = height;
      globalListeners.forEach(callback => callback(width, height));
    }
  });
  
  // Observe the document body
  globalResizeObserver.observe(document.body);
}

export function useResponsive(): ResponsiveBreakpoints {
  const [dimensions, setDimensions] = useState({
    width: currentWidth,
    height: currentHeight
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Create optimized update function
    const updateDimensions = (width: number, height: number) => {
      setDimensions({ width, height });
    };

    // Subscribe to global resize observer
    globalListeners.add(updateDimensions);
    
    // Set initial dimensions
    updateDimensions(currentWidth, currentHeight);

    // Cleanup
    return () => {
      globalListeners.delete(updateDimensions);
    };
  }, []);

  // Memoize all computed values for performance
  const breakpointInfo = useMemo(() => {
    const { width, height } = dimensions;
    
    // Breakpoint detection based on our standard breakpoints
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    const isSmallScreen = width < 1024;
    const isLargeScreen = width >= 1024;
    const isUltraWide = width >= 1536;
    
    // Determine specific breakpoint
    let breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    if (width < 480) breakpoint = 'xs';
    else if (width < 768) breakpoint = 'sm';
    else if (width < 1024) breakpoint = 'md';
    else if (width < 1280) breakpoint = 'lg';
    else if (width < 1536) breakpoint = 'xl';
    else breakpoint = '2xl';
    
    // Device capabilities detection
    const orientation = width > height ? 'landscape' : 'portrait';
    const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
    const hasHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
    const prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isHighDPI = typeof window !== 'undefined' && window.devicePixelRatio > 1;
    
    return {
      isMobile: isMounted ? isMobile : false,
      isTablet: isMounted ? isTablet : false, 
      isDesktop: isMounted ? isDesktop : true,
      isSmallScreen: isMounted ? isSmallScreen : false,
      isLargeScreen: isMounted ? isLargeScreen : true,
      isUltraWide: isMounted ? isUltraWide : false,
      screenWidth: width,
      screenHeight: height,
      breakpoint: isMounted ? breakpoint : 'lg',
      orientation: isMounted ? orientation : 'landscape',
      isTouch: isMounted ? isTouch : false,
      hasHover: isMounted ? hasHover : true,
      prefersReducedMotion: isMounted ? prefersReducedMotion : false,
      isHighDPI: isMounted ? isHighDPI : false
    };
  }, [dimensions, isMounted]);

  return breakpointInfo;
}

// Enhanced utility functions with performance optimizations
export const responsiveUtils = {
  // Generate mobile-first responsive classes
  spacing: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `space-y-${mobile}`;
    if (tablet) classes += ` sm:space-y-${tablet}`;
    if (desktop) classes += ` lg:space-y-${desktop}`;
    return classes;
  },

  text: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `text-${mobile}`;
    if (tablet) classes += ` sm:text-${tablet}`;
    if (desktop) classes += ` lg:text-${desktop}`;
    return classes;
  },

  padding: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `p-${mobile}`;
    if (tablet) classes += ` sm:p-${tablet}`;
    if (desktop) classes += ` lg:p-${desktop}`;
    return classes;
  },

  gap: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `gap-${mobile}`;
    if (tablet) classes += ` sm:gap-${tablet}`;
    if (desktop) classes += ` lg:gap-${desktop}`;
    return classes;
  },

  width: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `w-${mobile}`;
    if (tablet) classes += ` sm:w-${tablet}`;
    if (desktop) classes += ` lg:w-${desktop}`;
    return classes;
  },

  height: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = `h-${mobile}`;
    if (tablet) classes += ` sm:h-${tablet}`;
    if (desktop) classes += ` lg:h-${desktop}`;
    return classes;
  },

  // New utilities for modern responsive design
  flexDirection: (mobile: 'row' | 'col', tablet?: 'row' | 'col', desktop?: 'row' | 'col') => {
    let classes = `flex-${mobile}`;
    if (tablet) classes += ` sm:flex-${tablet}`;
    if (desktop) classes += ` lg:flex-${desktop}`;
    return classes;
  },

  gridCols: (mobile: number, tablet?: number, desktop?: number) => {
    let classes = `grid-cols-${mobile}`;
    if (tablet) classes += ` sm:grid-cols-${tablet}`;
    if (desktop) classes += ` lg:grid-cols-${desktop}`;
    return classes;
  },

  // Touch-friendly sizing
  touchTarget: (size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizes = {
      sm: 'min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]',
      md: 'min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]',
      lg: 'min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px]'
    };
    return sizes[size];
  }
};

// Enhanced predefined responsive classes
export const responsiveClasses = {
  // Layout containers with safe areas
  container: {
    page: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 safe-area-inset-x',
    section: 'w-full py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8',
    card: 'p-4 sm:p-6 lg:p-8 rounded-lg sm:rounded-xl border border-border bg-card text-card-foreground',
    modal: 'w-full max-w-lg mx-auto p-4 sm:p-6 bg-background border border-border rounded-lg shadow-lg'
  },

  // Typography with fluid scaling
  text: {
    xs: 'text-xs leading-tight',
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-relaxed',
    xl: 'text-xl leading-tight',
    '2xl': 'text-2xl leading-tight',
    responsive: {
      small: 'text-xs sm:text-sm lg:text-base',
      medium: 'text-sm sm:text-base lg:text-lg', 
      large: 'text-base sm:text-lg lg:text-xl',
      title: 'text-lg sm:text-xl lg:text-2xl xl:text-3xl'
    }
  },

  // Touch-optimized interactive elements
  interactive: {
    button: {
      sm: 'min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-3 py-2 text-sm',
      md: 'min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] px-4 py-2 text-base',
      lg: 'min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] px-6 py-3 text-lg'
    },
    link: 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    input: 'min-h-[44px] sm:min-h-[40px] px-3 sm:px-4 py-2 text-sm sm:text-base'
  },

  // Flexible layouts
  layout: {
    flex: {
      mobile: 'flex flex-col space-y-2',
      tablet: 'flex flex-col sm:flex-row sm:space-y-0 sm:space-x-4',
      desktop: 'flex flex-col lg:flex-row lg:space-y-0 lg:space-x-6'
    },
    grid: {
      responsive: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8',
      auto: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
      cards: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
    }
  },

  // Avatar with proper sizing
  avatar: {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
    responsive: {
      sm: 'h-6 w-6 sm:h-8 sm:w-8 text-xs',
      md: 'h-8 w-8 sm:h-10 sm:w-10 text-sm',
      lg: 'h-10 w-10 sm:h-12 sm:w-12 text-base'
    }
  },

  // Spacing utilities
  spacing: {
    section: 'py-8 sm:py-12 lg:py-16',
    component: 'py-4 sm:py-6 lg:py-8', 
    element: 'py-2 sm:py-3 lg:py-4'
  }
};

// Performance-optimized media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);
  
  return isMounted ? matches : false;
}

// Accessibility preference hooks
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function usePrefersHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)');
}

export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

// Device capability hooks
export function useHasHover(): boolean {
  return useMediaQuery('(hover: hover)');
}

export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  
  return isTouch;
}
