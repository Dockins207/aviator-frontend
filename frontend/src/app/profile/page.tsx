'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService, UserProfile, WalletBalanceResponse } from '@/app/lib/auth';

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Transaction states
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // Fetch wallet balance dynamically
  const fetchWalletBalance = async () => {
    try {
      const balance = await AuthService.getWalletBalance();
      if (balance) {
        setWalletBalance(balance.balance);
      }
    } catch (err) {
      console.error('Failed to fetch wallet balance', err);
    }
  };

  // Fetch wallet balance periodically
  useEffect(() => {
    // Initial fetch
    fetchWalletBalance();

    // Set up periodic refresh every 30 seconds
    const intervalId = setInterval(fetchWalletBalance, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Check authentication and fetch profile
    const fetchProfileData = async () => {
      try {
        // Redirect to login if not authenticated
        if (!AuthService.isAuthenticated()) {
          router.push('/login');
          return;
        }

        // Fetch user profile
        const userProfile = await AuthService.getProfile();

        if (userProfile) {
          setProfile(userProfile);
          setUsername(userProfile.username);
          setPhoneNumber(userProfile.phone_number);
        } else {
          console.error('Failed to fetch user profile');
          setError('Unable to load user profile');
        }

        // Fetch wallet balance
        await fetchWalletBalance();
      } catch (err: any) {
        console.error('Profile Fetch Error:', err);
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [router]);

  // Handle deposit
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransactionError(null);
    setTransactionSuccess(null);

    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        setTransactionError('Please enter a valid deposit amount');
        return;
      }

      const response = await AuthService.depositFunds(amount);
      
      setTransactionSuccess(`Deposit successful. Transaction ID: ${response.transactionId}`);
      
      // Explicitly set the new balance
      if (response.newBalance !== undefined) {
        setWalletBalance(response.newBalance);
      } else {
        // Fallback to refetching balance if newBalance is not provided
        await fetchWalletBalance();
      }
      
      setDepositAmount('');
    } catch (err: any) {
      setTransactionError(err.response?.data?.message || 'Deposit failed');
    }
  };

  // Handle withdraw
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransactionError(null);
    setTransactionSuccess(null);

    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        setTransactionError('Please enter a valid withdrawal amount');
        return;
      }

      const response = await AuthService.withdrawFunds(amount);
      
      setTransactionSuccess(`Withdrawal successful. Transaction ID: ${response.transactionId}`);
      
      // Explicitly set the new balance
      if (response.newBalance !== undefined) {
        setWalletBalance(response.newBalance);
      } else {
        // Fallback to refetching balance if newBalance is not provided
        await fetchWalletBalance();
      }
      
      setWithdrawAmount('');
    } catch (err: any) {
      setTransactionError(err.response?.data?.message || 'Withdrawal failed');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updatedProfile = await AuthService.updateProfile({
        username,
        phoneNumber
      });

      setProfile(updatedProfile);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
      console.error(err);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    router.push('/login');
  };

  const displayWalletBalance = () => {
    // Ensure walletBalance is a number before calling toFixed()
    if (walletBalance !== null && typeof walletBalance === 'number') {
      return `${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KSH`;
    }
    return 'Loading...';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">User Profile</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage your account details</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            {error}
          </div>
        )}

        {/* User Details Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
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
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Balance</h3>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Current Balance:</span>
            <span className="text-xl sm:text-2xl font-bold text-blue-600">
              {displayWalletBalance()}
            </span>
          </div>
        </div>

        {/* Transaction Error/Success Messages */}
        {transactionError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            {transactionError}
          </div>
        )}
        {transactionSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            {transactionSuccess}
          </div>
        )}

        {/* Transaction Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deposit Funds Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Deposit
              </button>
            </form>
          </div>

          {/* Withdraw Funds Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Withdraw
              </button>
            </form>
          </div>
        </div>

        {/* Update Profile Form */}
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Update Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
