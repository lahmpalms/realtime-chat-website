# Claude Context - Real-time Chat Application Project

## Project Overview
You are building a real-time chat application as a full-stack portfolio project. This is a comprehensive context document for Claude Code to help you develop from scratch.

## Project Specifications

### Core Requirements
- **Framework**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Firebase Realtime Database
- **Hosting**: Vercel (free tier)
- **Target**: Portfolio showcase project
- **Budget**: $0 (completely free using free tiers)

### Key Features
1. **User Management**: Custom name input before joining (no registration required)
2. **Real-time Chat**: Live messaging with 20-person room limit
3. **Responsive Design**: Desktop and mobile optimized
4. **Emoji Support**: Emoji picker and reactions
5. **User Presence**: Online users list and typing indicators
6. **Basic Moderation**: Profanity filter and rate limiting (5 messages/minute)

### Technical Architecture
- **Frontend**: Next.js App Router + React 18+ + TypeScript
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **State Management**: React Context API + useReducer
- **Real-time**: Firebase Realtime Database listeners
- **Icons**: Lucide React (included with shadcn/ui)
- **Deployment**: Vercel with automatic CI/CD

## File Structure
```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/ (Next.js API routes if needed)
├── components/
│   ├── ui/ (shadcn/ui components)
│   ├── chat/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageInput.tsx
│   │   ├── EmojiPicker.tsx
│   │   ├── UserList.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ConnectionStatus.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── ThemeToggle.tsx
│   └── forms/
│       └── NameInputForm.tsx
├── lib/
│   ├── firebase.ts
│   ├── types.ts
│   ├── utils.ts
│   └── hooks/
│       ├── useChat.ts
│       ├── useUsers.ts
│       └── useTyping.ts
├── contexts/
│   ├── ChatContext.tsx
│   └── UserContext.tsx
└── styles/
    └── globals.css
```

## Core Data Models

### TypeScript Interfaces
```typescript
interface User {
  id: string;
  name: string;
  joinedAt: number;
  isTyping: boolean;
  lastSeen: number;
  color: string;
}

interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  emoji?: string;
}

interface ChatRoom {
  users: Record<string, User>;
  messages: Record<string, Message>;
  typing: Record<string, TypingStatus>;
  metadata: {
    currentUserCount: number;
    maxUsers: number;
    createdAt: number;
  };
}
```

### Firebase Database Structure
```json
{
  "chatRoom": {
    "users": {
      "user_123": {
        "id": "user_123",
        "name": "John Doe",
        "joinedAt": 1692123456789,
        "isTyping": false,
        "lastSeen": 1692123456789,
        "color": "#3B82F6"
      }
    },
    "messages": {
      "msg_456": {
        "id": "msg_456",
        "userId": "user_123",
        "userName": "John Doe",
        "userColor": "#3B82F6",
        "text": "Hello everyone! 👋",
        "timestamp": 1692123456789
      }
    },
    "typing": {
      "user_123": {
        "userId": "user_123",
        "userName": "John Doe",
        "timestamp": 1692123456789
      }
    },
    "metadata": {
      "currentUserCount": 5,
      "maxUsers": 20,
      "createdAt": 1692000000000
    }
  }
}
```

## Development Guidelines

### Code Standards
- **TypeScript**: Strict mode enabled, proper type definitions
- **ESLint**: Standard Next.js configuration
- **Prettier**: Consistent code formatting
- **Components**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for variables
- **File Organization**: Group related functionality

### Firebase Integration Best Practices
- **Real-time Listeners**: Use `onValue` for live data
- **Cleanup**: Always remove listeners on unmount
- **Error Handling**: Wrap Firebase calls in try-catch
- **Security Rules**: Validate data on server side
- **Performance**: Limit query results and use pagination

