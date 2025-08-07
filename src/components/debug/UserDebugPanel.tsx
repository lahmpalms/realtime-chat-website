'use client';

import { useEffect, useState } from 'react';
import { ref, get, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DebugData {
  firebaseUsers: any;
  firebasePresence: any;
  contextUsers: any[];
  listeners: {
    usersListenerActive: boolean;
    presenceListenerActive: boolean;
  };
}

export function UserDebugPanel({ contextUsers }: { contextUsers: any[] }) {
  const [debugData, setDebugData] = useState<DebugData>({
    firebaseUsers: null,
    firebasePresence: null,
    contextUsers: [],
    listeners: {
      usersListenerActive: false,
      presenceListenerActive: false
    }
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh function
  const refreshFirebaseData = async () => {
    if (!database) {
      console.log('❌ Database not initialized');
      return;
    }

    setIsRefreshing(true);
    console.log('🔍 Manually fetching Firebase data...');

    try {
      const [usersSnapshot, presenceSnapshot] = await Promise.all([
        get(ref(database, 'chatRoom/users')),
        get(ref(database, 'chatRoom/presence'))
      ]);

      const firebaseUsers = usersSnapshot.val();
      const firebasePresence = presenceSnapshot.val();

      console.log('🗂️ Firebase Users Data:', firebaseUsers);
      console.log('👁️ Firebase Presence Data:', firebasePresence);
      console.log('📋 Context Users:', contextUsers);

      setDebugData(prev => ({
        ...prev,
        firebaseUsers,
        firebasePresence,
        contextUsers
      }));
    } catch (error) {
      console.error('❌ Failed to fetch Firebase data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Setup real-time listeners for debugging
  useEffect(() => {
    if (!database) return;

    console.log('🎧 Setting up debug listeners...');

    const usersRef = ref(database, 'chatRoom/users');
    const presenceRef = ref(database, 'chatRoom/presence');

    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      console.log('🔄 Debug: Users data updated:', data);
      setDebugData(prev => ({
        ...prev,
        firebaseUsers: data,
        listeners: { ...prev.listeners, usersListenerActive: true }
      }));
    }, (error) => {
      console.error('❌ Debug users listener error:', error);
    });

    const presenceUnsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      console.log('🔄 Debug: Presence data updated:', data);
      setDebugData(prev => ({
        ...prev,
        firebasePresence: data,
        listeners: { ...prev.listeners, presenceListenerActive: true }
      }));
    }, (error) => {
      console.error('❌ Debug presence listener error:', error);
    });

    return () => {
      console.log('🧹 Cleaning up debug listeners');
      off(usersRef, 'value', usersUnsubscribe);
      off(presenceRef, 'value', presenceUnsubscribe);
    };
  }, []);

  // Update context users when prop changes
  useEffect(() => {
    setDebugData(prev => ({
      ...prev,
      contextUsers
    }));
  }, [contextUsers]);

  // Initial data fetch
  useEffect(() => {
    refreshFirebaseData();
  }, []);

  const formatData = (data: any) => {
    if (!data) return 'null';
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  const getUserCount = (data: any) => {
    if (!data || typeof data !== 'object') return 0;
    return Object.keys(data).length;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">🐛 User Debug Panel</CardTitle>
          <Button 
            onClick={refreshFirebaseData} 
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {getUserCount(debugData.firebaseUsers)}
                </div>
                <div className="text-sm text-muted-foreground">Firebase Users</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {getUserCount(debugData.firebasePresence)}
                </div>
                <div className="text-sm text-muted-foreground">Presence Records</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {debugData.contextUsers.length}
                </div>
                <div className="text-sm text-muted-foreground">Context Users</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listeners Status */}
        <div className="flex gap-2">
          <Badge variant={debugData.listeners.usersListenerActive ? "default" : "destructive"}>
            Users Listener: {debugData.listeners.usersListenerActive ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant={debugData.listeners.presenceListenerActive ? "default" : "destructive"}>
            Presence Listener: {debugData.listeners.presenceListenerActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Data Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firebase Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">🗂️ Firebase Users Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                {formatData(debugData.firebaseUsers)}
              </pre>
            </CardContent>
          </Card>

          {/* Firebase Presence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">👁️ Firebase Presence Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                {formatData(debugData.firebasePresence)}
              </pre>
            </CardContent>
          </Card>

          {/* Context Users */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">📋 React Context Users State</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                {formatData(debugData.contextUsers)}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🔍 Issue Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {getUserCount(debugData.firebaseUsers) === 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                ❌ No users in Firebase - Check if joinRoom is working correctly
              </div>
            )}
            {getUserCount(debugData.firebaseUsers) > 0 && debugData.contextUsers.length === 0 && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                ⚠️ Firebase has users but Context is empty - Check if listeners are working
              </div>
            )}
            {!debugData.listeners.usersListenerActive && (
              <div className="p-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-sm">
                ⚠️ Users listener is not active - Check initializeListeners function
              </div>
            )}
            {getUserCount(debugData.firebaseUsers) > 0 && debugData.contextUsers.length > 0 && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                ✅ Data flow appears to be working correctly
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}