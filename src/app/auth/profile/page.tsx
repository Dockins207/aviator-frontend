'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService, UserProfile } from '@/app/lib/auth';
import { useWallet } from '@/contexts/WalletContext';
import { toast, Toaster } from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { 
    balance = 0, 
    loading: walletLoading, 
    socketConnected,
    userId
  } = useWallet();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // New state for deposit and withdraw
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactionError, setTransactionError] = useState('');
  const [transactionSuccess, setTransactionSuccess] = useState('');

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Redirect to login if not authenticated
        if (!AuthService.isAuthenticated()) {
          router.push('/login');
          return;
        }

        // Wait for socket connection
        if (!socketConnected) {
          return;
        }

        // Fetch profile
        const profile = await AuthService.getProfile();
        
        if (profile) {
          setUserProfile(profile);
          setUsername(profile.username);
          setPhoneNumber(profile.phone_number);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        // Silent error handling - user stays on page
      }
    };

    fetchProfileData();
  }, [router, socketConnected]);

  const formatBalance = (amount: number) => {
    return `KSH ${amount.toLocaleString('en-KE', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const handleDeposit = async () => {
    try {
      setTransactionError('');
      setTransactionSuccess('');
      const amount = parseFloat(depositAmount);
      
      if (isNaN(amount) || amount <= 0) {
        setTransactionError('Please enter a valid deposit amount');
        return;
      }

      const result = await AuthService.depositFunds(amount);
      setTransactionSuccess(`Deposit of KSH ${amount} successful. Transaction ID: ${result.transactionId}`);
      setDepositAmount('');
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : 'Deposit failed');
    }
  };

  const handleWithdraw = async () => {
    try {
      setTransactionError('');
      setTransactionSuccess('');
      const amount = parseFloat(withdrawAmount);
      
      if (isNaN(amount) || amount <= 0) {
        setTransactionError('Please enter a valid withdrawal amount');
        return;
      }

      const result = await AuthService.withdrawFunds(amount);
      setTransactionSuccess(`Withdrawal of KSH ${amount} successful. Transaction ID: ${result.transactionId}`);
      setWithdrawAmount('');
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : 'Withdrawal failed');
    }
  };

  // Render loading state
  if (walletLoading || !socketConnected) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
        {/* Profile Header */}
        <div className="bg-blue-500 text-white p-6">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-blue-300 rounded-full flex items-center justify-center text-2xl font-bold mr-4">
              {username ? username.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {username || 'Guest User'}
              </h2>
              <p className="text-blue-100">{phoneNumber || 'No phone number'}</p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!editMode}
                className={`w-full p-2 border rounded text-black ${
                  editMode ? 'bg-white' : 'bg-gray-100'
                }`}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={!editMode}
                className={`w-full p-2 border rounded text-black ${
                  editMode ? 'bg-white' : 'bg-gray-100'
                }`}
              />
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Wallet Balance</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatBalance(balance)}
            </p>
          </div>

          {/* Wallet Transactions Section */}
          <div className="p-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Transactions</h3>
            
            {/* Transaction Feedback */}
            {transactionError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                {transactionError}
              </div>
            )}
            {transactionSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                {transactionSuccess}
              </div>
            )}

            {/* Deposit Section */}
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">Deposit Funds</label>
              <div className="flex">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter deposit amount"
                  className="w-full p-2 border rounded-l text-black"
                  min="0"
                  step="0.01"
                />
                <button 
                  onClick={handleDeposit}
                  className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600"
                >
                  Deposit
                </button>
              </div>
            </div>

            {/* Withdraw Section */}
            <div>
              <label className="block text-gray-700 font-bold mb-2">Withdraw Funds</label>
              <div className="flex">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter withdrawal amount"
                  className="w-full p-2 border rounded-l text-black"
                  min="0"
                  step="0.01"
                  max={balance}
                />
                <button 
                  onClick={handleWithdraw}
                  className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setEditMode(!editMode)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {editMode ? 'Cancel' : 'Edit Profile'}
            </button>
            {editMode && (
              <button
                onClick={() => {
                  // Implement save profile logic
                  setEditMode(false);
                }}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
