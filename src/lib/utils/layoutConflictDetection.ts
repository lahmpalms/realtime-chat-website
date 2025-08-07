'use client';

import { useEffect, useRef } from 'react';

interface ConflictDetectionResult {
  hasZIndexConflicts: boolean;
  hasPositioningConflicts: boolean;
  hasStateConflicts: boolean;
  hasResponsiveConflicts: boolean;
  recommendations: string[];
}

export function useLayoutConflictDetection(): ConflictDetectionResult {
  const result = useRef<ConflictDetectionResult>({
    hasZIndexConflicts: false,
    hasPositioningConflicts: false,
    hasStateConflicts: false,
    hasResponsiveConflicts: false,
    recommendations: [],
  });

  useEffect(() => {
    // Check for z-index conflicts
    const checkZIndexConflicts = () => {
      const elements = document.querySelectorAll('[style*="z-index"], [class*="z-"]');
      const zIndexValues = new Set<number>();
      
      elements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        const zIndex = parseInt(computedStyle.zIndex);
        if (!isNaN(zIndex)) {
          if (zIndexValues.has(zIndex)) {
            result.current.hasZIndexConflicts = true;
            result.current.recommendations.push(
              `Duplicate z-index value ${zIndex} detected. Use CSS custom properties for coordination.`
            );
          }
          zIndexValues.add(zIndex);
        }
      });
    };

    // Check for positioning conflicts
    const checkPositioningConflicts = () => {
      const fixedElements = document.querySelectorAll('[style*="position: fixed"], .fixed');
      const absoluteElements = document.querySelectorAll('[style*="position: absolute"], .absolute');
      const stickyElements = document.querySelectorAll('[style*="position: sticky"], .sticky');
      
      if (fixedElements.length > 2 || absoluteElements.length > 3) {
        result.current.hasPositioningConflicts = true;
        result.current.recommendations.push(
          'Multiple positioned elements detected. Consider using CSS Grid or Flexbox for layout coordination.'
        );
      }
    };

    // Check for responsive conflicts
    const checkResponsiveConflicts = () => {
      const mobileElements = document.querySelectorAll('[data-responsive="mobile"]');
      const desktopElements = document.querySelectorAll('[data-responsive="desktop"]');
      
      if (mobileElements.length > 0 && desktopElements.length > 0) {
        // Check if they overlap
        const hasOverlap = Array.from(mobileElements).some(mobile => 
          Array.from(desktopElements).some(desktop => 
            mobile.getBoundingClientRect().intersects(desktop.getBoundingClientRect())
          )
        );
        
        if (hasOverlap) {
          result.current.hasResponsiveConflicts = true;
          result.current.recommendations.push(
            'Responsive elements overlapping detected. Use proper responsive breakpoints and conditional rendering.'
          );
        }
      }
    };

    // Run checks
    checkZIndexConflicts();
    checkPositioningConflicts();
    checkResponsiveConflicts();

    // Log results in development
    if (process.env.NODE_ENV === 'development') {
      if (result.current.hasZIndexConflicts || 
          result.current.hasPositioningConflicts || 
          result.current.hasResponsiveConflicts) {
        console.warn('Layout conflicts detected:', result.current);
      }
    }
  }, []);

  return result.current;
}

// Utility functions for conflict prevention
export const layoutConflictUtils = {
  // Validate z-index hierarchy
  validateZIndexHierarchy: (elements: HTMLElement[]): boolean => {
    const zIndexValues = elements
      .map(el => parseInt(window.getComputedStyle(el).zIndex))
      .filter(z => !isNaN(z))
      .sort((a, b) => a - b);
    
    // Check for duplicates
    for (let i = 0; i < zIndexValues.length - 1; i++) {
      if (zIndexValues[i] === zIndexValues[i + 1]) {
        return false;
      }
    }
    
    return true;
  },

  // Get recommended z-index values
  getRecommendedZIndex: (component: string): number => {
    const zIndexMap: Record<string, number> = {
      'header': 1000,
      'sidebar': 999,
      'overlay': 1001,
      'modal': 1002,
      'toast': 1003,
      'tooltip': 1004,
      'dropdown': 1005,
    };
    
    return zIndexMap[component] || 1000;
  },

  // Check for layout shift
  detectLayoutShift: (): boolean => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && (entry as any).value > 0.1) {
          console.warn('Layout shift detected:', entry);
          return true;
        }
      }
    });
    
    observer.observe({ entryTypes: ['layout-shift'] });
    return false;
  },

  // Validate responsive breakpoints
  validateResponsiveBreakpoints: (): boolean => {
    const breakpoints = [640, 768, 1024, 1280, 1536];
    const sortedBreakpoints = [...breakpoints].sort((a, b) => a - b);
    
    // Check for duplicate breakpoints
    for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
      if (sortedBreakpoints[i] === sortedBreakpoints[i + 1]) {
        return false;
      }
    }
    
    return true;
  },
};

// CSS-in-JS utilities for conflict-free styling
export const conflictFreeStyles = {
  // Systematic z-index scale
  zIndex: {
    base: 'var(--base-z-index, 1)',
    header: 'var(--header-z-index, 1000)',
    sidebar: 'var(--sidebar-z-index, 999)',
    overlay: 'var(--overlay-z-index, 1001)',
    modal: 'var(--modal-z-index, 1002)',
    toast: 'var(--toast-z-index, 1003)',
    tooltip: 'var(--tooltip-z-index, 1004)',
    dropdown: 'var(--dropdown-z-index, 1005)',
  },

  // Positioning utilities
  positioning: {
    sticky: 'position: sticky; top: 0; z-index: var(--header-z-index);',
    fixed: 'position: fixed; z-index: var(--overlay-z-index);',
    absolute: 'position: absolute; z-index: var(--base-z-index);',
  },

  // Layout utilities
  layout: {
    grid: 'display: grid; grid-template-rows: auto 1fr; min-height: 100vh;',
    flex: 'display: flex; flex-direction: column; min-height: 100vh;',
    flexRow: 'display: flex; flex-direction: row;',
  },
};

// Performance monitoring for layout conflicts
export const layoutPerformanceMonitor = {
  // Monitor for layout thrashing
  monitorLayoutThrashing: () => {
    let layoutCount = 0;
    let lastTime = performance.now();
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift') {
          layoutCount++;
          const currentTime = performance.now();
          
          if (currentTime - lastTime < 100 && layoutCount > 3) {
            console.warn('Layout thrashing detected. Consider optimizing layout calculations.');
          }
          
          lastTime = currentTime;
        }
      }
    });
    
    observer.observe({ entryTypes: ['layout-shift'] });
  },

  // Monitor for reflow
  monitorReflow: () => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.includes('layout')) {
          if (entry.duration > 16) { // > 16ms indicates potential frame drop
            console.warn('Layout performance issue detected:', entry);
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
  },
};
