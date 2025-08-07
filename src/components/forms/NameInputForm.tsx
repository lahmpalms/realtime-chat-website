'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Mock constants and utilities for demo
const MAX_NAME_LENGTH = 30;

interface NameInputFormProps {
  onSubmit: (name: string) => void;
  isLoading?: boolean;
}

export default function NameInputForm({ onSubmit = (name) => console.log('Submitted:', name), isLoading = false }: NameInputFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  
  // Refs for accessibility
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Enhanced keyboard shortcuts with accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enhanced keyboard shortcut: Ctrl/Cmd + Enter
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(e as any);
      }
      
      // Escape to clear form
      if (e.key === 'Escape' && !isLoading) {
        setName('');
        setError('');
        setShowValidation(false);
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [name, isLoading]);
  
  // Auto-focus on mount for desktop
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced form validation with better UX
  const validateName = useCallback((value: string): string => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return 'Please enter your name to join the chat';
    }
    
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    
    if (!/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
      return 'Name can only contain letters, numbers, and spaces';
    }
    
    return '';
  }, []);
  
  const handleSubmit = useCallback((e: React.FormEvent | KeyboardEvent) => {
    e.preventDefault();
    setShowValidation(true);
    
    const validationError = validateName(name);
    
    if (validationError) {
      setError(validationError);
      // Focus error for screen readers
      setTimeout(() => {
        errorRef.current?.focus();
      }, 100);
      return;
    }
    
    setError('');
    onSubmit(name.trim());
  }, [name, validateName, onSubmit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    
    // Real-time validation feedback
    if (showValidation) {
      const validationError = validateName(value);
      setError(validationError);
    } else if (error) {
      setError('');
    }
  }, [error, showValidation, validateName]);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);
  
  const handleInputBlur = useCallback(() => {
    setIsFocused(false);
    // Validate on blur for better UX
    if (name.trim() && !showValidation) {
      setShowValidation(true);
      const validationError = validateName(name);
      setError(validationError);
    }
  }, [name, showValidation, validateName]);

  // Character count with accessibility
  const charCount = name.length;
  const charCountPercentage = (charCount / MAX_NAME_LENGTH) * 100;
  const isNearLimit = charCountPercentage > 80;
  const isAtLimit = charCount >= MAX_NAME_LENGTH;
  
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-800 p-4 sm:p-6 lg:p-8 transition-colors duration-300"
      style={{ minHeight: '100vh' }}
      role="main"
      aria-label="Join chat form"
    >
      <div 
        className="w-full max-w-md backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 shadow-2xl border border-white/20 dark:border-gray-700/50 transition-all duration-300 rounded-lg"
        role="region"
        aria-labelledby="form-title"
        aria-describedby="form-description"
      >
        {/* Card Header */}
        <div className="text-center space-y-4 p-6 pb-6">
          <h1 
            id="form-title"
            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400"
          >
            Join Chat
          </h1>
          <div 
            id="form-description"
            className="text-base text-gray-600 dark:text-gray-400 leading-relaxed"
          >
            <div>Enter your name to start chatting with others.</div>
            <div>Your name will be visible to other users.</div>
          </div>
        </div>
        
        {/* Card Content */}
        <div className="p-6 pt-0 space-y-6">
          <div id="form-instructions" className="sr-only">
            Fill out this form to join the chat. Use letters, numbers, and spaces only. 
            Maximum {MAX_NAME_LENGTH} characters allowed.
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label 
                htmlFor="user-name"
                className="block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Your display name for the chat
              </label>
              
              <div className="relative">
                <input
                  ref={inputRef}
                  id="user-name"
                  type="text"
                  placeholder="Enter your display name"
                  value={name}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  maxLength={MAX_NAME_LENGTH}
                  disabled={isLoading}
                  autoComplete="username"
                  spellCheck="false"
                  className={`
                    flex h-12 w-full rounded-md border px-3 py-2 text-base
                    bg-white dark:bg-gray-800 
                    ring-offset-white dark:ring-offset-gray-900
                    placeholder:text-gray-500 dark:placeholder:text-gray-400
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 
                    disabled:cursor-not-allowed disabled:opacity-50
                    transition-all duration-200 ease-in-out
                    ${error 
                      ? 'border-red-500 text-red-900 dark:text-red-100 ring-red-500/20 focus-visible:ring-red-500/50' 
                      : isFocused 
                        ? 'border-blue-500 ring-2 ring-blue-500/50' 
                        : 'border-gray-300 dark:border-gray-600 focus-visible:ring-blue-500/50 focus-visible:border-blue-500'
                    }
                  `}
                  aria-describedby={`name-help ${error ? 'name-error' : ''} ${isNearLimit ? 'char-count-warning' : ''}`}
                  aria-invalid={!!error}
                  aria-required="true"
                />
                {isLoading && (
                  <div 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-hidden="true"
                  >
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
              </div>
            </div>
            
            {error && (
              <div 
                ref={errorRef}
                id="name-error" 
                className="text-sm text-red-600 dark:text-red-400 font-medium pt-2"
                role="alert"
                aria-live="polite"
                tabIndex={-1}
              >
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg" aria-hidden="true">⚠</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-start gap-4">
              <div 
                id="name-help" 
                className="text-sm text-gray-600 dark:text-gray-400 flex-1"
              >
                Use letters, numbers, and spaces only
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <span 
                  id="char-count"
                  className={`
                    font-mono text-sm
                    ${isNearLimit && !isAtLimit ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}
                    ${isAtLimit ? 'text-red-600 dark:text-red-400 font-bold' : ''}
                    ${!isNearLimit ? 'text-gray-600 dark:text-gray-400' : ''}
                  `}
                  aria-live="polite"
                  aria-label={`${charCount} of ${MAX_NAME_LENGTH} characters used`}
                >
                  {charCount}/{MAX_NAME_LENGTH}
                </span>
                
                {isNearLimit && (
                  <span 
                    id="char-count-warning"
                    className="sr-only"
                    aria-live="polite"
                  >
                    {isAtLimit ? 'Maximum characters reached' : 'Approaching character limit'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Card Footer */}
        <div className="flex flex-col space-y-4 p-6 pt-0">
          <button 
            type="button"
            onClick={handleSubmit}
            className={`
              w-full h-12 text-base font-semibold rounded-md
              bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
              dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600
              text-white shadow-lg hover:shadow-xl 
              transition-all duration-200 ease-in-out
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-purple-600
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            `}
            disabled={isLoading || !name.trim() || !!error}
            aria-describedby={isLoading ? 'loading-status' : 'submit-help'}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3" role="status" aria-label="Joining chat room">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" aria-hidden="true" />
                <span>Joining chat...</span>
              </div>
            ) : (
              "Join Chat Room"
            )}
          </button>
          
          {!isLoading && (
            <div 
              id="submit-help"
              className="text-xs text-center text-gray-600 dark:text-gray-400"
            >
              Press Enter to submit or use the button above
            </div>
          )}
          
          {/* Enhanced keyboard shortcuts hint */}
          <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm" aria-hidden="true">💡</span>
                <span>Keyboard shortcuts:</span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono">
                    Ctrl+Enter
                  </kbd>
                  <span>to submit</span>
                </div>
                
                <span className="text-gray-400">•</span>
                
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono">
                    Escape
                  </kbd>
                  <span>to clear</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {isLoading && (
          <div 
            id="loading-status" 
            className="sr-only" 
            aria-live="assertive"
            role="status"
          >
            Joining chat room, please wait. Do not refresh the page.
          </div>
        )}
      </div>
      
      {/* Skip link for keyboard users */}
      <a
        href="#user-name"
        className="absolute -top-40 left-6 z-50 bg-white dark:bg-gray-900 px-4 py-2 text-gray-900 dark:text-gray-100 rounded shadow-lg transition-all focus:top-6"
        onFocus={(e) => e.currentTarget.style.top = '1.5rem'}
        onBlur={(e) => e.currentTarget.style.top = '-10rem'}
      >
        Skip to name input
      </a>
    </div>
  );
}