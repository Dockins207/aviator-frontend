import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AuthService } from '@/app/lib/auth';

const BalanceDisplay: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBalance = async () => {
    try {
      // Get token from AuthService
      const token = AuthService.getToken();
      
      // Use environment variable for backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      
      // Validate token and backend URL
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      if (!backendUrl) {
        throw new Error('Backend URL is not configured');
      }

      // Make API call with full /api path
      const response = await axios.get(`${backendUrl}/api/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Validate response
      if (response.data && response.data.data && response.data.data.balance !== undefined) {
        setBalance(response.data.data.balance);
        setError(null);
      } else {
        throw new Error('Invalid balance response');
      }
    } catch (err: any) {
      // Detailed error handling
      console.error('Failed to fetch balance', err);
      
      // Set specific error message
      if (err.response) {
        // The request was made and the server responded with a status code
        console.error('Server response error:', err.response.data);
        setError(`Server error: ${err.response.status}`);
      } else if (err.request) {
        // The request was made but no response was received
        console.error('No response received');
        setError('No response from server');
      } else {
        // Something happened in setting up the request
        console.error('Error setting up request', err.message);
        setError(err.message || 'Unable to fetch balance');
      }
      
      // Reset balance
      setBalance(null);
    } finally {
      // Always set loading to false
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if authenticated
    if (AuthService.isAuthenticated()) {
      fetchBalance();
    } else {
      setLoading(false);
    }
  }, []);

  // Render logic with comprehensive error and loading states
  if (loading) {
    return <div className="text-white text-sm">Loading balance...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-sm">Balance unavailable</div>;
  }

  if (balance === null) {
    return <div className="text-white text-sm">-</div>;
  }

  return (
    <div className="balance-display text-white text-sm">
      Balance: KSH {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  );
};

export default BalanceDisplay;
