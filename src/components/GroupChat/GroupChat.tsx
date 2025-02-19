'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, MessageCircle } from 'lucide-react';
import GroupChatService, { GroupMessage } from '@/services/GroupChatService';

interface GroupChatProps {
  onClose: () => void;
}

const GroupChat: React.FC<GroupChatProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const groupChatService = GroupChatService.getInstance();

  // Animate in on mount
  useEffect(() => {
    // Slight delay to ensure smooth transition
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Outside click handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        chatContainerRef.current && 
        !chatContainerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Smooth close handler
  const handleClose = () => {
    setIsVisible(false);
    // Delay actual onClose to allow animation to complete
    setTimeout(onClose, 300);
  };

  // Fetch recent messages and setup listeners
  useEffect(() => {
    const fetchRecentMessages = async () => {
      try {
        const recentMessages = await groupChatService.getRecentMessages();
        setMessages(recentMessages);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to fetch messages');
      }
    };

    const handleNewMessage = (message: GroupMessage) => {
      setMessages(prevMessages => [...prevMessages, message]);
    };

    // Fetch initial messages
    fetchRecentMessages();

    // Listen for new messages
    groupChatService.onNewMessage(handleNewMessage);

    // Scroll to bottom when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Cleanup listener
    return () => {
      groupChatService.removeNewMessageListener(handleNewMessage);
    };
  }, [groupChatService]);

  // Send message handler
  const sendMessage = async () => {
    // Trim and validate message
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      // Send message via GroupChatService
      await groupChatService.sendMessage(trimmedMessage);
      
      // Clear input after successful send
      setNewMessage('');
      
      // Optional: Scroll to bottom after sending
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      // Handle send message errors
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  // Handle key press for sending message on Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div 
      ref={chatContainerRef}
      className={`
        fixed bottom-4 right-4 w-[350px] h-[600px] 
        bg-slate-800 border-slate-700 rounded-lg shadow-xl z-50 flex flex-col
        transform transition-all duration-300 ease-in-out
        ${isVisible 
          ? 'translate-y-0 opacity-100' 
          : 'translate-y-10 opacity-0'
        }
      `}
    >
      {/* Chat Header */}
      <div className="flex justify-between items-center p-4 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-white">Group Chat</h3>
        </div>
        <button 
          onClick={handleClose} 
          className="hover:bg-slate-700 rounded-full p-1 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-2">Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // Create a unique key by combining id, timestamp, and index
            const uniqueKey = `${msg.id || ''}-${msg.timestamp.toString()}-${index}`;
            
            return (
              <div 
                key={uniqueKey} 
                className={`flex flex-col p-2 rounded-lg max-w-[80%] relative
                  ${msg.sender === 'me' ? 'self-end bg-blue-700 text-white' : 'self-start bg-slate-700 text-white'}
                  ${msg.status === 'pending' ? 'opacity-60' : ''}
                  ${msg.status === 'failed' ? 'border-2 border-red-500' : ''}`}
              >
                <div className="font-semibold text-sm text-white">{msg.sender}</div>
                <div className="text-sm">{msg.message}</div>
                <div className="text-xs text-slate-300 self-end flex items-center">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                  {msg.status === 'pending' && (
                    <span className="ml-2 text-xs text-yellow-300">Sending...</span>
                  )}
                  {msg.status === 'failed' && (
                    <span className="ml-2 text-xs text-red-400">Failed ↻</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex p-4 border-t border-slate-700">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-grow p-2 border rounded-l-lg focus:outline-none bg-slate-700 text-white placeholder-slate-400"
        />
        <button 
          onClick={sendMessage} 
          disabled={!newMessage.trim()}
          className="bg-blue-700 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 
            disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default GroupChat;
