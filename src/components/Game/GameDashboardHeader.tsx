'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import ChatIcon from '@/components/GroupChat/ChatIcon';
import GroupChat from '@/components/GroupChat/GroupChat';

import { AuthService } from '@/app/lib/auth';
import WalletService, { WalletUpdate } from '@/services/walletService';
import BalanceDisplay from './BalanceDisplay';

interface GameDashboardHeaderProps {
  username?: string;
}

const GameDashboardHeader: React.FC<GameDashboardHeaderProps> = ({ username }) => {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchInitialBalance = useCallback(async () => {
    try {
      // Use wallet balance method from WalletService
      const walletBalance = await WalletService.getWalletBalance();
      if (walletBalance) {
        setBalance(walletBalance.balance);
      }

      // Fetch user profile for user ID
      const profile = await AuthService.getProfile();
      if (profile) {
        setUserId(profile.user_id);
      }
    } catch (error) {
      console.error('Failed to fetch initial balance:', error);
      toast.error('Failed to load wallet balance');
    }
  }, []);

  useEffect(() => {
    // Initial balance fetch
    fetchInitialBalance();

    // Enhanced logging for wallet updates
    console.group('🔍 GameDashboardHeader Wallet Update Setup');
    console.log('Initial Balance:', balance);
    console.log('User ID:', userId);
    console.groupEnd();

    // Subscribe to wallet updates with comprehensive logging
    const unsubscribe = WalletService.subscribeToWalletUpdates((update: WalletUpdate) => {
      console.group('💰 Wallet Update Received');
      console.log('Update Details:', {
        balance: update.balance,
        userId: update.userId,
        transactionType: update.transactionType,
        timestamp: update.timestamp
      });
      console.log('Current Component Balance:', balance);
      console.groupEnd();

      // Only update if the update is for the current user or no specific user is set
      if (!userId || update.userId === userId) {
        setBalance(prevBalance => {
          const newBalance = update.balance;
          
          // Log balance change
          console.group('💸 Balance Change');
          console.log('Previous Balance:', prevBalance);
          console.log('New Balance:', newBalance);
          console.log('Balance Changed:', prevBalance !== newBalance);
          console.groupEnd();

          // Optional: Show toast for significant balance changes
          if (Math.abs(newBalance - prevBalance) > 0.01) {
            toast.success(`Balance updated: ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} KSH`);
          }

          return newBalance;
        });
      } else {
        console.warn('🚨 Wallet update for different user', {
          currentUserId: userId,
          updateUserId: update.userId
        });
      }
    });

    // Cleanup function
    return () => {
      console.log('🚫 Unsubscribing from wallet updates');
      unsubscribe();
    };
  }, [fetchInitialBalance, userId]);

  const handleLogout = async () => {
    try {
      // Logout using AuthService
      await AuthService.logout();
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed. Please try again.');
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="w-full bg-slate-800 text-white relative">
      <div className="w-full px-2 py-3 h-16 relative">
        {/* Far Left: Aviator Game */}
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xl font-bold">
          Aviator Game
        </div>
        
        {/* Far Right: Balance, Chat, Hamburger */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {/* Balance Display */}
          <div className="flex items-center">
            <BalanceDisplay balance={balance} />
          </div>

          {/* Chat Icon */}
          <div>
            <ChatIcon 
              onClick={() => setIsChatOpen(true)} 
              unreadCount={0}  // Implement unread count logic later
            />
          </div>

          {/* Hamburger Menu Button */}
          <button 
            className="z-50"
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            <span className="sr-only">Open main menu</span>
            <div className="block w-5">
              <span 
                aria-hidden="true" 
                className={`block h-0.5 w-5 bg-white transform transition duration-500 ease-in-out ${
                  isMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-1.5'
                }`}
              ></span>
              <span 
                aria-hidden="true" 
                className={`block h-0.5 w-5 bg-white my-1 transform transition duration-500 ease-in-out ${
                  isMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              ></span>
              <span 
                aria-hidden="true" 
                className={`block h-0.5 w-5 bg-white transform transition duration-500 ease-in-out ${
                  isMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-1.5'
                }`}
              ></span>
            </div>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav 
          className={`
            fixed top-0 right-0 h-screen w-64 bg-slate-800 z-40 transform transition-transform duration-300 ease-in-out
            ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
            md:fixed md:top-0 md:right-0 md:h-screen md:w-64 md:bg-slate-800 md:z-40 md:transform md:transition-transform md:duration-300 md:ease-in-out
            md:${isMenuOpen ? 'md:translate-x-0' : 'md:translate-x-full'}
            flex flex-col items-start justify-start
            pt-20 pl-6 space-y-4
            shadow-lg
          `}
        >
          {/* Close button */}
          <button 
            onClick={closeMenu}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <Link 
            href="/profile" 
            className="text-white hover:text-slate-300 text-base"
            onClick={closeMenu}
          >
            Profile
          </Link>
          <button 
            onClick={handleLogout}
            className="text-white hover:text-slate-300 text-base bg-transparent px-2 py-1 rounded-md"
          >
            Logout
          </button>
        </nav>

        {/* Conditionally render chat component */}
        {isChatOpen && (
          <GroupChat onClose={() => setIsChatOpen(false)} />
        )}
      </div>
    </header>
  );
};

export default GameDashboardHeader;
