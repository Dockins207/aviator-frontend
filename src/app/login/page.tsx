'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '../lib/auth';
import Link from 'next/link';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Check authentication on component mount
  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      router.replace('/game-dashboard');
    }
  }, [router]);

  const validatePhoneNumber = (phone: string): boolean => {
    // Support formats: +254712345678, 0712345678, 0112345678
    const phoneRegex = /^(\+?254|0)1?[17]\d{8}$/;
    return phoneRegex.test(phone);
  };

  const validatePassword = (pass: string): boolean => {
    // At least 8 characters, must include:
    // - At least one uppercase letter
    // - At least one lowercase letter
    // - At least one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone number
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Invalid phone number. Must be in Kenyan format (+254 or 07XXXXXXXX)');
      return;
    }

    // Validate password
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters long and include uppercase, lowercase, and number');
      return;
    }

    try {
      const loginResponse = await AuthService.login({ phoneNumber, password });
      
      // Destructure user details from login response
      const { user } = loginResponse;
      
      // Optional: Log user details or perform additional actions
      console.log('Logged in user:', user);
      
      // Redirect to dashboard
      router.push('/game-dashboard');
    } catch (err: any) {
      // Detailed error logging
      console.error('Login Error Details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      // Provide user-friendly error message
      setError(
        err.response?.data?.message || 
        err.message || 
        'Login failed. Please check your credentials.'
      );
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
                placeholder="+254712345678"
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
              href="/register" 
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Don't have an account? Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
