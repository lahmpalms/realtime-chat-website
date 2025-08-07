"use client";

import { MessageCircle, Users, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userCount: number;
  isConnected: boolean;
  currentUserName?: string;
  onLeave: () => void;
  variant?: "default" | "minimal" | "transparent";
  showNavigation?: boolean;
  className?: string;
}

export function Header({
  userCount,
  isConnected,
  currentUserName,
  onLeave,
  variant = "default",
  showNavigation = true,
  className = "",
}: HeaderProps) {
  return (
    <header
      className={cn(
        // Base styles
        "sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        // Safe area for mobile devices
        "safe-area-inset-top",
        // Variant-specific styles
        variant === "minimal" && "py-2 px-4",
        variant === "transparent" && "bg-transparent border-transparent",
        variant === "default" && "py-3 px-4 sm:py-4 sm:px-6 lg:px-8",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between w-full max-w-7xl mx-auto",
          "gap-2 xs:gap-3 sm:gap-4",
          "min-h-[44px]" // Minimum touch target for accessibility
        )}
      >
        {/* Left side - Brand and Connection Status */}
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-2 xs:gap-3 flex-shrink-0">
            <MessageCircle className="h-5 w-5 xs:h-6 xs:w-6 text-primary flex-shrink-0" />
            <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate max-w-[120px] xs:max-w-none">
              <span className="hidden xs:inline">Real-time Chat</span>
              <span className="xs:hidden">Chat</span>
            </h1>
          </div>

          {showNavigation && (
            <>
              <Separator
                orientation="vertical"
                className="h-4 sm:h-5 hidden xs:block"
              />

              <div className="flex items-center gap-1 xs:gap-2 flex-shrink-0">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs xs:text-sm font-medium hidden xs:inline",
                    isConnected
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {isConnected ? "Connected" : "Offline"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right side - User count and actions */}
        {showNavigation && (
          <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 flex-shrink-0">sa
            {/* User info and leave button */}
            {currentUserName && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-4 sm:h-5 hidden sm:block"
                />
                <div className="flex items-center gap-2 xs:gap-3">
                  <span className="text-xs sm:text-sm text-muted-foreground hidden md:block max-w-[100px] lg:max-w-none truncate">
                    Welcome,{" "}
                    <span className="font-medium text-foreground">
                      {currentUserName}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLeave}
                    className="h-9 px-3 text-xs xs:text-sm font-medium min-w-[60px] hover:bg-accent transition-colors"
                  >
                    Leave
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
