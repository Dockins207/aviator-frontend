import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, isAuthenticated } from '../utils/authUtils';
import { AuthService } from '@/app/lib/auth';

interface WalletContextType {
  balance: number;
  error: string | null;
  loading: boolean;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshWallet = async () => {
    try {
      setLoading(true);
      // Use new authentication check
      if (!isAuthenticated()) {
        setError('Not authenticated');
        setBalance(0);
        setLoading(false);
        return;
      }

      const response = await api.get('/api/wallet/balance');
      // Ensure balance is a number, default to 0 if not
      const fetchedBalance = Number(response.data?.balance || 0);
      setBalance(isNaN(fetchedBalance) ? 0 : fetchedBalance);
      setError(null);
    } catch (err) {
      console.error('Wallet refresh error:', err);
      setError('Failed to refresh wallet');
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Re-initialize wallet when auth state changes
    if (isAuthenticated()) {
      refreshWallet();
    } else {
      setBalance(0);
      setError('Not authenticated');
      setLoading(false);
    }
  }, []);  // Depends on authentication state

  const value = {
    balance,
    error,
    loading,
    refreshWallet
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
