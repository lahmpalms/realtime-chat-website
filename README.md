# Real-time Chat Application

A modern, responsive real-time chat application built with Next.js, TypeScript, Firebase Realtime Database, and Tailwind CSS.

## ✨ Features

- **Real-time Messaging**: Instant message delivery using Firebase Realtime Database
- **User Management**: Simple name-based entry (no registration required)
- **Typing Indicators**: See when other users are typing
- **Online Presence**: Track who's currently online
- **Emoji Support**: Built-in emoji picker for expressive messages
- **Rate Limiting**: Prevents spam (5 messages per minute per user)
- **Room Capacity**: Maximum 20 users per chat room
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Dark/Light Theme**: Toggle between themes with system preference support
- **Modern UI**: Clean interface using shadcn/ui components

## 🚀 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Database**: Firebase Realtime Database
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context API + useReducer
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)
- **Deployment**: Vercel

## 📦 Installation

1. Clone the repository:
```bash
git clone <your-repository-url>
cd realtime-chat-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Realtime Database
   - Copy your Firebase configuration

4. Configure environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

5. Set up Firebase Database Rules:
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

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏗️ Project Structure

```
src/
├── app/
│   ├── globals.css       # Global styles and CSS variables
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Main application component
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── chat/            # Chat-specific components
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageInput.tsx
│   │   ├── EmojiPicker.tsx
│   │   ├── UserList.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ConnectionStatus.tsx
│   ├── layout/          # Layout components
│   │   ├── Header.tsx
│   │   └── ThemeToggle.tsx
│   └── forms/
│       └── NameInputForm.tsx
├── lib/
│   ├── firebase.ts      # Firebase configuration
│   ├── types.ts         # TypeScript interfaces
│   ├── utils.ts         # Utility functions
│   └── hooks/           # Custom React hooks
│       ├── useChat.ts
│       ├── useUsers.ts
│       └── useTyping.ts
├── contexts/
│   ├── ChatContext.tsx  # Chat state management
│   └── UserContext.tsx  # User state management
```

## 🎯 Usage

1. **Enter Your Name**: Type your name (up to 20 characters) to join the chat
2. **Start Chatting**: Send messages instantly to all connected users
3. **Use Emojis**: Click the emoji button to add emojis to your messages
4. **See Who's Online**: View the user list on the right sidebar
5. **Watch Typing**: See when others are typing in real-time
6. **Toggle Theme**: Click the theme toggle to switch between light and dark modes

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Features Implementation

- **Real-time Updates**: Uses Firebase onValue listeners for live data
- **State Management**: React Context + useReducer pattern
- **Type Safety**: Full TypeScript coverage with strict mode
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Optimized with React best practices and memoization

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on every push to main branch

### Manual Deployment

```bash
npm run build
npm run start
```

## 📝 Environment Variables

All environment variables should be prefixed with `NEXT_PUBLIC_` to be accessible in the browser:

- `NEXT_PUBLIC_FIREBASE_API_KEY` - Your Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
# realtime-chat-website
