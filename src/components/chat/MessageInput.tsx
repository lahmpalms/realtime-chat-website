'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from './EmojiPicker';
import { MAX_MESSAGE_LENGTH } from '@/lib/types';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, onTyping, onStopTyping, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;
    
    onSendMessage(trimmedMessage);
    setMessage('');
    onStopTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [message, disabled, onSendMessage, onStopTyping]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (newValue.length > MAX_MESSAGE_LENGTH) {
      return;
    }
    
    setMessage(newValue);
    
    if (newValue.trim() && !disabled) {
      onTyping();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        onStopTyping();
      }, 1000);
    } else if (!newValue.trim()) {
      onStopTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [onTyping, onStopTyping, disabled]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const newMessage = message + emoji;
    if (newMessage.length <= MAX_MESSAGE_LENGTH) {
      setMessage(newMessage);
      inputRef.current?.focus();
    }
    setShowEmojiPicker(false);
  }, [message]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <div className="border-t border-border bg-background">
      {/* Mobile: Compact layout */}
      <div className="block sm:hidden">
        <form onSubmit={handleSubmit} className="flex gap-2 p-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={disabled ? 'Connecting...' : 'Message...'}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={disabled}
              className="pr-20 text-sm"
              maxLength={MAX_MESSAGE_LENGTH}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-w-8"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={disabled}
                aria-label="Open emoji picker"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>
            
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClickOutside={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={!message.trim() || disabled}
            className="h-10 w-10 min-w-10 p-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="px-3 pb-2 flex justify-between items-center text-xs text-muted-foreground">
          <span className="hidden xs:inline">Press Enter to send</span>
          <span className={message.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : ''}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </div>

      {/* Desktop: Full layout */}
      <div className="hidden sm:block">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end p-4">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={disabled ? 'Connecting...' : 'Type your message...'}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={disabled}
              className="pr-12"
              maxLength={MAX_MESSAGE_LENGTH}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={disabled}
                aria-label="Open emoji picker"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>
            
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClickOutside={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={!message.trim() || disabled}
            className="h-10"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="flex justify-between items-center px-4 pb-4 text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className={message.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : ''}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}