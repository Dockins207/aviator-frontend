import { io, Socket } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import { api, getToken } from '../utils/authUtils';

// Add type declarations for environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_WEBSOCKET_URL?: string;
      NEXT_PUBLIC_BACKEND_URL?: string;
    }
  }
}

// Define specific error types for socket and bet-related errors
export interface BetDetails {
  amount: number;
  autoCashoutMultiplier?: number;
}

export interface BetResponse {
  success: boolean;
  message?: string;
  data?: Record<string, any>;
}

export interface BetPlacementResponse extends BetResponse {
  data?: {
    betId?: number;
    [key: string]: any;
  };
}

export interface SocketError extends Error {
  name: string;
  message: string;
  stack?: string;
  socketId?: string;
  timestamp?: string;
  currentMultiplier?: number;
}

export interface BetError extends SocketError {
  betId?: number;
  amount?: number;
  autoCashoutMultiplier?: number;
}

export class BetServiceError extends Error {
  constructor(
    public message: string, 
    public details?: Partial<BetError>
  ) {
    super(message);
    this.name = 'BetServiceError';
  }
}

export class SocketConnectionError extends Error {
  constructor(
    public message: string, 
    public details?: Partial<SocketError>
  ) {
    super(message);
    this.name = 'SocketConnectionError';
  }
}

// Define the event map for our socket instance
export interface ServerToClientEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: string) => void;
  error: (err: Error) => void;
  betPlaced: (data: BetPlacementResponse) => void;
  betError: (error: { message: string }) => void;
  cashout: (response: BetResponse) => void;
  gameStateChange: (state: string) => void;
  multiplierUpdate: (multiplier: number) => void;
  activateCashout: (data: { token: string; betId: number }) => void;
}

export interface ClientToServerEvents {
  placeBet: (data: { 
    token: string; 
    amount: number; 
    autoCashoutMultiplier?: number 
  }, callback: (response: BetPlacementResponse) => void) => void;
  cashout: (data: { 
    token: string; 
    betId: number; 
    currentMultiplier: number 
  }, callback: (response: BetResponse) => void) => void;
  cashoutWithToken: (data: {
    cashoutToken: string;
    betId: number;
  }, callback: (response: BetResponse) => void) => void;
}

// Define socket data interface
export interface SocketData {
  token?: string;
}

// Define socket options interface
export interface SocketOptions {
  // Authentication and custom headers
  auth?: {
    token?: string;
    authorization?: string;
    [key: string]: any;
  };
  extraHeaders?: Record<string, string>;
  query?: Record<string, string | number | boolean>;

  // Connection options
  forceNew?: boolean;
  multiplex?: boolean;
  path?: string;
  transports?: string[];
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  randomizationFactor?: number;
  timeout?: number;
  autoConnect?: boolean;

  // Additional socket.io options from ManagerOptions and SocketOptions
  pingTimeout?: number;
  pingInterval?: number;
  upgradeTimeout?: number;
  maxHttpBufferSize?: number;
  parser?: any;
}

