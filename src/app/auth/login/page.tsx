'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/app/lib/auth';
import { PhoneValidator } from '@/utils/phoneValidator';
import Link from 'next/link';

// Define proper error type
interface LoginError {
  message: string;
  status?: number;
  code?: string;
}

interface LoginResponse {
  user: any;
  token: string;
}

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Check authentication on component mount
  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      router.replace('/auth/game-dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone number using PhoneValidator
    const phoneValidation = PhoneValidator.validate(phoneNumber);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Invalid phone number');
      return;
    }

    // Validate password
    if (!password) {
      setError('Password is required');
      return;
    }

    // Optional: Add more password validation if needed
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      const userProfile = await AuthService.login({ 
        phoneNumber: phoneValidation.normalizedNumber || phoneNumber, 
        password 
      });
      
      // Log user details
      console.log('Logged in user:', userProfile);
      
      // Redirect to dashboard
      router.push('/auth/game-dashboard');
    } catch (err: unknown) {
      // Detailed error logging
      console.error('Login Error Details:', {
        message: (err as LoginError).message,
        status: (err as LoginError).status,
        code: (err as LoginError).code
      });
      
      // Provide user-friendly error message
      setError((err as LoginError).message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="px-8 py-6">
          <h2 className="text-2xl font-bold text-white text-center mb-6">Sign In</h2>
          
          {error && (
            <div className="bg-red-500 text-white p-3 rounded-md mb-4 text-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+254712345678 or 0712345678"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 
                  transition duration-300 ease-in-out"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 
                  transition duration-300 ease-in-out"
                required
              />
            </div>
            
            <div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md 
                  hover:bg-blue-700 transition duration-300 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Login
              </button>
            </div>
          </form>
          
          <div className="mt-4 text-center">
            <Link 
              href={'/auth/register'} 
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Don&apos;t have an account? Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
