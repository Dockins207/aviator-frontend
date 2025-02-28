import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, isAuthenticated } from '../utils/authUtils';
import { AuthService } from '@/app/lib/auth';
import { walletSocket } from '@/services/walletSocket';

interface Transaction {
  transactionId: string;
  amount: number;
  description: string;
  transactionType: string;
  createdAt: string;
}

interface WalletContextType {
  balance: number;
  currency: string;
  userId?: string;
  error: string | null;
  loading: boolean;
  transactions: Transaction[];
  refreshWallet: () => Promise<void>;
  socketConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  const refreshWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure authentication before proceeding
      if (!isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      // Implement timeout and retry mechanism
      const fetchWalletWithTimeout = async (retries = 2) => {
        try {
          const response = await Promise.race([
            api.get('/api/wallet/balance'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Wallet fetch timeout')), 5000)
            )
          ]);

          const walletData = response.data?.wallet;

          if (!walletData) {
            throw new Error('Invalid wallet data');
          }

          return walletData;
        } catch (err) {
          if (retries > 0) {
            console.warn(`Wallet fetch failed, retrying... (${retries} attempts left)`, err);
            return fetchWalletWithTimeout(retries - 1);
          }
          throw err;
        }
      };

      const walletData = await fetchWalletWithTimeout();

      // Update wallet state atomically
      setBalance(Number(walletData.balance || 0));
      setCurrency(walletData.currency || 'USD');
      setUserId(walletData.user_id);
      setTransactions(walletData.transactions || []);
      
    } catch (err) {
      console.error('Wallet refresh error:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh wallet');
      resetWalletState();
    } finally {
      // Ensure loading is always set to false
      setLoading(false);
    }
  };

  const resetWalletState = () => {
    setBalance(0);
    setCurrency('USD');
    setUserId(undefined);
    setTransactions([]);
  };

  useEffect(() => {
    let isMounted = true;
    const connectSocket = async () => {
      try {
        if (!isMounted) return;

        // Ensure authentication
        if (!isAuthenticated()) {
          resetWalletState();
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const token = AuthService.getToken();
        if (!token) {
          throw new Error('No authentication token');
        }

        // Connect socket with comprehensive error handling
        await new Promise<void>((resolve, reject) => {
          walletSocket.connect(token);
          
          // Set up connection listeners with timeout
          const connectionTimeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'));
          }, 5000);

          walletSocket.socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            if (isMounted) {
              setSocketConnected(true);
              resolve();
            }
          });

          walletSocket.socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            reject(error);
          });
        });

        // Refresh wallet after successful socket connection
        await refreshWallet();

      } catch (error) {
        console.error('Socket connection or wallet refresh failed:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Connection failed');
          resetWalletState();
          setSocketConnected(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    connectSocket();

    // Cleanup function
    return () => {
      isMounted = false;
      walletSocket.disconnect();
    };
  }, []);

  const value = {
    balance,
    currency,
    userId,
    error,
    loading,
    transactions,
    refreshWallet,
    socketConnected
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