export class BetService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private socketInstance: Socket<ServerToClientEvents, ClientToServerEvents>;

  private static SOCKET_URL: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  constructor() {
    console.log('🚀 Initializing BetService', {
      socketUrl: BetService.SOCKET_URL,
      timestamp: new Date().toISOString()
    });

    // Enhanced token retrieval and validation
    const token: string | null = getToken();
    
    console.group('🔐 Socket Authentication Setup');
    console.log('Token Details:', {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 'N/A',
      tokenFirstChars: token ? token.substring(0, 10) : 'N/A',
      tokenLastChars: token ? token.substring(token.length - 10) : 'N/A'
    });

    // Ensure token is properly formatted for JWT verification
    const cleanToken: string = token 
      ? (token.startsWith('Bearer ') 
        ? token.split(' ')[1] 
        : token)
      : '';

    console.log('Clean Token Details:', {
      cleanTokenLength: cleanToken.length,
      firstChars: cleanToken ? cleanToken.substring(0, 10) : 'N/A'
    });
    console.groupEnd();

    if (!cleanToken) {
      console.warn('🚨 No valid authentication token found');
    }

    // Use SocketOptions instead of SocketOptionsWithExtraHeaders
    const socketOptions: SocketOptions = {
      // Authentication methods
      auth: {
        token: cleanToken,
        authorization: `Bearer ${cleanToken}`
      },
      
      // Extra headers for authorization
      extraHeaders: {
        Authorization: `Bearer ${cleanToken}`
      },
      
      // Query parameters
      query: {
        token: cleanToken
      },
      
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      
      // Transport options
      transports: ['websocket', 'polling'],
      timeout: 20000,
      
      // Additional socket.io options
      forceNew: false,
      multiplex: true,
      path: '/socket.io',
      autoConnect: true
    };

    // Initialize socket with proper types
    this.socketInstance = io(BetService.SOCKET_URL, socketOptions);
    this.socket = this.socketInstance as Socket<ServerToClientEvents, ClientToServerEvents>;

    // Set up default socket event handlers
    this.socketInstance.on('connect', () => {
      console.log('🌐 Socket Connected', {
        socketId: this.socketInstance.id,
        timestamp: new Date().toISOString()
      });
    });

    this.socketInstance.on('connect_error', (err: Error) => {
      const socketError: SocketError = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      };
      console.group('❌ Socket Connection Error');
      console.error('Detailed Error:', {
        name: socketError.name,
        message: socketError.message,
        stack: socketError.stack,
        socketUrl: BetService.SOCKET_URL,
        timestamp: new Date().toISOString()
      });
      console.groupEnd();
      throw new SocketConnectionError('Socket connection error', socketError);
    });

    this.setupSocketListeners();
  }

  private reconnectSocket() {
    const token = getToken();
    if (!token) {
      console.warn('🚨 No valid authentication token found for reconnection');
      return;
    }

    // Clean the token
    const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    // Update socket options
    const socketOptions: SocketOptions = {
      auth: {
        token: cleanToken,
        authorization: `Bearer ${cleanToken}`
      },
      extraHeaders: {
        Authorization: `Bearer ${cleanToken}`
      },
      query: {
        token: cleanToken
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true, // Force new connection
      multiplex: true,
      path: '/socket.io',
      autoConnect: true
    };

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    // Create new socket connection
    this.socketInstance = io(BetService.SOCKET_URL, socketOptions);
    this.socket = this.socketInstance as Socket<ServerToClientEvents, ClientToServerEvents>;

    // Set up event handlers
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // Game-specific event handlers
    this.socketInstance.on('betPlaced', (response: BetPlacementResponse) => {
      console.log('Bet placed event received:', response);
    });

    this.socketInstance.on('cashout', (response: BetResponse) => {
      console.log('Cashout event received:', response);
    });

    this.socketInstance.on('activateCashout', (data: { token: string; betId: number }) => {
      console.log('Cashout activation received:', data);
      // The event will be forwarded to any components listening for it
    });

    this.socketInstance.on('error', (error: any) => {
      console.error('Socket error event:', error);
    });

    this.socketInstance.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, you need to reconnect manually
        this.socket.connect();
      }
    });
  }

  // Public method to add socket event listeners
  public addSocketListener(event: keyof ServerToClientEvents, listener: ServerToClientEvents[typeof event]) {
    this.socketInstance.on(event, listener);
  }

  // Public method to remove socket event listeners
  public removeSocketListener(event: keyof ServerToClientEvents, listener: ServerToClientEvents[typeof event]) {
    this.socketInstance.off(event, listener);
  }

  // Public method to get socket instance for more complex interactions
  public getSocketInstance(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return this.socketInstance;
  }

  // Public method to add socket event listeners
  public on(event: keyof ServerToClientEvents, listener: ServerToClientEvents[typeof event]) {
    this.socketInstance.on(event, listener);
    return this;
  }

  // Public method to remove socket event listeners
  public off(event: keyof ServerToClientEvents, listener: ServerToClientEvents[typeof event]) {
    this.socketInstance.off(event, listener);
    return this;
  }

  // Type-safe emit method
  public emit<T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ): void {
    this.socketInstance.emit(event, ...args);
  }

  // Public method to get socket connection status
  public isConnected(): boolean {
    return this.socketInstance.connected;
  }

  public async placeBet(betDetails: BetDetails): Promise<BetPlacementResponse> {
    console.group('🎲 Bet Placement Initiation');
    console.log('Initial Bet Details:', betDetails);

    // Check authentication first
    const isAuthenticated = AuthService.isAuthenticated();
    console.log('Authentication Status:', {
      isAuthenticated,
      method: 'AuthService.isAuthenticated()'
    });

    if (!isAuthenticated) {
      console.error('🚨 Authentication Failed');
      throw new BetServiceError('Authentication required');
    }

    // Get fresh token
    const token = getToken();
    console.log('Token Retrieval:', {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 'N/A'
    });

    if (!token) {
      console.error('🚨 No Valid Token Found');
      throw new BetServiceError('No valid token found');
    }

    // Log authentication details
    console.log('Token Details:', {
      tokenPresent: !!token,
      tokenLength: token.length,
      tokenFirstChars: token.substring(0, 10),
      tokenLastChars: token.substring(token.length - 10),
      isBearer: token.startsWith('Bearer ')
    });

    // Clean the token
    const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    console.log('Clean Token Details:', {
      cleanTokenLength: cleanToken.length,
      firstChars: cleanToken.substring(0, 10)
    });

    // Ensure socket is connected with latest token
    console.log('Socket Connection Status:', {
      connected: this.socket?.connected,
      socketId: this.socket?.id
    });

    if (!this.socket?.connected) {
      console.log('🔄 Attempting Socket Reconnection');
      this.reconnectSocket();
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('🕒 Socket Connection Timeout');
          reject(new Error('Socket connection timeout'));
        }, 5000);

        this.socket.once('connect', () => {
          console.log('🌐 Socket Reconnected Successfully');
          clearTimeout(timeout);
          resolve();
        });

        this.socket.once('connect_error', (error) => {
          console.error('❌ Socket Connection Error:', error);
          clearTimeout(timeout);
          reject(error);
        });
      });
    }

    // Place bet with fresh token
    return new Promise((resolve, reject) => {
      try {
        // Log bet payload details
        console.log('📤 Bet Payload:', {
          amount: betDetails.amount,
          autoCashoutMultiplier: betDetails.autoCashoutMultiplier,
          tokenFirstChars: cleanToken.substring(0, 10)
        });

        // Emit bet with token
        this.emit('placeBet', {
          token: cleanToken,
          amount: betDetails.amount,
          autoCashoutMultiplier: betDetails.autoCashoutMultiplier
        }, (response: BetPlacementResponse) => {
          console.log('📥 Bet Placement Response:', response);
          console.groupEnd();

          if (response.success) {
            resolve(response);
          } else {
            reject(new BetServiceError(response.message || 'Failed to place bet', {
              amount: betDetails.amount,
              autoCashoutMultiplier: betDetails.autoCashoutMultiplier
            }));
          }
        });
      } catch (error) {
        console.error('❌ Bet Placement Error:', error);
        console.groupEnd();
        reject(new BetServiceError('Error placing bet', {
          message: error instanceof Error ? error.message : 'Unknown error',
          amount: betDetails.amount,
          autoCashoutMultiplier: betDetails.autoCashoutMultiplier
        }));
      }
    });
  }

  async cashout(betId: number, currentMultiplier: number): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Validate inputs
      if (!betId) {
        reject(new BetServiceError('Invalid bet ID', {
          betId,
          currentMultiplier
        }));
        return;
      }

      if (currentMultiplier <= 0) {
        reject(new BetServiceError('Invalid multiplier', {
          betId,
          currentMultiplier
        }));
        return;
      }

      // Get and validate token
      const token: string | null = getToken();
      const cleanToken: string = token?.startsWith('Bearer ') 
        ? token.split(' ')[1] 
        : token || '';

      if (!cleanToken) {
        reject(new BetServiceError('Authentication token not found', {
          betId,
          currentMultiplier
        }));
        return;
      }

      // Emit cashout event
      this.emit('cashout', {
        token: cleanToken,
        betId,
        currentMultiplier
      }, (response: BetResponse) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Cashout failed', {
            betId,
            currentMultiplier
          }));
        }
      });
    });
  }

  async cashoutWithToken(cashoutToken: string, betId: number): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Validate inputs
      if (!cashoutToken) {
        reject(new BetServiceError('Invalid cashout token', {
          betId
        }));
        return;
      }

      if (!betId) {
        reject(new BetServiceError('Invalid bet ID', {
          betId
        }));
        return;
      }

      // Emit cashoutWithToken event
      this.emit('cashoutWithToken', {
        cashoutToken,
        betId
      }, (response: BetResponse) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Cashout failed', {
            betId
          }));
        }
      });
    });
  }
}

// Create a singleton instance
const betServiceInstance = new BetService();

// Export the instance as default
export default betServiceInstance;