import { BetDetails, BetResponse } from '@/types/bet';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import { toast } from 'react-hot-toast';

// Enhanced token management interface
interface TokenManager {
  getToken(): string | null;
  refreshToken(): Promise<string>;
  logout(): void;
}

export interface CashoutStrategy {
  type: 'manual' | 'auto';
  multiplier?: number;
}

export interface CashoutRequest {
  betId: string;
  multiplier: number;
}

// Custom error for validation
class ValidationError extends Error {
  constructor(public code: string, public details?: any) {
    super(details?.message || 'Validation Error');
    this.name = 'ValidationError';
  }
}

export class BettingService {
  private socket: Socket | null = null;
  private static SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';

  constructor() {
    console.log('🚀 BettingService Constructor Called');
    this.initializeSocket();
  }

  // New method to initialize socket from external source
  public initializeSocket(externalSocket?: Socket): void {
    if (this.socket) {
      console.warn('🚨 Socket already initialized. Skipping initialization.');
      return;
    }

    console.log('🔌 Initializing Betting Socket', {
      socketUrl: BettingService.SOCKET_URL,
      externalSocket: !!externalSocket
    });

    if (externalSocket) {
      this.socket = externalSocket;
      this.setupSocketListeners();
      return;
    }

    try {
      const accessToken = AuthService.getToken();
      
      if (!accessToken) {
        console.warn('🚨 No access token available. Socket connection cannot be established.');
        return;
      }

      this.socket = io(BettingService.SOCKET_URL, {
        auth: { token: accessToken },
        extraHeaders: {
          'Authorization': `Bearer ${accessToken}`
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        randomizationFactor: 0.5
      });

      console.log('✅ Socket initialized successfully.');
      this.setupSocketListeners();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('🚨 Comprehensive Socket Initialization Error:', {
          errorType: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('🚨 Socket error:', error);
    });
  }

  async placeBet(betDetails: BetDetails): Promise<BetResponse> {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    // Validate auto cashout settings before sending
    if (betDetails.autoCashoutEnabled && (!betDetails.autoCashoutMultiplier || betDetails.autoCashoutMultiplier <= 1.0)) {
      throw new Error('Auto cashout multiplier must be greater than 1.0');
    }

    // Ensure all values are in the correct format
    const normalizedBet: BetDetails = {
      amount: Number(betDetails.amount),
      autoCashoutEnabled: Boolean(betDetails.autoCashoutEnabled),
      autoCashoutMultiplier: betDetails.autoCashoutEnabled ? Number(betDetails.autoCashoutMultiplier) : undefined
    };

    // Emit the bet placement event
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('placeBet', normalizedBet, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response as BetResponse);
        }
      });
    });
  }
}

export default new BettingService();