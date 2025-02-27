'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { 
  UserCircleIcon, 
  ArrowLeftOnRectangleIcon 
} from '@heroicons/react/24/outline';

import { AuthService } from '@/app/lib/auth';
import { useWallet } from '@/contexts/WalletContext';
import { useChat } from '@/contexts/ChatContext';
import { MessageCircle } from 'lucide-react';

import GroupChat from '@/components/GroupChat/GroupChat';

interface GameDashboardHeaderProps {
  balance: number | undefined;
}

const GameDashboardHeader = ({ balance }: GameDashboardHeaderProps) => {
  const router = useRouter();
  const { loading, error } = useWallet();
  const { toggleChat, isChatOpen } = useChat();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMenuOpen && 
        menuRef.current && 
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    // Add event listener when menu is open
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      router.push('/');  
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const formatBalance = (amount: number | undefined) => {
    if (!amount) return '0.00';
    return amount.toLocaleString('en-KE', { minimumFractionDigits: 2 });
  };

  return (
    <header className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center h-12">
      <Link href="" className="text-lg font-bold">
        Aviator
      </Link>

      <div className="flex items-center space-x-3">
        <div className="flex items-center gap-2">
          <div className="
            pl-2 pr-3 py-0.5 rounded-full
            bg-red-600 text-white
            font-medium text-sm
            flex items-center gap-1
            h-[26px]
          ">
            <span className="font-bold">
              {loading ? 'Loading...' : `KSH ${formatBalance(balance)}`}
            </span>
          </div>
        </div>
        <button
          onClick={toggleChat}
          className={`p-2 rounded-full transition-colors ${
            isChatOpen 
              ? 'bg-black text-white hover:bg-zinc-900' 
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        <button 
          onClick={toggleMenu} 
          className="z-50"
          aria-label="Toggle Menu"
        >
          <span className="sr-only">Open main menu</span>
          <div className="block w-6">
            <span 
              aria-hidden="true" 
              className="block h-0.5 w-full bg-white mb-1.5"
            ></span>
            <span 
              aria-hidden="true" 
              className="block h-0.5 w-full bg-white mb-1.5"
            ></span>
            <span 
              aria-hidden="true" 
              className="block h-0.5 w-full bg-white"
            ></span>
          </div>
        </button>
      </div>

      {isMenuOpen && (
        <div 
          ref={menuRef}
          className="absolute top-12 right-4 w-64 bg-slate-800 text-white rounded-lg shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <nav className="flex flex-col p-4 space-y-2">
            <Link 
              href="/auth/profile" 
              className="text-gray-300 hover:text-white text-sm flex items-center space-x-2"
              onClick={closeMenu}
            >
              <UserCircleIcon className="h-5 w-5" />
              <span>Profile</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="text-gray-300 hover:text-white text-sm bg-transparent flex items-center space-x-2 text-left w-full"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      )}

      {isChatOpen && <GroupChat onClose={() => toggleChat()} isOpen={isChatOpen} />}
    </header>
  );
};

export default GameDashboardHeader;
