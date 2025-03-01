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
    betId?: string; // Changed from number to string for reference ID
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
  betId?: string; // Changed from number to string for reference ID
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
  activateCashout: (data: { token: string; betId: string }) => void;
}

export interface ClientToServerEvents {
  placeBet: (data: { 
    token: string; 
    amount: number; 
    autoCashoutMultiplier?: number 
  }, callback: (response: BetPlacementResponse) => void) => void;
  cashout: (data: { 
    token: string; 
    betId: string; // Changed from number to string for reference ID
    cashoutMultiplier: number 
  }, callback: (response: BetResponse) => void) => void;
  cashoutWithToken: (data: {
    cashoutToken: string;
    betId: string; // Changed from number to string for reference ID
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
  // Singleton instance with explicit typing
  private static instance: BetService | null = null;

  // Socket instance for communication
  private socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> = {} as Socket<ServerToClientEvents, ClientToServerEvents>;
  
  // Typed socket for additional type-safe operations
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> = {} as Socket<ServerToClientEvents, ClientToServerEvents>;

  private DEFAULT_TIMEOUT = 10000; // 10 seconds default timeout

  private static SOCKET_URL: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  // Private constructor to prevent direct instantiation
  private constructor() {
    console.log('🚀 Initializing BetService', {
      socketUrl: BetService.SOCKET_URL,
      timestamp: new Date().toISOString()
    });

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('Environment: Server-side - Deferring socket connection');
      return; // Don't connect to socket during SSR
    }

    // Initialize socket connection (client-side only)
    this.initializeSocketConnection();
  }

  // Singleton method to get or create instance
  public static getInstance(): BetService {
    if (!BetService.instance) {
      BetService.instance = new BetService();
    }
    return BetService.instance;
  }

  // Method to reset the singleton instance (useful for testing or specific scenarios)
  public static resetInstance(): void {
    // Set to null instead of undefined
    BetService.instance = null;
  }

  private initializeSocketConnection() {
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
      console.warn('🚨 No valid authentication token found - Cannot connect to socket');
      return; // Don't attempt connection without a token
    }

    // Disconnect existing socket if connected
    if (this.socketInstance?.connected) {
      console.log('Disconnecting existing socket before reconnection');
      this.socketInstance.disconnect();
    }

    // Create socket connection
    this.socketInstance = io(BetService.SOCKET_URL, {
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
    });

    // Initialize socket with proper types
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
      
      // Don't throw error for authentication issues, just log them
      if (err.message.includes('Authentication')) {
        console.warn('Authentication error - will retry when token is available');
      } else {
        throw new SocketConnectionError('Socket connection error', socketError);
      }
    });

    this.setupSocketListeners();
  }

  // Public method to connect socket after login
  public connectSocketAfterLogin() {
    console.log('🔄 Attempting to connect socket after login');
    this.initializeSocketConnection();
  }

  // Public method to disconnect socket
  public disconnectSocket() {
    console.log('🔌 Disconnecting socket');
    if (this.socketInstance) {
      this.socketInstance.disconnect();
      console.log('Socket disconnected successfully');
    }
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

    this.socketInstance.on('betError', (error: { message: string }) => {
      console.error('Bet error event received:', error);
    });

    this.socketInstance.on('cashout', (response: BetResponse) => {
      console.log('Cashout event received:', response);
    });

    this.socketInstance.on('activateCashout', (data: { token: string; betId: string }) => {
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

  // Validate bet amount
  private validateBetAmount(amount: number): boolean {
    return amount >= 10 && amount <= 50000;
  }

  // Validate auto-cashout multiplier
  private validateAutoCashoutMultiplier(multiplier?: number): boolean {
    return multiplier ? multiplier > 1 : true;
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

  // Place bet with simplified error handling
  public async placeBet(options: { amount: number; autoCashoutMultiplier?: number }): Promise<BetPlacementResponse> {
    // Validate inputs
    if (!this.validateBetAmount(options.amount)) {
      return Promise.reject(new Error('Invalid bet amount. Must be between 10 and 50000.'));
    }

    if (options.autoCashoutMultiplier && !this.validateAutoCashoutMultiplier(options.autoCashoutMultiplier)) {
      return Promise.reject(new Error('Invalid auto cashout multiplier. Must be greater than 1.'));
    }

    // Check socket connection
    if (!this.socketInstance.connected) {
      return Promise.reject(new Error('Socket not connected'));
    }

    // Get token
    const token = getToken();
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }

    // Prepare bet data
    const betData = {
      token: token,
      amount: options.amount,
      betType: options.autoCashoutMultiplier ? 'auto' : 'manual',
      autoCashoutMultiplier: options.autoCashoutMultiplier
    };

    return new Promise((resolve, reject) => {
      // Emit bet placement event
      this.socketInstance.emit('placeBet', betData, (response: BetPlacementResponse) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Failed to place bet', {
            amount: options.amount,
            autoCashoutMultiplier: options.autoCashoutMultiplier
          }));
        }
      });
    });
  }

  // Cashout bet with improved error handling and timeout
  public async cashoutBet(options: { token: string; betId: string; currentMultiplier: number }, timeout: number = this.DEFAULT_TIMEOUT): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Check socket connection
      if (!this.socketInstance.connected) {
        reject(new Error('Socket is not connected. Cannot cashout.'));
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Cashout operation timed out'));
      }, timeout);

      // Prepare cashout data with the correct structure
      const cashoutData = {
        token: options.token,
        betId: options.betId,
        cashoutMultiplier: options.currentMultiplier // Using the correct parameter name
      };

      // Log the cashout data being sent
      console.group('💰 Cashing Out');
      console.log('Cashout Data:', cashoutData);
      console.groupEnd();

      this.socketInstance.emit('cashout', cashoutData, (response: BetResponse) => {
        clearTimeout(timeoutId);
        console.log('Cashout response:', response);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Cashout failed', {
            betId: options.betId,
            currentMultiplier: options.currentMultiplier
          }));
        }
      });
    });
  }

  // Listen for cashout broadcasts
  public listenToCashoutBroadcasts(callback: (cashoutInfo: any) => void): void {
    this.socketInstance.on('cashout', callback);
  }

  // Remove specific cashout broadcast listener
  public removeSpecificCashoutBroadcastListener(callback?: (cashoutInfo: any) => void): void {
    if (callback) {
      this.socketInstance.off('cashout', callback);
    } else {
      this.socketInstance.off('cashout');
    }
  }

  // Cleanup method to remove all listeners
  public cleanup(): void {
    this.socketInstance.off('betPlaced');
    this.socketInstance.off('betError');
    this.socketInstance.off('cashout');
    this.socketInstance.off('activateCashout');
    this.socketInstance.off('error');
    this.socketInstance.off('disconnect');
    this.socketInstance.off('connect');
    this.socketInstance.off('connect_error');
  }
}

// Create a singleton instance
const betServiceInstance = BetService.getInstance();

// Export the singleton instance as default
export default betServiceInstance;