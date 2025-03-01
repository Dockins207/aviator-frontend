'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/app/lib/auth';
import Link from 'next/link';
import { PhoneValidator } from '@/utils/phoneValidator';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Check authentication on component mount
  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      router.replace('/auth/game-dashboard');
    }
  }, [router]);

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

    try {
      // Validate username
      if (username.length < 3) {
        setError('Username must be at least 3 characters long');
        return;
      }

      // Use the PhoneValidator to normalize the phone number
      const normalizedPhone = PhoneValidator.normalize(phoneNumber);
      if (!normalizedPhone) {
        setError('Invalid phone number. Must be in Kenyan format (+254 or 07XXXXXXXX)');
        return;
      }

      // Validate password
      if (!validatePassword(password)) {
        setError('Password must be at least 8 characters long and include uppercase, lowercase, and number');
        return;
      }

      // Check password match
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      await AuthService.register({ 
        username, 
        phoneNumber: normalizedPhone, 
        password 
      });
      
      // After successful registration, try to log in automatically
      const userProfile = await AuthService.login({ 
        phoneNumber: normalizedPhone, 
        password 
      });
      
      console.log('Registered and logged in user:', userProfile);
      router.push('/auth/game-dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed. Please try again.');
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="px-8 py-6">
          <h2 className="text-2xl font-bold text-white text-center mb-6">Create Account</h2>
          
          {error && (
            <div className="bg-red-500 text-white p-3 rounded-md mb-4 text-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 
                  transition duration-300 ease-in-out"
                required
                minLength={3}
              />
            </div>
            
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
              <p className="mt-1 text-sm text-gray-400">Format: +254712345678 or 0712345678</p>
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
                placeholder="Create a password"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 
                  transition duration-300 ease-in-out"
                required
                minLength={8}
              />
              <p className="mt-1 text-sm text-gray-400">Must include uppercase, lowercase, and number</p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
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
                Register
              </button>
            </div>
          </form>
          
          <div className="mt-4 text-center">
            <Link 
              href="/auth/login" 
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
