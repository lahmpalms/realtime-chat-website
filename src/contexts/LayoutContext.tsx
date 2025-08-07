'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useResponsive } from '@/lib/hooks/useResponsive';

interface LayoutContextValue {
  headerHeight: number;
  sidebarWidth: number;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  currentBreakpoint: string;
  isHeaderVisible: boolean;
  setHeaderVisible: (visible: boolean) => void;
  layoutVariant: 'default' | 'minimal' | 'transparent';
  setLayoutVariant: (variant: 'default' | 'minimal' | 'transparent') => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
  children: React.ReactNode;
  initialVariant?: 'default' | 'minimal' | 'transparent';
}

export function LayoutProvider({ 
  children, 
  initialVariant = 'default' 
}: LayoutProviderProps) {
  const [headerHeight, setHeaderHeight] = useState(64);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [layoutVariant, setLayoutVariant] = useState(initialVariant);
  const { breakpoint } = useResponsive();
  
  // Measure header height to avoid conflicts
  const headerRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (headerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setHeaderHeight(entry.contentRect.height);
        }
      });
      
      resizeObserver.observe(headerRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [breakpoint]);
  
  // Update sidebar width based on breakpoint
  useEffect(() => {
    if (breakpoint === 'mobile') {
      setSidebarWidth(280); // Mobile sidebar width
    } else if (breakpoint === 'tablet') {
      setSidebarWidth(320); // Tablet sidebar width
    } else {
      setSidebarWidth(360); // Desktop sidebar width
    }
  }, [breakpoint]);
  
  const value: LayoutContextValue = {
    headerHeight,
    sidebarWidth,
    isMobileMenuOpen,
    setMobileMenuOpen: setIsMobileMenuOpen,
    currentBreakpoint: breakpoint,
    isHeaderVisible,
    setHeaderVisible: setIsHeaderVisible,
    layoutVariant,
    setLayoutVariant,
  };
  
  return (
    <LayoutContext.Provider value={value}>
      <div 
        className="app-layout"
        style={{
          '--header-height': `${headerHeight}px`,
          '--sidebar-width': `${sidebarWidth}px`,
          '--header-z-index': '1000',
          '--sidebar-z-index': '999',
          '--overlay-z-index': '1001',
        } as React.CSSProperties}
      >
        {children}
      </div>
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
}

// Layout wrapper component for consistent structure
interface LayoutWrapperProps {
  children: React.ReactNode;
  className?: string;
  suppressHeader?: boolean;
  headerVariant?: 'default' | 'minimal' | 'transparent';
}

export function LayoutWrapper({ 
  children, 
  className = '', 
  suppressHeader = false,
  headerVariant = 'default'
}: LayoutWrapperProps) {
  const { headerHeight, layoutVariant } = useLayout();
  
  return (
    <div 
      className={`
        min-h-screen 
        min-h-[100dvh]
        w-full 
        max-w-full
        flex 
        flex-col
        overflow-hidden
        relative
        supports-[height:100dvh]:min-h-[100dvh]
        supports-[height:100svh]:min-h-[100svh]
        ${className}
      `}
      style={{
        paddingTop: headerHeight,
      }}
    >
      {/* Main content area */}
      <main 
        className="flex-1 min-h-0 relative"
        id="main-content"
        style={{
          minHeight: `calc(100vh - ${headerHeight}px)`,
        }}
      >
        {children}
      </main>
    </div>
  );
}
