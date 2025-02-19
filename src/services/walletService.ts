import io, { Socket } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import toast from 'react-hot-toast';
import axios from 'axios'; // Import axios

// Wallet update interface
export interface WalletUpdate {
  userId: string;
  balance: number;
  formattedBalance: string;
  previousBalance?: number;
  transactionType: string;
  timestamp: string;
  amount?: number;
  gameId?: string;
  multiplier?: number;
  currency: string;  // Add currency property
}

// Bet placement interface
export interface BetPlacementData {
  amount: number;
  gameId: string;
}

// Cashout interface
export interface CashoutData {
  amount: number;
  gameId: string;
}

// Wallet balance response interface
export interface WalletBalanceResponse {
  user_id: string;
  balance: number;
  currency: string;
  formattedBalance?: string;
}

// Enhanced wallet update interface to match backend payload
export interface WalletUpdatePayload {
  userId: string;
  balance: number;
  formattedBalance: string;
  previousBalance?: number;
  transactionType: string;
  timestamp: string;
  amount?: number;
  gameId?: string;
  multiplier?: number;
  currency: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000'; // Define BASE_URL

class WalletService {
  private socket: Socket | null = null;
  private socketInitPromise: Promise<Socket> | null = null;
  private currentBalance: number = 0;
  private balanceCheckInterval: NodeJS.Timeout | null = null;

  // Global state management for wallet updates
  private walletUpdateState: {
    subscribers: Set<(update: WalletUpdatePayload) => void>;
    lastUpdate: WalletUpdatePayload | null;
  } = {
    subscribers: new Set(),
    lastUpdate: null
  };

  // Enhanced real-time balance update method
  public setupWalletUpdateListener(
    callback: (update: WalletUpdatePayload) => void,
    userId?: string
  ): () => void {
    // Add subscriber to global state
    this.walletUpdateState.subscribers.add(callback);

    // If there's a last known update, immediately call the callback
    if (this.walletUpdateState.lastUpdate) {
      callback(this.walletUpdateState.lastUpdate);
    }

    // Ensure socket is initialized
    if (!this.socket) {
      this.initializeSocket().then(() => {
        this.setupSocketListeners(userId);
      }).catch(error => {
        console.error('Failed to initialize socket:', error);
      });
    } else {
      this.setupSocketListeners(userId);
    }

    // Return cleanup function
    return () => {
      this.walletUpdateState.subscribers.delete(callback);
    };
  }

  // Centralized socket listeners for wallet updates
  private setupSocketListeners(userId?: string): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }

    // Listen for wallet balance updates
    this.socket.on('wallet:balance_updated', (payload: WalletUpdatePayload) => {
      // Optional: Filter by user ID if provided
      if (userId && payload.userId !== userId) {
        return;
      }

      // Update global state
      this.walletUpdateState.lastUpdate = payload;

      // Broadcast to all subscribers
      this.walletUpdateState.subscribers.forEach(subscriber => {
        try {
          subscriber(payload);
        } catch (error) {
          console.error('Error in wallet update subscriber:', error);
        }
      });

      // Optional: Log for diagnostics
      console.group('💰 Wallet Balance Update');
      console.log('User ID:', payload.userId);
      console.log('New Balance:', payload.balance);
      console.log('Transaction Type:', payload.transactionType);
      console.log('Timestamp:', payload.timestamp);
      console.groupEnd();
    });

