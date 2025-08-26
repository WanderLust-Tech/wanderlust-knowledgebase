import React, { useEffect, useState } from 'react';
import { usePostRealTime } from '../hooks/useRealTimeNotifications';

interface TypingIndicatorProps {
  postId: string;
  onTyping?: (isTyping: boolean) => void;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ postId, onTyping }) => {
  const { typingUsers, sendTyping } = usePostRealTime(postId);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<number | null>(null);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      sendTyping(true);
      onTyping?.(true);
    }

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout to stop typing indicator
    const timeout = setTimeout(() => {
      setIsTyping(false);
      sendTyping(false);
      onTyping?.(false);
    }, 2000); // Stop typing after 2 seconds of inactivity

    setTypingTimeout(timeout);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (isTyping) {
        sendTyping(false);
        onTyping?.(false);
      }
    };
  }, [typingTimeout, isTyping, sendTyping, onTyping]);

  // Filter out current user from typing indicators (assuming we don't want to show our own typing)
  const otherTypingUsers = typingUsers.filter(user => {
    // You would filter out the current user here
    // For now, showing all typing users
    return true;
  });

  return (
    <div className="space-y-2">
      {/* Typing Indicator for Others */}
      {otherTypingUsers.length > 0 && (
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '0.1s' }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></div>
          </div>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {otherTypingUsers.length === 1 ? (
              <>
                <span className="font-medium">{otherTypingUsers[0].username}</span> is typing...
              </>
            ) : otherTypingUsers.length === 2 ? (
              <>
                <span className="font-medium">{otherTypingUsers[0].username}</span> and{' '}
                <span className="font-medium">{otherTypingUsers[1].username}</span> are typing...
              </>
            ) : (
              <>
                <span className="font-medium">{otherTypingUsers[0].username}</span> and{' '}
                {otherTypingUsers.length - 1} others are typing...
              </>
            )}
          </span>
        </div>
      )}

      {/* Input Handler Component - This would be rendered where the comment input is */}
      <TypingInputHandler onTyping={handleTyping} />
    </div>
  );
};

// Separate component to handle input typing detection
interface TypingInputHandlerProps {
  onTyping: () => void;
}

const TypingInputHandler: React.FC<TypingInputHandlerProps> = ({ onTyping }) => {
  return (
    <div className="relative">
      <textarea
        placeholder="Write a comment..."
        onKeyDown={onTyping}
        onChange={onTyping}
        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        rows={3}
      />
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <span>💬</span>
          <span>Shift + Enter for new line</span>
        </div>
        
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Post Comment
        </button>
      </div>
    </div>
  );
};

export default TypingIndicator;
