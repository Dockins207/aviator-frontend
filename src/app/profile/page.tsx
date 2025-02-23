'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/app/lib/auth';
import { useWallet } from '@/contexts/WalletContext';
import { toast, Toaster } from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { balance, loading: walletLoading, error: walletError } = useWallet();
  const [loading, setLoading] = useState(true);

  // Form state
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Transaction states
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Redirect to login if not authenticated
        if (!AuthService.isAuthenticated()) {
          router.push('/login');
          return;
        }

        const userProfile = await AuthService.getProfile();
        if (userProfile) {
          setUsername(userProfile.username);
          setPhoneNumber(userProfile.phone_number);
        } else {
          console.error('Failed to fetch user profile');
          toast.error('Unable to load user profile');
        }
      } catch (err: unknown) {
        console.error('Profile Fetch Error:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [router]);

  useEffect(() => {
    if (walletError) {
      toast.error(walletError);
    }
  }, [walletError]);

  // Handle deposit
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid deposit amount');
        return;
      }

      const response = await AuthService.depositFunds(amount);
      toast.success(`Deposit successful. Transaction ID: ${response.transactionId}`);
      setDepositAmount('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    }
  };

  // Handle withdraw
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid withdrawal amount');
        return;
      }

      const response = await AuthService.withdrawFunds(amount);
      toast.success(`Withdrawal successful. Transaction ID: ${response.transactionId}`);
      setWithdrawAmount('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updatedProfile = await AuthService.updateProfile({
        username,
        phoneNumber
      });

      if (updatedProfile) {
        toast.success('Profile updated successfully');
        setUsername(updatedProfile.username);
        setPhoneNumber(updatedProfile.phone_number);
      } else {
        toast.error('Failed to update profile');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
      console.error(err);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    router.push('/login');
  };

  if (loading || walletLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 sm:py-12">
      <div className="max-w-full mx-auto p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">User Profile</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage your account details</p>
        </div>

        {/* User Details Section */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm sm:text-base text-gray-600 font-medium">Username:</span>
              <span className="text-sm sm:text-base text-right text-gray-900 font-semibold">{username || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm sm:text-base text-gray-600 font-medium">Phone Number:</span>
              <span className="text-sm sm:text-base text-right text-gray-900 font-semibold">{phoneNumber || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Wallet Balance Section */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Balance</h3>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Current Balance:</span>
            <span className="text-xl sm:text-2xl font-bold text-blue-600">
              {balance.toLocaleString('en-US', { style: 'currency', currency: 'KES' })}
            </span>
          </div>
        </div>

        {/* Transaction Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {/* Deposit Funds Section */}
          <div className="p-4 w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Deposit Funds</h3>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label htmlFor="depositAmount" className="block text-sm font-medium text-gray-700">
                  Amount (KSH)
                </label>
                <input
                  type="number"
                  id="depositAmount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full py-3 px-4 text-lg rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
                  required
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="submit"
                  className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Deposit
                </button>
              </div>
            </form>
          </div>

          {/* Withdraw Funds Section */}
          <div className="p-4 w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Withdraw Funds</h3>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label htmlFor="withdrawAmount" className="block text-sm font-medium text-gray-700">
                  Amount (KSH)
                </label>
                <input
                  type="number"
                  id="withdrawAmount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full py-3 px-4 text-lg rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
                  required
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="submit"
                  className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Withdraw
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Update Profile Form */}
        <form onSubmit={handleUpdateProfile} className="space-y-4 w-full">
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full py-3 px-4 text-lg rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full py-3 px-4 text-lg rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="flex justify-center">
              <button
                type="submit"
                className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Update Profile
              </button>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Add Toaster component */}
      <Toaster 
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: 'green',
              color: 'white',
            },
          },
          error: {
            style: {
              background: 'red',
              color: 'white',
            },
          },
        }}
      />
    </div>
  );
};

export default ProfilePage;
