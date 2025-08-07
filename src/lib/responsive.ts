/**
 * Comprehensive Responsive Design System
 * Mobile-first approach with consistent breakpoints and utilities
 */

// Standard breakpoints following modern practices
export const BREAKPOINTS = {
  xs: '320px',   // Small mobile
  sm: '480px',   // Large mobile 
  md: '768px',   // Tablet
  lg: '1024px',  // Small desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Ultra-wide
} as const;

// Responsive spacing scale (mobile-first)
export const SPACING = {
  xs: 'clamp(0.25rem, 1vw, 0.5rem)',
  sm: 'clamp(0.5rem, 2vw, 1rem)', 
  md: 'clamp(1rem, 3vw, 1.5rem)',
  lg: 'clamp(1.5rem, 4vw, 2rem)',
  xl: 'clamp(2rem, 5vw, 3rem)',
  '2xl': 'clamp(3rem, 6vw, 4rem)'
} as const;

// Fluid typography scale
export const TYPOGRAPHY = {
  xs: 'clamp(0.75rem, 2vw, 0.875rem)',
  sm: 'clamp(0.875rem, 2.5vw, 1rem)', 
  base: 'clamp(1rem, 3vw, 1.125rem)',
  lg: 'clamp(1.125rem, 3.5vw, 1.25rem)',
  xl: 'clamp(1.25rem, 4vw, 1.5rem)',
  '2xl': 'clamp(1.5rem, 4.5vw, 2rem)',
  '3xl': 'clamp(2rem, 5vw, 2.5rem)'
} as const;

// Touch-friendly sizing
export const TOUCH_TARGETS = {
  mobile: {
    minHeight: '44px',
    minWidth: '44px'
  },
  desktop: {
    minHeight: '40px', 
    minWidth: '40px'
  }
} as const;

// Container queries for component-level responsiveness
export const CONTAINER_QUERIES = {
  card: '(min-width: 300px)',
  sidebar: '(min-width: 250px)', 
  content: '(min-width: 600px)',
  wide: '(min-width: 800px)'
} as const;

// Responsive utility class generators
export class ResponsiveUtils {
  /**
   * Generate mobile-first responsive spacing classes
   */
  static spacing(mobile: keyof typeof SPACING, tablet?: keyof typeof SPACING, desktop?: keyof typeof SPACING) {
    let classes = `space-y-${mobile}`;
    if (tablet) classes += ` sm:space-y-${tablet}`;
    if (desktop) classes += ` lg:space-y-${desktop}`;
    return classes;
  }

  /**
   * Generate mobile-first responsive padding classes
   */
  static padding(mobile: string, tablet?: string, desktop?: string) {
    let classes = `p-${mobile}`;
    if (tablet) classes += ` sm:p-${tablet}`;
    if (desktop) classes += ` lg:p-${desktop}`;
    return classes;
  }

  /**
   * Generate mobile-first responsive gap classes
   */
  static gap(mobile: string, tablet?: string, desktop?: string) {
    let classes = `gap-${mobile}`;
    if (tablet) classes += ` sm:gap-${tablet}`;
    if (desktop) classes += ` lg:gap-${desktop}`;
    return classes;
  }

  /**
   * Generate mobile-first responsive text classes
   */
  static text(mobile: string, tablet?: string, desktop?: string) {
    let classes = `text-${mobile}`;
    if (tablet) classes += ` sm:text-${tablet}`;  
    if (desktop) classes += ` lg:text-${desktop}`;
    return classes;
  }

  /**
   * Generate responsive width classes
   */
  static width(mobile: string, tablet?: string, desktop?: string) {
    let classes = `w-${mobile}`;
    if (tablet) classes += ` sm:w-${tablet}`;
    if (desktop) classes += ` lg:w-${desktop}`;
    return classes;
  }

  /**
   * Generate responsive height classes  
   */
  static height(mobile: string, tablet?: string, desktop?: string) {
    let classes = `h-${mobile}`;
    if (tablet) classes += ` sm:h-${tablet}`;
    if (desktop) classes += ` lg:h-${desktop}`;
    return classes;
  }

  /**
   * Generate touch-friendly button classes
   */
  static touchButton(size: 'sm' | 'md' | 'lg' = 'md') {
    const sizes = {
      sm: 'min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]',
      md: 'min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]', 
      lg: 'min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px]'
    };
    return sizes[size];
  }

  /**
   * Generate responsive flexbox layouts
   */
  static flexLayout(mobile: 'col' | 'row', tablet?: 'col' | 'row', desktop?: 'col' | 'row') {
    let classes = `flex flex-${mobile}`;
    if (tablet) classes += ` sm:flex-${tablet}`;
    if (desktop) classes += ` lg:flex-${desktop}`;
    return classes;
  }

  /**
   * Generate responsive grid layouts
   */
  static gridCols(mobile: number, tablet?: number, desktop?: number) {
    let classes = `grid grid-cols-${mobile}`;
    if (tablet) classes += ` sm:grid-cols-${tablet}`;
    if (desktop) classes += ` lg:grid-cols-${desktop}`;
    return classes;
  }

