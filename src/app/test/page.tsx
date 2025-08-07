'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Tailwind CSS & shadcn/ui Test
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            This page tests if Tailwind CSS and shadcn/ui components are working correctly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Button Test */}
          <Card>
            <CardHeader>
              <CardTitle>Button Components</CardTitle>
              <CardDescription>Testing different button variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="link">Link Button</Button>
            </CardContent>
          </Card>

          {/* Input Test */}
          <Card>
            <CardHeader>
              <CardTitle>Input Components</CardTitle>
              <CardDescription>Testing input styling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Enter your name" />
              <Input placeholder="Email address" type="email" />
              <Input placeholder="Password" type="password" />
            </CardContent>
          </Card>

          {/* Badge Test */}
          <Card>
            <CardHeader>
              <CardTitle>Badge Components</CardTitle>
              <CardDescription>Testing badge variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Color Test */}
          <Card>
            <CardHeader>
              <CardTitle>Color System</CardTitle>
              <CardDescription>Testing CSS variables and colors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
                  Primary Color
                </div>
                <div className="h-8 bg-secondary rounded flex items-center justify-center text-secondary-foreground">
                  Secondary Color
                </div>
                <div className="h-8 bg-muted rounded flex items-center justify-center text-muted-foreground">
                  Muted Color
                </div>
                <div className="h-8 bg-accent rounded flex items-center justify-center text-accent-foreground">
                  Accent Color
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spacing Test */}
          <Card>
            <CardHeader>
              <CardTitle>Spacing & Layout</CardTitle>
              <CardDescription>Testing Tailwind spacing utilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded">
                  <p className="text-sm">Padding test</p>
                </div>
                <div className="m-4 p-2 bg-green-100 dark:bg-green-900 rounded">
                  <p className="text-sm">Margin test</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-red-500 rounded"></div>
                  <div className="w-8 h-8 bg-yellow-500 rounded"></div>
                  <div className="w-8 h-8 bg-green-500 rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responsive Test */}
          <Card>
            <CardHeader>
              <CardTitle>Responsive Design</CardTitle>
              <CardDescription>Testing responsive utilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
                <p className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded">
                  This text changes size on different screen sizes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Success Message */}
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <p className="text-green-800 dark:text-green-200 font-medium">
                ✅ If you can see this page with proper styling, Tailwind CSS and shadcn/ui are working correctly!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