    // Error handling for socket
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });
  }

  // Utility method to format balance consistently
  public formatBalance(
    balance: number, 
    currency: string = 'KSH'
  ): string {
    // Use toLocaleString with comprehensive formatting options
    const formattedNumber = balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true  // Explicitly enable grouping (commas)
    });

    // Combine currency with formatted number
    return `${currency} ${formattedNumber}`;
  }

  // Enhanced socket initialization with comprehensive debugging
  public initializeSocket(): Promise<Socket> {
    // If socket initialization is already in progress, return the existing promise
    if (this.socketInitPromise) {
      return this.socketInitPromise;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';

    this.socketInitPromise = new Promise((resolve, reject) => {
      // Get the JWT token from AuthService
      const token = AuthService.getToken();

      if (!token) {
        reject(new Error('No authentication token found'));
        return;
      }

      // Initialize socket with token
      const socket = io(backendUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log('Wallet socket connected');
        this.socket = socket;
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });
    });

    return this.socketInitPromise;
  }

  private handleSocketError(error: unknown): void {
    if (error instanceof Error) {
      console.error('Socket Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else if (typeof error === 'string') {
      console.error('Socket Error (string):', error);
    } else {
      console.error('Unknown Socket Error:', JSON.stringify(error));
    }
  }

  // Comprehensive wallet balance retrieval
  async getWalletBalance(): Promise<WalletBalanceResponse | null> {
    try {
      const token = AuthService.getToken();
      if (!token) {
        console.warn('🚨 No authentication token found for wallet balance');
        return null;
      }

      const response = await axios.get(`${BASE_URL}/api/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Validate response structure with new API format
      if (response.data && response.data.status === 'success' && response.data.wallet) {
        const { 
          balance, 
          currency = 'KSH', 
          userId,  
          formattedBalance  
        } = response.data.wallet;
        
        // Convert balance to number, handling potential string input
        const numericBalance = typeof balance === 'string' 
          ? parseFloat(balance) 
          : balance;

        if (!isNaN(numericBalance) && typeof currency === 'string' && userId) {
          const walletUpdate: WalletBalanceResponse = {
            user_id: userId,
            balance: numericBalance,
            currency: currency,
            formattedBalance: formattedBalance || this.formatBalance(numericBalance)
          };

          // Log wallet balance retrieval for diagnostics
          console.group('💰 Wallet Balance Retrieved');
          console.log('Balance:', walletUpdate.balance);
          console.log('User ID:', walletUpdate.user_id);
          console.log('Currency:', walletUpdate.currency);
          console.groupEnd();

          return walletUpdate;
        }
      }
      
      console.warn('🚨 Invalid wallet balance response structure');
      return null;
    } catch (error: any) {
      console.group('🚨 Wallet Balance Retrieval Error');
      console.error('Error Details:', {
        message: error.response?.data || error.message,
        status: error.response?.status
      });
      console.groupEnd();
      
      // If token is invalid or expired, remove it
      if (error.response?.status === 401) {
        AuthService.removeToken();
      }
      
      return null;
    }
  }

  // Fetch current wallet balance with formatting
  async fetchCurrentBalance(): Promise<number> {
    try {
      const walletBalance = await this.getWalletBalance();
      return walletBalance ? walletBalance.balance : 0;
    } catch (error) {
      console.error('Failed to fetch current balance:', error);
      return 0;
    }
  }

  // Fallback method to get user ID
  async getUserId(): Promise<string> {
    try {
      const walletBalance = await this.getWalletBalance();
      if (!walletBalance || !walletBalance.user_id) {
        throw new Error('Unable to retrieve user ID');
      }
      return walletBalance.user_id;
    } catch (error) {
      console.error('Failed to get user ID:', error);
      throw error;
    }
  }

  // Immediate balance fetch method
  async fetchImmediateBalance(): Promise<number> {
    try {
      const response = await axios.get(`${BASE_URL}/api/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${AuthService.getToken()}`
        }
      });
      return response.data.wallet.balance;
    } catch (error) {
      console.error('Immediate balance fetch failed:', error);
      return this.currentBalance; // Fallback to last known balance
    }
  }

  // Generic method to emit socket events with type safety and error handling
  private async emitSocketEvent<T>(
    eventName: string, 
    data: any
  ): Promise<T | null> {
    try {
      // Ensure socket is initialized
      if (!this.socket) {
        await this.initializeSocket();
      }

      // Validate socket existence
      if (!this.socket) {
        throw new Error('Socket failed to initialize');
      }

      return new Promise((resolve, reject) => {
        // Emit the event with a timeout
        this.socket?.emit(eventName, data, (response: T | { error: string }) => {
          // Type guard to check for error object
          const isErrorResponse = (resp: any): resp is { error: string } => 
            resp !== null && 
            typeof resp === 'object' && 
            'error' in resp && 
            typeof resp.error === 'string';

          if (isErrorResponse(response)) {
            console.error(`${eventName} event error:`, response.error);
            toast.error(response.error);
            reject(response.error);
          } else {
            resolve(response as T);
          }
        });

        // Set a timeout for the socket event
        setTimeout(() => {
          reject(new Error('Socket event timed out'));
        }, 10000); // 10 seconds timeout
      });
    } catch (error) {
      console.error(`Failed to emit ${eventName} event:`, error);
      toast.error('Network error occurred');
      return null;
    }
  }

  // Place a bet via socket
  public async placeBet(betData: BetPlacementData): Promise<WalletUpdate | null> {
    try {
      const userId = await this.getUserId();
      const response = await this.emitSocketEvent<WalletBalanceResponse>('place_bet', {
        ...betData,
        userId
      });

      if (response) {
        const walletUpdate: WalletUpdate = {
          ...response,
          userId: response.user_id || userId,
          formattedBalance: this.formatBalance(response.balance, response.currency),
          currency: response.currency || 'KSH',  // Add currency with fallback
          transactionType: 'bet',
          timestamp: new Date().toISOString(),
          amount: betData.amount,
          gameId: betData.gameId
        };

        toast.success('Bet placed successfully');
        
        // Broadcast the wallet update
        this.broadcastBetUpdate(
          walletUpdate.userId, 
          betData.amount, 
          betData.gameId
        );

        return walletUpdate;
      }
      return null;
    } catch (error) {
      console.error('Bet placement error:', error);
      toast.error('Failed to place bet');
      return null;
    }
  }

  // Perform cashout via socket
  public async cashout(cashoutData: CashoutData): Promise<void> {
    try {
      const userId = await this.getUserId();
      const response = await this.emitSocketEvent<WalletBalanceResponse>('cashout', {
        ...cashoutData,
        userId
      });

      if (response) {
        const walletUpdate: WalletUpdate = {
          ...response,
          userId: response.user_id || userId,
          formattedBalance: this.formatBalance(response.balance, response.currency),
          currency: response.currency || 'KSH',
          transactionType: 'cashout',
          timestamp: new Date().toISOString(),
          amount: cashoutData.amount,
          gameId: cashoutData.gameId
        };

        toast.success('Cashout successful');
        
        // Broadcast the wallet update
        this.broadcastCashoutUpdate(
          walletUpdate.userId, 
          cashoutData.amount, 
          cashoutData.gameId
        );
      }
    } catch (error) {
      console.error('Cashout error:', error);
      toast.error('Failed to perform cashout');
    }
  }

  // Broadcast wallet update for bets
  public broadcastBetUpdate(
    userId: string, 
    amount: number, 
    gameId: string,
    transactionType: string = 'bet'
  ): void {
    try {
      // Fetch the latest balance
      this.fetchImmediateBalance().then(latestBalance => {
        // Check if balance has meaningfully changed
        if (Math.abs(latestBalance - this.currentBalance) > 0.01) {
          this.currentBalance = latestBalance;
          
          // Explicitly format the balance
          const formattedBalance = this.formatBalance(latestBalance, 'KSH');
          
          console.group('💰 Bet Update Debug');
          console.log('Raw Balance:', latestBalance);
          console.log('Formatted Balance:', formattedBalance);
          console.groupEnd();

          const completeUpdate: WalletUpdatePayload = {
            userId: userId,
            balance: latestBalance,
            formattedBalance: formattedBalance,
            transactionType: transactionType,
            timestamp: new Date().toISOString(),
            amount: amount,
            gameId: gameId,
            previousBalance: this.currentBalance,
            currency: 'KSH'
          };
          
          this.walletUpdateState.subscribers.forEach(callback => {
            callback(completeUpdate);
          });
        }
      }).catch(error => {
        console.error('Failed to broadcast bet update:', error);
      });
    } catch (error) {
      console.error('Bet update broadcast error:', error);
    }
  }

  // Broadcast wallet update for cashouts
  public broadcastCashoutUpdate(
    userId: string, 
    winnings: number, 
    gameId: string,
    multiplier?: number
  ): void {
    try {
      // Fetch the latest balance
      this.fetchImmediateBalance().then(latestBalance => {
        // Check if balance has meaningfully changed
        if (Math.abs(latestBalance - this.currentBalance) > 0.01) {
          this.currentBalance = latestBalance;
          
          // Explicitly format the balance
          const formattedBalance = this.formatBalance(latestBalance, 'KSH');
          
          console.group('💰 Cashout Update Debug');
          console.log('Raw Balance:', latestBalance);
          console.log('Formatted Balance:', formattedBalance);
          console.groupEnd();

          const completeUpdate: WalletUpdatePayload = {
            userId: userId,
            balance: latestBalance,
            formattedBalance: formattedBalance,
            transactionType: 'cashout',
            timestamp: new Date().toISOString(),
            amount: winnings,
            gameId: gameId,
            multiplier: multiplier,
            previousBalance: this.currentBalance,
            currency: 'KSH'
          };
          
          this.walletUpdateState.subscribers.forEach(callback => {
            callback(completeUpdate);
          });
        }
      }).catch(error => {
        console.error('Failed to broadcast cashout update:', error);
      });
    } catch (error) {
      console.error('Cashout update broadcast error:', error);
    }
  }

  // Private method to emit wallet updates
  private emitWalletUpdate(update: WalletUpdate): void {
    // Emit wallet update via socket
    this.socket?.emit('wallet_update', update);
  }

  // Periodic balance reconciliation
  private startPeriodicBalanceCheck() {
    // Clear any existing interval
    if (this.balanceCheckInterval) {
      clearInterval(this.balanceCheckInterval);
    }

    // Check balance every 5 seconds
    this.balanceCheckInterval = setInterval(async () => {
      try {
        // Fetch immediate balance and user ID together
        const [latestBalance, userId] = await Promise.all([
          this.fetchImmediateBalance(),
          this.getUserId()
        ]);
        
        // Only update and notify if balance has changed
        if (Math.abs(latestBalance - this.currentBalance) > 0.01) {
          this.currentBalance = latestBalance;
          
          const completeUpdate: WalletUpdatePayload = {
            userId: userId,
            balance: latestBalance,
            formattedBalance: this.formatBalance(latestBalance),
            transactionType: 'periodic_check',
            timestamp: new Date().toISOString(),
            previousBalance: this.currentBalance,
            currency: 'KSH'  // Add default currency
          };
          
          this.walletUpdateState.subscribers.forEach(callback => {
            callback(completeUpdate);
          });
        }
      } catch (error) {
        console.error('Periodic balance check failed:', error);
      }
    }, 5000); // 5-second interval
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.socketInitPromise = null;
    }
  }

  // Enhanced wallet update subscription
  subscribeToWalletUpdates(callback: (update: WalletUpdatePayload) => void): () => void {
    // Add the callback to subscribers
    this.walletUpdateState.subscribers.add(callback);

    // Ensure socket is initialized and listeners are set up
    if (!this.socket) {
      this.initializeSocket()
        .then(() => {
          this.setupWalletUpdateListener(callback);
        })
        .catch(error => {
          console.error('Failed to initialize socket for wallet updates:', error);
        });
    } else {
      // If socket already exists, ensure listeners are set up
      this.setupWalletUpdateListener(callback);
    }

    // Return unsubscribe function
    return () => {
      this.walletUpdateState.subscribers.delete(callback);
      
      // Optional: Disconnect socket if no more subscribers
      if (this.walletUpdateState.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }
}

export default new WalletService();
