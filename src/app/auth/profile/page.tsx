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
                className={`w-full p-2 border rounded ${
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
                className={`w-full p-2 border rounded ${
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
