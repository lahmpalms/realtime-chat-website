'use client';

import { useState } from 'react';
import { ref, set, get, push } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function FirebaseTestPanel() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    console.log(message);
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runFirebaseTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    addLog('🧪 Starting Firebase connectivity tests...');

    if (!database) {
      addLog('❌ Database is null - Firebase not initialized');
      setIsRunning(false);
      return;
    }

    addLog('✅ Database object exists');

    try {
      // Test 1: Simple root path
      addLog('Test 1: Reading root path');
      const rootRef = ref(database, '/');
      const rootSnapshot = await get(rootRef);
      addLog(`✅ Root read successful: ${rootSnapshot.exists()}`);
    } catch (error) {
      addLog(`❌ Root read failed: ${error}`);
    }

    try {
      // Test 2: Write to a simple path
      addLog('Test 2: Writing to simple path');
      const testRef = ref(database, 'test');
      await set(testRef, { hello: 'world', timestamp: Date.now() });
      addLog('✅ Simple write successful');
    } catch (error) {
      addLog(`❌ Simple write failed: ${error}`);
    }

    try {
      // Test 3: Read back the simple path
      addLog('Test 3: Reading back simple path');
      const testRef = ref(database, 'test');
      const testSnapshot = await get(testRef);
      addLog(`✅ Simple read successful: ${JSON.stringify(testSnapshot.val())}`);
    } catch (error) {
      addLog(`❌ Simple read failed: ${error}`);
    }

    try {
      // Test 4: Write to chatRoom/users with safe path
      addLog('Test 4: Writing to chatRoom/users');
      const userRef = ref(database, 'chatRoom/users/testUser123');
      const userData = {
        id: 'testUser123',
        name: 'TestUser',
        timestamp: Date.now()
      };
      await set(userRef, userData);
      addLog('✅ User write successful');
    } catch (error) {
      addLog(`❌ User write failed: ${error}`);
    }

    try {
      // Test 5: Read chatRoom/users
      addLog('Test 5: Reading chatRoom/users');
      const usersRef = ref(database, 'chatRoom/users');
      const usersSnapshot = await get(usersRef);
      addLog(`✅ Users read successful: ${JSON.stringify(usersSnapshot.val())}`);
    } catch (error) {
      addLog(`❌ Users read failed: ${error}`);
    }

    try {
      // Test 6: Push operation (generates safe keys)
      addLog('Test 6: Push operation');
      const messagesRef = ref(database, 'chatRoom/messages');
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, {
        text: 'Test message',
        timestamp: Date.now()
      });
      addLog(`✅ Push successful with key: ${newMessageRef.key}`);
    } catch (error) {
      addLog(`❌ Push failed: ${error}`);
    }

    addLog('🏁 Firebase tests completed');
    setIsRunning(false);
  };

  const clearLogs = () => {
    setTestResults([]);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">🧪 Firebase Connectivity Test</CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={runFirebaseTests} 
              disabled={isRunning}
              variant="default"
              size="sm"
            >
              {isRunning ? 'Testing...' : '🚀 Run Tests'}
            </Button>
            <Button 
              onClick={clearLogs} 
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            This panel tests basic Firebase operations to identify where the "Invalid token in path" error occurs.
          </div>
          <div className="border rounded p-3 bg-muted/20 max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Click "Run Tests" to check Firebase connectivity
              </div>
            ) : (
              <div className="space-y-1">
                {testResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`text-xs font-mono ${
                      result.includes('❌') ? 'text-red-600' : 
                      result.includes('✅') ? 'text-green-600' : 
                      'text-foreground'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}