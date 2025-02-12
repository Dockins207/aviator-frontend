'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthService } from '@/app/lib/auth';
import { useRouter } from 'next/navigation';

const Header: React.FC = () => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = AuthService.isAuthenticated();

  const handleLogout = () => {
    AuthService.logout();
    router.push('/');  // Redirect to index page
    closeMenu();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="w-full bg-gray-100 shadow-md relative">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center relative">
        <div className="text-xl font-bold text-slate-700">Aviator</div>
        
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
              className={`block h-0.5 w-5 bg-slate-700 transform transition duration-500 ease-in-out ${
                isMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-1.5'
              }`}
            ></span>
            <span 
              aria-hidden="true" 
              className={`block h-0.5 w-5 bg-slate-700 my-1 transform transition duration-500 ease-in-out ${
                isMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            ></span>
            <span 
              aria-hidden="true" 
              className={`block h-0.5 w-5 bg-slate-700 transform transition duration-500 ease-in-out ${
                isMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-1.5'
              }`}
            ></span>
          </div>
        </button>

        {/* Navigation Menu */}
        <nav 
          className={`
            fixed top-0 right-0 h-screen w-64 bg-gray-100 z-40 transform transition-transform duration-300 ease-in-out
            ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
            md:fixed md:top-0 md:right-0 md:h-screen md:w-64 md:bg-gray-100 md:z-40 md:transform md:transition-transform md:duration-300 md:ease-in-out
            md:${isMenuOpen ? 'md:translate-x-0' : 'md:translate-x-full'}
            flex flex-col items-start justify-start
            pt-20 pl-6 space-y-4
            shadow-lg
          `}
        >
          {!isAuthenticated ? (
            <>
              <Link 
                href="/login" 
                className="text-slate-600 hover:text-slate-800 text-base"
                onClick={closeMenu}
              >
                Login
              </Link>
              <Link 
                href="/register" 
                className="text-slate-600 hover:text-slate-800 text-base"
                onClick={closeMenu}
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/game-dashboard" 
                className="text-slate-600 hover:text-slate-800 text-base"
                onClick={closeMenu}
              >
                Dashboard
              </Link>
              <Link 
                href="/profile" 
                className="text-slate-600 hover:text-slate-800 text-base"
                onClick={closeMenu}
              >
                Profile
              </Link>
              <button 
                onClick={handleLogout}
                className="text-slate-600 hover:text-slate-800 text-base bg-transparent px-2 py-1 rounded-md"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
