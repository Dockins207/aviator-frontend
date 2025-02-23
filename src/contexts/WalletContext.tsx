import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { walletSocket } from '../services/walletSocket';
import { AuthService } from '@/app/lib/auth';

interface WalletContextType {
  balance: number;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const walletBalance = await AuthService.getWalletBalance();
      if (walletBalance) {
        setBalance(walletBalance.balance);
        setError(null);
      }
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      setError('Failed to fetch wallet balance');
    }
  }, []);

  const handleWalletUpdate = useCallback((data: { balance: number }) => {
    console.log('Handling wallet update:', data);
    setBalance(data.balance);
    setError(null);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeWallet = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated
        if (!AuthService.isAuthenticated()) {
          setError('Not authenticated');
          return;
        }

        // Get the token
        const token = AuthService.getToken();
        if (!token) {
          setError('Authentication token not found');
          return;
        }

        // Initialize socket connection
        walletSocket.connect(token);

        // Set up wallet update listener
        unsubscribe = walletSocket.addListener(handleWalletUpdate);

        // Fetch initial balance
        await refreshBalance();
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setError('Failed to initialize wallet');
      } finally {
        setLoading(false);
      }
    };

    initializeWallet();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      walletSocket.disconnect();
    };
  }, [handleWalletUpdate, refreshBalance]);

  // Re-initialize wallet when auth state changes
  useEffect(() => {
    const checkAuthInterval = setInterval(() => {
      if (!AuthService.isAuthenticated() && balance !== 0) {
        setBalance(0);
        setError('Not authenticated');
        walletSocket.disconnect();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkAuthInterval);
  }, [balance]);

  return (
    <WalletContext.Provider value={{ balance, loading, error, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