  /**
   * Generate safe area aware padding
   */
  static safeArea(sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left']) {
    return sides.map(side => `safe-area-inset-${side}`).join(' ');
  }
}

// Predefined responsive component classes
export const RESPONSIVE_COMPONENTS = {
  // Card component responsive classes
  card: {
    base: `
      w-full rounded-lg border border-border bg-card text-card-foreground
      shadow-sm transition-all duration-200
      ${ResponsiveUtils.padding('4', '6', '8')}
      hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2
    `,
    compact: `
      w-full rounded-md border border-border bg-card text-card-foreground
      shadow-sm transition-all duration-200
      ${ResponsiveUtils.padding('3', '4', '6')}
    `
  },

  // Button component responsive classes
  button: {
    primary: `
      inline-flex items-center justify-center rounded-md font-medium 
      transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 
      focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none 
      disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90
      active:scale-[0.98] ${ResponsiveUtils.touchButton('md')}
      ${ResponsiveUtils.padding('3', '4', '4')} ${ResponsiveUtils.text('sm', 'base', 'base')}
    `,
    secondary: `
      inline-flex items-center justify-center rounded-md font-medium
      transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none
      disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground
      active:scale-[0.98] ${ResponsiveUtils.touchButton('md')}
      ${ResponsiveUtils.padding('3', '4', '4')} ${ResponsiveUtils.text('sm', 'base', 'base')}
    `,
    ghost: `
      inline-flex items-center justify-center rounded-md font-medium
      transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none
      disabled:opacity-50 hover:bg-accent hover:text-accent-foreground
      active:scale-[0.98] ${ResponsiveUtils.touchButton('md')}
      ${ResponsiveUtils.padding('2', '3', '3')} ${ResponsiveUtils.text('sm', 'base', 'base')}
    `
  },

  // Input component responsive classes
  input: {
    base: `
      flex w-full rounded-md border border-input bg-background 
      file:border-0 file:bg-transparent file:text-sm file:font-medium
      placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 
      focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
      transition-all duration-200
      ${ResponsiveUtils.height('10', '11', '12')} ${ResponsiveUtils.padding('3', '4', '4')}
      ${ResponsiveUtils.text('sm', 'base', 'base')}
    `
  },

  // Avatar component responsive classes  
  avatar: {
    sm: `
      relative flex shrink-0 overflow-hidden rounded-full
      ${ResponsiveUtils.width('6', '8', '8')} ${ResponsiveUtils.height('6', '8', '8')}
    `,
    md: `
      relative flex shrink-0 overflow-hidden rounded-full
      ${ResponsiveUtils.width('8', '10', '10')} ${ResponsiveUtils.height('8', '10', '10')}  
    `,
    lg: `
      relative flex shrink-0 overflow-hidden rounded-full
      ${ResponsiveUtils.width('10', '12', '14')} ${ResponsiveUtils.height('10', '12', '14')}
    `
  },

  // Layout component responsive classes
  layout: {
    container: `
      w-full max-w-7xl mx-auto
      ${ResponsiveUtils.padding('4', '6', '8')}
    `,
    section: `
      w-full ${ResponsiveUtils.padding('4', '6', '8')} ${ResponsiveUtils.spacing('md', 'lg', 'xl')}
    `,
    header: `
      sticky top-0 z-50 w-full border-b border-border bg-background/95 
      backdrop-blur supports-[backdrop-filter]:bg-background/60
      ${ResponsiveUtils.safeArea(['top'])} transition-all duration-200
    `,
    main: `
      flex-1 min-h-0 w-full max-w-full relative
      ${ResponsiveUtils.spacing('sm', 'md', 'lg')}
    `
  }
} as const;

// Accessibility utilities
export const A11Y_UTILS = {
  // Screen reader only content
  srOnly: 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
  
  // Skip link for keyboard navigation
  skipLink: `
    absolute left-4 top-4 z-[9999] -translate-y-full opacity-0
    focus:translate-y-0 focus:opacity-100 bg-primary text-primary-foreground
    ${ResponsiveUtils.padding('2', '3', '4')} rounded-md font-medium transition-all duration-200
  `,

  // Focus visible styles
  focusVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  
  // High contrast mode support
  highContrast: `
    contrast-more:border-current contrast-more:outline contrast-more:outline-2 
    contrast-more:outline-current contrast-more:outline-offset-2
  `,

  // Reduced motion support
  reducedMotion: 'motion-reduce:transition-none motion-reduce:animation-none'
} as const;

// Performance optimization utilities
export const PERFORMANCE = {
  // CSS containment for performance
  contain: 'contain-layout contain-style contain-paint',
  
  // Transform optimizations for animations
  willChange: 'will-change-transform',
  
  // Layer promotion for smooth animations
  promote: 'transform-gpu',
  
  // Efficient scrolling
  scroll: 'overflow-y-auto overscroll-contain scroll-smooth'
} as const;