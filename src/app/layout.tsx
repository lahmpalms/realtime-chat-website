import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { EnhancedToaster } from "@/components/ui/enhanced-toaster";
import { ChatProvider } from "@/contexts/ChatContext";
import { UserProvider } from "@/contexts/UserContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Real-time Chat App",
  description: "A modern real-time chat application built with Next.js and Firebase",
  keywords: "chat, real-time, messaging, Next.js, Firebase, responsive",
  authors: [{ name: "Real-time Chat Team" }],
  creator: "Real-time Chat Team",
  publisher: "Real-time Chat Team",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Real-time Chat",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`
          ${inter.variable} 
          font-sans 
          antialiased 
          min-h-screen 
          min-h-[100dvh]
          w-full 
          max-w-full
          overflow-x-hidden
          bg-background 
          text-foreground
          selection:bg-primary/20
          touch-pan-y
          overscroll-behavior-none
          sm:overscroll-behavior-auto
        `}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutProvider>
            <UserProvider>
              <ChatProvider>
                <div className="
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
                ">
                  {children}
                </div>
                <EnhancedToaster />
              </ChatProvider>
            </UserProvider>
          </LayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
