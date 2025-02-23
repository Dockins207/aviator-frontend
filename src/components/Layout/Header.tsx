'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AuthService } from '@/app/lib/auth';
import { useRouter } from 'next/navigation';
import { 
  HomeIcon, 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon, 
  ArrowLeftOnRectangleIcon, 
  UserPlusIcon 
} from '@heroicons/react/24/outline';

const Header: React.FC = () => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = AuthService.isAuthenticated();
  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const handleLogout = () => {
    AuthService.logout();
    router.push('/');  // Redirect to index page
    closeMenu();
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside both the menu button and the nav menu
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        navRef.current && !navRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    // Add event listener when menu is open
    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="w-full bg-slate-900 shadow-md relative z-40">
      <div className="w-full px-4 py-3 flex justify-between items-center relative">
        <div className="text-xl font-bold text-white">Aviator</div>
        
        {/* Hamburger Menu Button */}
        <button 
          ref={menuRef}
          className="z-50 absolute top-3 right-4"
          onClick={toggleMenu}
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

        {/* Navigation Menu */}
        <nav 
          ref={navRef}
          className={`
            fixed top-12 right-0 h-64 w-48 bg-slate-900 z-40 transform transition-transform duration-300 ease-in-out
            ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
            rounded-lg shadow-lg
            flex flex-col items-start justify-start
            pt-4 pl-4 space-y-3
            overflow-y-auto
          `}
        >
          {!isAuthenticated ? (
            <>
              <Link 
                href="/login" 
                className="text-gray-300 hover:text-white text-sm flex items-center space-x-2"
                onClick={closeMenu}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span>Login</span>
              </Link>
              <Link 
                href="/register" 
                className="text-gray-300 hover:text-white text-sm flex items-center space-x-2"
                onClick={closeMenu}
              >
                <UserPlusIcon className="h-5 w-5" />
                <span>Register</span>
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/game-dashboard" 
                className="text-gray-300 hover:text-white text-sm flex items-center space-x-2"
                onClick={closeMenu}
              >
                <HomeIcon className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                href="/profile" 
                className="text-gray-300 hover:text-white text-sm flex items-center space-x-2"
                onClick={closeMenu}
              >
                <UserCircleIcon className="h-5 w-5" />
                <span>Profile</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="text-gray-300 hover:text-white text-sm bg-transparent flex items-center space-x-2"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
