'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/app/lib/auth';
import Link from 'next/link';
import BalanceDisplay from './BalanceDisplay';
import toast from 'react-hot-toast'; // Import toast if not already imported

const GameDashboardHeader: React.FC = () => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const logoutSuccess = await AuthService.logout();
      
      if (logoutSuccess) {
        // Redirect to login page after successful logout
        router.push('/login');
      } else {
        // Show error toast or message if logout fails
        toast.error('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('An unexpected error occurred during logout.');
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
      <div className="container mx-auto px-4 py-3 flex justify-between items-center relative">
        <div className="text-xl font-bold">Aviator Game</div>
        
        <div className="absolute right-16 top-1/2 transform -translate-y-1/2">
          <BalanceDisplay />
        </div>
        
        {/* Hamburger Menu Button */}
        <button 
          className="z-50 absolute top-3 right-4"
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
      </div>
    </header>
  );
};

export default GameDashboardHeader;
