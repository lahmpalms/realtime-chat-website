# Firebase User Presence Management System

## 🎯 **Overview**

This comprehensive presence management system automatically handles user cleanup when browsers close, monitors connection states, and manages background cleanup for inactive users. It solves the common problem of "ghost users" remaining in Firebase Realtime Database after users leave.

## 🏗️ **System Architecture**

### **Database Structure**
```
chatRoom/
├── users/           # User data with presence info
│   └── {userId}/
│       ├── id: string
│       ├── name: string
│       ├── joinedAt: number
│       ├── lastSeen: number
│       ├── isOnline: boolean
│       ├── connectionState: 'online' | 'offline' | 'away'
│       └── color: string
├── presence/        # Dedicated presence tracking
│   └── {userId}/
│       ├── isOnline: boolean
│       ├── lastSeen: number
│       └── connectionState: 'online' | 'offline' | 'away'
├── typing/          # Typing indicators (auto-cleanup)
└── messages/        # Chat messages
```

## 🔧 **Core Components**

### **1. usePresence Hook** (`src/lib/hooks/usePresence.ts`)

**Purpose**: Main presence management with onDisconnect handlers

**Key Features**:
- **onDisconnect() Setup**: Automatically removes user data when browser closes
- **Connection Monitoring**: Tracks Firebase connection state via `.info/connected`
- **Heartbeat System**: Regular presence updates every 30 seconds
- **Background Cleanup**: Removes inactive users after 5 minutes
- **Visibility Handling**: Tracks tab visibility changes (online/away states)
- **Browser Close Detection**: Handles beforeunload events

**Usage**:
```typescript
const presenceHook = usePresence(currentUser);

// Automatic setup - no manual calls needed
// presenceHook.cleanup() available for manual cleanup
```

### **2. useConnectionManager Hook** (`src/lib/hooks/useConnectionManager.ts`)

**Purpose**: Robust connection state management with retry logic

**Key Features**:
- **Connection Monitoring**: Real-time Firebase connection status
- **Exponential Backoff**: Smart retry mechanism (1s, 2s, 4s, 8s, 16s)
- **Network Change Detection**: Handles online/offline events
- **Page Visibility**: Reconnects when tab becomes visible
- **Max Retry Limits**: Prevents infinite retry loops

**Usage**:
```typescript
const { isConnected, retryCount, reinitialize } = useConnectionManager();
```

### **3. useMultiTabManager Hook** (`src/lib/hooks/useMultiTabManager.ts`)

**Purpose**: Handles multiple browser tabs with the same user

**Key Features**:
- **Main Tab Detection**: Identifies which tab should handle presence
- **Tab Coordination**: Uses localStorage for inter-tab communication
- **Duplicate Prevention**: Prevents multiple presence entries
- **Tab Cleanup**: Removes inactive tab entries
- **Role Management**: Main tab handles presence, secondary tabs are passive

**Usage**:
```typescript
const { isMainTab, tabId } = useMultiTabManager(currentUser);
```

### **4. Enhanced useChat Hook** (`src/lib/hooks/useChat.ts`)

**Updated Features**:
- **onDisconnect() Integration**: Automatic cleanup on disconnect
- **Presence-Aware Cleanup**: Updates both user and presence collections
- **Improved Background Cleanup**: Uses presence data for more accurate detection
- **Better Timing**: 5-minute timeout with detailed logging

## 📋 **Implementation Steps**

### **Step 1: Update Types** ✅
Added presence-related fields to User interface and constants for timing.

### **Step 2: Implement onDisconnect()** ✅
```typescript
// In joinRoom function
await onDisconnect(userRef).remove();
await onDisconnect(typingRef).remove();  
await onDisconnect(presenceRef).remove();
```

### **Step 3: Add Connection Monitoring** ✅
```typescript
const connectedRef = ref(database, '.info/connected');
onValue(connectedRef, (snapshot) => {
  const isConnected = snapshot.val() === true;
  // Handle connection state changes
});
```