### UI/UX Guidelines
- **Responsive**: Mobile-first design approach
- **Accessibility**: ARIA labels, keyboard navigation
- **Loading States**: Show loading indicators for async operations
- **Error States**: User-friendly error messages
- **Theme Support**: Dark/light mode toggle
- **Performance**: Lazy loading, code splitting

## Required Dependencies
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "firebase": "^10.0.0",
    "lucide-react": "^0.263.1",
    "emoji-mart": "^5.5.0",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "prettier": "^3.0.0"
  }
}
```

## Environment Variables
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

## Firebase Security Rules
```json
{
  "rules": {
    "chatRoom": {
      "messages": {
        ".read": true,
        ".write": true,
        "$messageId": {
          ".validate": "newData.hasChildren(['userId', 'userName', 'text', 'timestamp']) && newData.child('text').isString() && newData.child('text').val().length <= 500"
        }
      },
      "users": {
        ".read": true,
        ".write": true,
        "$userId": {
          ".validate": "newData.hasChildren(['id', 'name', 'joinedAt']) && newData.child('name').isString() && newData.child('name').val().length <= 20"
        }
      },
      "typing": {
        ".read": true,
        ".write": true
      },
      "metadata": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Development Phases

### Phase 1: Project Setup (Day 1-2)
- Initialize Next.js project with TypeScript
- Setup Tailwind CSS and shadcn/ui
- Configure Firebase project and SDK
- Setup basic folder structure
- Install and configure ESLint/Prettier

### Phase 2: Core Components (Day 3-5)
- Create basic layout components
- Implement NameInputForm for user entry
- Build ChatContainer with sidebar layout
- Create MessageList and MessageItem components
- Setup Firebase connection and basic hooks

### Phase 3: Real-time Features (Day 6-8)
- Implement real-time message listeners
- Add user presence and typing indicators
- Create MessageInput with emoji picker
- Setup user management (join/leave)
- Add connection status indicators

### Phase 4: Polish & Features (Day 9-10)
- Implement theme toggle (dark/light mode)
- Add rate limiting and basic moderation
- Responsive design improvements
- Error handling and loading states
- Performance optimizations

### Phase 5: Deployment (Day 11)
- Setup Vercel deployment
- Configure environment variables
- Test production build
- Setup custom domain (optional)
- Final testing and bug fixes

## Testing Strategy
- **Manual Testing**: Cross-browser compatibility
- **Mobile Testing**: Responsive design on various devices
- **Performance Testing**: Firebase connection and message load times
- **User Experience Testing**: Complete user flow from entry to chatting

## Performance Considerations
- **Message Pagination**: Load recent messages, implement infinite scroll
- **User Limit Enforcement**: Check room capacity before allowing entry
- **Memory Management**: Clean up Firebase listeners properly
- **Bundle Size**: Use dynamic imports for heavy components
- **Caching**: Leverage Next.js built-in caching

## Security Considerations
- **Input Validation**: Sanitize user input on client and server
- **Rate Limiting**: Prevent spam with message frequency limits
- **Content Filtering**: Basic profanity filter implementation
- **Firebase Rules**: Server-side validation of all data writes
- **XSS Prevention**: Escape user-generated content

## Deployment Configuration

### Vercel Configuration (vercel.json)
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "regions": ["iad1"]
}
```

### Firebase Deployment
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init

# Deploy security rules
firebase deploy --only database
```

## Success Metrics
- **Functionality**: All core features working as specified
- **Performance**: < 2 second load time, < 100ms message delivery
- **Responsiveness**: Works seamlessly on mobile and desktop
- **User Experience**: Intuitive interface, smooth interactions
- **Code Quality**: Clean, well-documented, maintainable code
- **Portfolio Impact**: Professional presentation showcasing full-stack skills

## Additional Context Notes
- This is a portfolio project, so code quality and documentation are crucial
- Focus on modern React patterns and best practices
- Ensure the application showcases full-stack development skills
- Keep the scope manageable but impressive
- Document key technical decisions and trade-offs
- Consider this as a demonstration of real-world development capabilities