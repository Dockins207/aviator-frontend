// Removed TokenManager references
import { io, Socket } from 'socket.io-client';
import type { AxiosError } from 'axios';
import { AuthService } from '@/app/lib/auth';

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
  constructor(public code: string, public details?: { message: string }) {
    super(details?.message || 'Validation Error');
    this.name = 'ValidationError';
  }
}

// Define proper types instead of 'any'
interface BetServiceError {
  message: string;
  code?: string;
  status?: number;
}

interface BetServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface BetDetails {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'won' | 'lost';
  createdAt: Date;
  updatedAt: Date;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier?: number;
}

interface BetResponse {
  success: boolean;
  message?: string;
  data?: BetDetails;
  error?: string;
}

// Add new interface for creating bets
export interface CreateBetDetails {
  amount: number;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier?: number;
}

export class BetService {
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
      socketUrl: BetService.SOCKET_URL,
      externalSocket: !!externalSocket
    });

    if (externalSocket) {
      this.socket = externalSocket;
    } else {
      try {
        const accessToken = AuthService.getToken();
        
        if (!accessToken) {
          console.warn('🚨 No access token available. Socket connection cannot be established.');
          return;
        }

        this.socket = io(BetService.SOCKET_URL, {
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
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.warn('🔌 Socket disconnected:', reason);
    });

    this.socket.on('error', (error: Error) => {
      console.error('🚨 Socket error:', error);
    });
  }

  async placeBet(betDetails: CreateBetDetails): Promise<BetResponse> {
    try {
      // Validate bet amount
      if (!betDetails.amount || betDetails.amount <= 0) {
        throw new ValidationError('INVALID_BET_AMOUNT', { message: 'Bet amount must be greater than 0' });
      }

      // Validate auto cashout settings
      if (betDetails.autoCashoutEnabled && (!betDetails.autoCashoutMultiplier || betDetails.autoCashoutMultiplier <= 1.0)) {
        throw new ValidationError('INVALID_AUTO_CASHOUT_SETTINGS', { message: 'Auto cashout multiplier must be greater than 1.0' });
      }

      // Ensure all values are in the correct format
      const normalizedBet: CreateBetDetails = {
        amount: Number(betDetails.amount),
        autoCashoutEnabled: Boolean(betDetails.autoCashoutEnabled),
        autoCashoutMultiplier: betDetails.autoCashoutEnabled ? Number(betDetails.autoCashoutMultiplier) : undefined
      };

      // Emit the bet placement event
      return new Promise((resolve: (response: BetResponse) => void, reject: (error: Error) => void) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }

        this.socket.emit('placeBet', normalizedBet, (response: BetServiceResponse<BetResponse>) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data as BetResponse);
          }
        });
      });
    } catch (error) {
      return this.handleError(error as BetServiceError);
    }
  }

  private handleError(error: BetServiceError): BetResponse {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      data: undefined
    };
  }

  private handleAxiosError(error: AxiosError): BetResponse {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      data: undefined
    };
  }
}

// Export as a named constant instead of anonymous default
const betService = new BetService();
export default betService;