### **Step 4: Background Cleanup System** ✅
```typescript
setInterval(async () => {
  // Clean up users inactive for > 5 minutes
  const timeoutThreshold = now - USER_TIMEOUT;
  // Remove from users, typing, and presence collections
}, CLEANUP_INTERVAL);
```

### **Step 5: Firebase Security Rules** ✅
```json
{
  "rules": {
    "chatRoom": {
      "presence": {
        "$userId": {
          ".read": true,
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['isOnline', 'lastSeen', 'connectionState'])"
        }
      }
    }
  }
}
```

## ⚡ **How It Works**

### **User Joins Room**:
1. User data saved to `chatRoom/users/{userId}`
2. Presence data saved to `chatRoom/presence/{userId}`
3. onDisconnect() handlers configured for automatic cleanup
4. Heartbeat system starts (30-second intervals)
5. Multi-tab manager initializes

### **Normal Operation**:
1. Heartbeat updates `lastSeen` timestamps
2. Connection manager monitors Firebase status
3. Presence hook handles visibility changes
4. Background cleanup runs every 2 minutes

### **User Leaves (Browser Close)**:
1. onDisconnect() handlers triggered automatically
2. User removed from all collections
3. Tab manager cleans up localStorage
4. Other tabs continue if available

### **Connection Loss**:
1. Connection manager detects disconnect
2. Retry mechanism starts with exponential backoff
3. Presence status maintained during reconnection
4. Full state restored on reconnection

### **Multiple Tabs**:
1. First tab becomes "main tab"
2. Main tab handles all presence management
3. Secondary tabs remain passive
4. If main tab closes, secondary tab can become main

## 🚨 **Edge Cases Handled**

### **Page Refresh**:
- onDisconnect() triggers briefly
- New connection re-establishes presence
- Background cleanup handles any orphaned data

### **Network Issues**:
- Connection manager retries with backoff
- Presence data preserved during outages
- Automatic reconnection when network restored

### **Multiple Tabs**:
- Tab coordination via localStorage
- Only main tab sends presence updates
- Prevents duplicate user entries

### **Browser Crash**:
- onDisconnect() handlers clean up immediately
- Background cleanup as failsafe
- No ghost users remain

## 📊 **Constants & Configuration**

```typescript
export const HEARTBEAT_INTERVAL = 30000;    // 30 seconds
export const USER_TIMEOUT = 300000;         // 5 minutes  
export const CLEANUP_INTERVAL = 120000;     // 2 minutes
export const CONNECTION_TIMEOUT = 10000;     // 10 seconds
```

## 🔍 **Debugging & Monitoring**

### **Console Logs**:
- `🟢 Firebase connected` - Connection established
- `🔴 Firebase disconnected` - Connection lost
- `💓 Heartbeat sent` - Regular presence update
- `🧹 Cleaning up inactive user` - Background cleanup
- `📑 Tab role: Main/Secondary` - Multi-tab status

### **Monitoring Points**:
1. **Connection Status**: Track connection drops/recoveries
2. **Cleanup Activity**: Monitor background cleanup frequency
3. **Tab Coordination**: Watch for multi-tab conflicts
4. **Retry Attempts**: Connection retry patterns

## 🚀 **Benefits**

1. **No Ghost Users**: Automatic cleanup prevents orphaned entries
2. **Robust Connection**: Handles network issues gracefully  
3. **Multi-Tab Safe**: Prevents duplicate presence entries
4. **Real-Time Status**: Accurate online/offline indicators
5. **Memory Efficient**: Regular cleanup prevents database bloat
6. **Edge Case Coverage**: Handles crashes, refreshes, network issues

## 🔧 **Usage in Components**

```typescript
// ChatContainer.tsx
const presenceHook = usePresence(currentUser);
const { isConnected } = useConnectionManager();
const { isMainTab } = useMultiTabManager(currentUser);

// Automatic cleanup on unmount
useEffect(() => {
  return () => {
    presenceHook.cleanup();
  };
}, [presenceHook]);
```

This system provides a production-ready solution for Firebase user presence management with comprehensive coverage of edge cases and failure scenarios.