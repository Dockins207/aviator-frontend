'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, MessageCircle } from 'lucide-react';
import GroupChatService, { GroupMessage } from '@/services/GroupChatService';
import { useChat } from '@/context/ChatContext';
import '@/styles/scrollbar-hide.css';

interface GroupChatProps {
  onClose: () => void;
}

const GroupChat: React.FC<GroupChatProps> = ({ onClose }) => {
  const { isChatOpen, toggleChat } = useChat();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const groupChatService = GroupChatService.getInstance();

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

  // Chat container
  return (
    <div 
      ref={chatContainerRef}
      className={`
        fixed top-0 right-0 w-[280px]
        bg-black border-l border-zinc-800 shadow-xl z-40 flex flex-col
        transform transition-transform duration-300 ease-in-out
        h-[calc(100vh-57px)]
        rounded-l-lg overflow-hidden
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full'} 
        mt-[53px]
      `}
    >
      {/* Chat Header */}
      <div className="flex justify-between items-center py-1 px-2 border-b border-zinc-800 bg-black rounded-tl-lg">
        <div className="flex items-center space-x-1">
          <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
          <h3 className="text-xs font-medium text-white">Live Chat</h3>
        </div>
        <button 
          onClick={toggleChat} 
          className="hover:bg-zinc-800 rounded-full p-0.5 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-black scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
            <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-2">Start a conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index}
              className="bg-zinc-900 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-blue-400">
                  {message.username}
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-white">{message.content}</p>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-2 border-t border-zinc-800 bg-black rounded-bl-lg">
        <div className="flex items-center space-x-1">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-grow bg-zinc-900 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium min-w-[60px]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChat;
