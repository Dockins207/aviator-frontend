'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface ChatIconProps {
  onClick: () => void;
  unreadCount?: number;
}

const ChatIcon: React.FC<ChatIconProps> = ({ onClick, unreadCount = 0 }) => {
  return (
    <div className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition-colors" onClick={onClick}>
      <MessageCircle className="w-6 h-6 text-gray-600" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full 
          w-4 h-4 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </div>
  );
};

export default ChatIcon;
