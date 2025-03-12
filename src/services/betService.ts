import { io, Socket } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import { api, getToken } from '../utils/authUtils';
import { get } from '../utils/apiClient';

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

// Define the structure for a bet from the API
export interface BetRecord {
  id: string;
  user_id: string;
  amount: number;
  payout_multiplier?: number;
  status: 'pending' | 'won' | 'lost' | 'cashed_out';
  cashout_amount?: number;
  created_at: string;
  updated_at: string;
  game_session_id: string;
  auto_cashout_multiplier?: number;
}

export interface ActiveBet {
  betId: string;
  amount: number;
  token: string | null;
  status: 'pending' | 'active' | 'cashed_out' | 'lost';
  timestamp: number;
  autoCashout?: number;
}

export class BetService {
  // Singleton instance with explicit typing
  private static instance: BetService | null = null;

  // Socket instance for communication
  private socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> = {} as Socket<ServerToClientEvents, ClientToServerEvents>;
  
  // Typed socket for additional type-safe operations
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> = {} as Socket<ServerToClientEvents, ClientToServerEvents>;

  private DEFAULT_TIMEOUT = 3000; // 3 seconds timeout max

  // Update the SOCKET_URL with more explicit logging and fallback
  private static SOCKET_URL: string = (() => {
    const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const fallbackUrl = 'http://localhost:8001';
    
    console.log('Socket URL Configuration:', {
      NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl,
      NEXT_PUBLIC_BACKEND_URL: backendUrl,
      fallbackUrl
    });
    
    return websocketUrl || backendUrl || fallbackUrl;
  })();

  // Replace simple currentBet with a map of active bets
  private activeBets: Record<string, ActiveBet> = {};
  private currentMultiplier: number = 1.0;

  // Add storage for cashout tokens
  private cashoutTokens: Record<string, string> = {};
  private tokenExpiryTimes: Record<string, number> = {};
  private TOKEN_EXPIRY_MS = 30000; // 30 seconds

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

    // Set up token cleanup
    if (typeof window !== 'undefined') {
      this.setupTokenCleanup();
    }
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
    
    // More comprehensive logging
    console.group('🔐 Socket Authentication Setup');
    console.log('Token Details:', {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 'N/A',
      tokenFirstChars: token ? token.substring(0, 10) : 'N/A',
      tokenLastChars: token ? token.substring(token.length - 10) : 'N/A'
    });
    console.log('Socket Connection URL:', BetService.SOCKET_URL);

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

    // Create socket connection with more logging
    console.log('Creating socket connection to:', BetService.SOCKET_URL);
    
    try {
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
      
      console.log('Socket instance created successfully');
    } catch (error) {
      console.error('Error creating socket connection:', error);
      throw new Error(`Failed to create socket connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

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

  // Enhanced setupSocketListeners for better bet tracking
  private setupSocketListeners(): void {
    // Game-specific event handlers
    this.socketInstance.on('betPlaced', (response: BetPlacementResponse) => {
      console.log('📣 Bet placed event received:', response);
      if (response.success && response.data?.betId) {
        // Store the bet reference ID returned by the server
        const betId = response.data.betId;
        const amount = response.data.betAmount || response.data.amount || 0;
        
        // Track the bet in our activeBets map
        this.activeBets[betId] = {
          betId,
          amount,
          token: null,  // Will be populated when activateCashout is received
          status: 'pending',
          timestamp: Date.now(),
          autoCashout: response.data.autoCashoutMultiplier
        };
        
        console.log(`Stored active bet with ID ${betId} in bet service`, this.activeBets[betId]);
        
        // ENHANCEMENT: Also set the current bet for immediate access
        this.currentBet = {
          betId: betId,
          amount: amount
        };
        
        // Emit additional event for components to know a bet was placed successfully
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('betPlacedSuccessfully', { 
              detail: { 
                betId,
                amount 
              } 
            }));
          } catch (eventError) {
            console.error('Failed to dispatch betPlacedSuccessfully event:', eventError);
          }
        }
      }
    });

    this.socketInstance.on('betError', (error: { message: string }) => {
      console.error('Bet error event received:', error);
      // Don't clear activeBets here, just log the error
    });

    this.socketInstance.on('cashout', (response: BetResponse) => {
      console.log('Cashout event received:', response);
      if (response.success && response.data?.betId) {
        // Remove the bet from our active bets
        const betId = response.data.betId;
        if (this.activeBets[betId]) {
          console.log(`Removing bet ${betId} from active bets after successful cashout`);
          delete this.activeBets[betId];
        }
      }
    });

    this.socketInstance.on('activateCashout', (data: { token: string; betId: string }) => {
      console.log('🔥 CASHOUT ACTIVATION RECEIVED:', data);
      
      // Store the cashout token with the matching bet reference ID
      const { betId, token } = data;
      
      // Debug logging to trace the issue
      console.log('Current active bets:', Object.keys(this.activeBets));
      
      if (this.activeBets[betId]) {
        console.log(`✅ Storing cashout token for bet ${betId}`);
        this.activeBets[betId].token = token;
        this.activeBets[betId].status = 'active';
        
        // Also store in tokens map for backward compatibility
        this.cashoutTokens[betId] = token;
        this.tokenExpiryTimes[betId] = Date.now() + this.TOKEN_EXPIRY_MS;
        
        // Always dispatch the custom event
        if (typeof window !== 'undefined') {
          console.log(`🔔 Dispatching cashoutActivated event for bet ${betId}`);
          
          try {
            // Create the event with the correct format
            const cashoutEvent = new CustomEvent('cashoutActivated', { 
              detail: { 
                token, 
                betId,
                timestamp: new Date().toISOString()
              } 
            });
            
            // Dispatch the event
            window.dispatchEvent(cashoutEvent);
            console.log('✅ Custom event dispatched successfully');
          } catch (eventError) {
            console.error('❌ Error dispatching custom event:', eventError);
          }
        }

        // Set up token expiry cleanup
        setTimeout(() => {
          if (this.activeBets[betId]?.token === token) {
            console.log(`Token for bet ${betId} has expired, clearing token`);
            this.activeBets[betId].token = null;
          }
          delete this.cashoutTokens[betId];
          delete this.tokenExpiryTimes[betId];
        }, this.TOKEN_EXPIRY_MS);
      } else {
        console.warn(`⚠️ Received activateCashout for unknown bet ID: ${betId}, creating temporary entry`);
        
        // Create a temporary bet entry for this cashout token
        this.activeBets[betId] = {
          betId,
          amount: 0, // We don't know the amount
          token: token,
          status: 'active',
          timestamp: Date.now()
        };
        
        this.cashoutTokens[betId] = token;
        this.tokenExpiryTimes[betId] = Date.now() + this.TOKEN_EXPIRY_MS;
        
        // Dispatch the event anyway to unblock UI
        if (typeof window !== 'undefined') {
          console.log(`🔔 Dispatching cashoutActivated event for unknown bet ${betId}`);
          
          try {
            const cashoutEvent = new CustomEvent('cashoutActivated', { 
              detail: { 
                token, 
                betId,
                timestamp: new Date().toISOString(),
                isUnknownBet: true
              } 
            });
            window.dispatchEvent(cashoutEvent);
            console.log('✅ Custom event dispatched for unknown bet');
          } catch (eventError) {
            console.error('❌ Error dispatching custom event:', eventError);
          }
        }
      }
    });

    this.socketInstance.on('multiplierUpdate', (multiplier: number) => {
      this.currentMultiplier = multiplier;
      // Existing event handling...
    });

    this.socketInstance.on('error', (error: any) => {
      console.error('Socket error event:', error);
      // Don't reset currentBet on general errors
    });

    this.socketInstance.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      // Reset current bet on disconnect
      this.currentBet = null;
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, you need to reconnect manually
        this.socket.connect();
      }
    });

    // Add more detailed game state logging
    this.socketInstance.on('gameStateChange', (state: string) => {
      console.log('🎮 Game state changed:', state, {
        currentTime: new Date().toISOString(),
        hasBets: Object.keys(this.activeBets).length > 0,
        activeBetIds: Object.keys(this.activeBets)
      });
      
      // If game crashes, mark all active bets as lost
      if (state === 'crashed') {
        Object.keys(this.activeBets).forEach(betId => {
          if (this.activeBets[betId].status !== 'cashed_out') {
            console.log(`Marking bet ${betId} as lost due to game crash`);
            this.activeBets[betId].status = 'lost';
          }
        });
        
        // Clear lost bets after a short delay
        setTimeout(() => {
          this.cleanupLostBets();
        }, 2000);
      }
      
      // If game is waiting for next round, clean up old bets
      if (state === 'waiting') {
        this.cleanupLostBets();
      }
    });
  }
  
  private cleanupLostBets(): void {
    Object.keys(this.activeBets).forEach(betId => {
      const bet = this.activeBets[betId];
      if (bet.status === 'lost' || bet.timestamp < Date.now() - 300000) { // 5 min old
        console.log(`Cleaning up old/lost bet ${betId}`);
        delete this.activeBets[betId];
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

  // Updated placeBet with better error handling and reconnection attempts to match cashout methods
  public async placeBet(options: { amount: number; autoCashoutMultiplier?: number }): Promise<BetPlacementResponse> {
    return new Promise((resolve, reject) => {
      // Validate inputs but don't return early if socket isn't connected
      if (!this.validateBetAmount(options.amount)) {
        reject(new Error('Invalid bet amount. Must be between 10 and 50000.'));
        return;
      }

      if (options.autoCashoutMultiplier && !this.validateAutoCashoutMultiplier(options.autoCashoutMultiplier)) {
        reject(new Error('Invalid auto cashout multiplier. Must be greater than 1.'));
        return;
      }
      
      // Create socket if it doesn't exist
      if (!this.socketInstance) {
        this.initializeSocketConnection();
      }
      
      // Proceed with bet placement immediately
      this.performInstantPlaceBet(options, resolve, reject);
    });
  }

  // Instant bet placement without waiting for connection
  private performInstantPlaceBet(
    options: { amount: number; autoCashoutMultiplier?: number },
    resolve: (value: BetPlacementResponse | PromiseLike<BetPlacementResponse>) => void,
    reject: (reason?: any) => void
  ): void {
    // Get token
    const token = getToken();
    if (!token) {
      reject(new Error('No authentication token found'));
      return;
    }

    // Prepare bet data
    const betData = {
      token: token,
      amount: options.amount,
      betType: options.autoCashoutMultiplier ? 'auto' : 'manual',
      autoCashoutMultiplier: options.autoCashoutMultiplier
    };

    console.log('💰 Instant bet placement', {
      amount: options.amount,
      type: options.autoCashoutMultiplier ? 'auto' : 'manual'
    });

    try {
      // Emit without waiting for connection
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
    } catch (error) {
      reject(new Error(`Socket emit error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  // Optimized cashoutBet for secure cashout with token
  public async cashoutBet(options: { token: string; betId: string; currentMultiplier: number }): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Check if this is a reference to the latest bet
      const betId = options.betId === 'latest' 
        ? (this.getMostRecentBet()?.betId || '')
        : options.betId;
      
      // Check if we have a valid cashout token for this bet
      const cashoutToken = this.activeBets[betId]?.token || 
                           this.getCashoutToken(betId);
      
      if (cashoutToken) {
        console.log(`Valid cashout token found for bet ${betId}, using secure token-based cashout`);
        // Use the secure token-based cashout if we have a valid token
        return this.cashoutWithToken({ 
          cashoutToken, 
          betId 
        }).then(resolve).catch(reject);
      }
      
      // No valid token, try regular cashout as fallback
      console.log(`No valid cashout token for bet ${betId}, trying regular cashout`);
      
      // Check if socket exists but don't wait for connection
      if (!this.socketInstance) {
        this.initializeSocketConnection();
      }
      
      // Even if disconnected, try to emit anyway - optimistic approach
      this.performInstantCashout({
        token: options.token,
        betId,
        currentMultiplier: options.currentMultiplier
      }, resolve, reject);
    });
  }

  // New method for instant cashout without waiting for reconnection
  private performInstantCashout(
    options: { token: string; betId: string; currentMultiplier: number },
    resolve: (value: BetResponse | PromiseLike<BetResponse>) => void,
    reject: (reason?: any) => void
  ): void {
    // Validate parameters
    if (!options.betId) {
      reject(new Error('BetId is required for cashout'));
      return;
    }
    
    // Ensure multiplier is > 1 to pass backend validation
    const validMultiplier = Math.max(1.01, options.currentMultiplier);
    
    // If betId is 'latest', let the server find the latest active bet
    const betId = options.betId === 'latest' ? null : options.betId;

    // Prepare cashout data
    const cashoutData = {
      token: options.token,
      betId: betId, // May be null, server should handle
      cashoutMultiplier: validMultiplier
    };

    console.log('💰 Instant cashout attempt', {
      betId: betId || 'Using server lookup',
      multiplier: validMultiplier
    });

    try {
      // Emit without waiting for connection
      this.socketInstance.emit('cashout', cashoutData, (response: BetResponse) => {
        if (response.success) {
          this.currentBet = null;
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Cashout failed', {
            betId: options.betId,
            currentMultiplier: validMultiplier
          }));
        }
      });
    } catch (error) {
      console.error('Error during cashout emit:', error);
      reject(new Error(`Socket emit error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  // Improved cashoutWithToken with better error handling
  public async cashoutWithToken(options: { cashoutToken: string; betId: string }): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Check socket but don't wait
      if (!this.socketInstance) {
        this.initializeSocketConnection();
      }
      
      // Instant action without waiting for connection
      this.performInstantCashoutWithToken(options, resolve, reject);
    });
  }

  private performInstantCashoutWithToken(
    options: { cashoutToken: string; betId: string },
    resolve: (value: BetResponse | PromiseLike<BetResponse>) => void,
    reject: (reason?: any) => void
  ): void {
    // If betId is 'latest', let the server find the latest active bet
    const betId = options.betId === 'latest' ? null : options.betId;

    console.log('💰 Instant token cashout attempt', {
      betId: betId || 'Using server lookup'
    });

    try {
      // Emit without waiting for connection
      this.socketInstance.emit('cashoutWithToken', {
        cashoutToken: options.cashoutToken,
        betId: betId
      }, (response: BetResponse) => {
        if (response.success) {
          this.currentBet = null;
          resolve(response);
        } else {
          reject(new BetServiceError(response.message || 'Cashout with token failed', {
            betId: options.betId
          }));
        }
      });
    } catch (error) {
      reject(new Error(`Socket emit error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  // Optimized directCashout for immediate action
  public directCashout(betId: string): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Get token
        const token = getToken();
        if (!token) {
          reject(new Error('No token available'));
          return;
        }

        // If socket doesn't exist, create one but don't wait
        if (!this.socketInstance) {
          this.initializeSocketConnection();
        }

        // Send cashout immediately
        this.sendInstantDirectCashout(token, betId, resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private sendInstantDirectCashout(
    token: string, 
    betId: string,
    resolve: (value: BetResponse | PromiseLike<BetResponse>) => void,
    reject: (reason?: any) => void
  ): void {
    console.log('⚡ Instant direct cashout', { betId: betId || 'Using server lookup' });
    
    // If betId is 'latest', let the server find the latest active bet
    const finalBetId = betId === 'latest' ? null : betId;

    // Emit without waiting for connection confirmation
    this.socketInstance.emit('cashout', {
      token,
      betId: finalBetId,
      cashoutMultiplier: 100 // High multiplier for maximum cashout
    }, (response: BetResponse) => {
      if (response.success) {
        this.currentBet = null;
        resolve(response);
      } else {
        reject(new Error(response.message || 'Direct cashout failed'));
      }
    });
  }

  // Fetch current active bets for the user
  public async getCurrentBets(): Promise<BetRecord[]> {
    try {
      console.log('Fetching current bets...');
      
      // Set a flag to prevent recursive API calls
      const inProgressKey = 'getCurrentBets_inProgress';
      if ((window as any)[inProgressKey]) {
        console.warn('getCurrentBets call already in progress, returning empty array');
        return [];
      }
      
      // Set the flag
      (window as any)[inProgressKey] = true;
      
      try {
        // Check if socket is connected to ensure we have a valid token/session
        if (!this.socketInstance?.connected) {
          console.warn('Socket is not connected when trying to fetch current bets');
          // Don't attempt reconnect here to avoid potential loops
        }
        
        // Use a timeout to prevent hanging requests
        const timeoutPromise = new Promise<{success: false, data: []}>((_, reject) => {
          setTimeout(() => reject(new Error('API request timed out')), 5000);
        });
        
        // Make API request with timeout protection
        const response = await Promise.race([
          get<{ success: boolean; data: BetRecord[] }>('/api/bets/current-bets'),
          timeoutPromise
        ]);
        
        if (response && response.success && Array.isArray(response.data)) {
          console.log(`Found ${response.data.length} active bets:`, response.data);
          return response.data;
        } else {
          console.warn('Response format unexpected:', response);
          return [];
        }
      } finally {
        // Always clear the flag
        (window as any)[inProgressKey] = false;
      }
    } catch (error) {
      console.error('Error in getCurrentBets:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  // Fetch bet history for the user
  public async getBetHistory(limit: number = 10, page: number = 1): Promise<BetRecord[]> {
    try {
      const response = await get<{ success: boolean; data: BetRecord[] }>(
        `/api/bets/history?limit=${limit}&page=${page}`
      );
      
      if (response && response.success && Array.isArray(response.data)) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching bet history:', error);
      throw new BetServiceError('Failed to fetch bet history', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  // Add method to check if user has active bet
  public hasActiveBet(): boolean {
    return Object.keys(this.activeBets).length > 0;
  }

  // Add method to get current bet details
  public getCurrentBet(): { betId: string; amount: number } | null {
    const mostRecentBet = this.getMostRecentBet();
    if (!mostRecentBet) return null;
    
    return {
      betId: mostRecentBet.betId,
      amount: mostRecentBet.amount
    };
  }

  // Get cashout token for a specific bet
  public getCashoutToken(betId: string): string | null {
    // First check in active bets
    if (this.activeBets[betId]?.token) {
      return this.activeBets[betId].token;
    }
    
    // Fall back to legacy token storage
    const token = this.cashoutTokens[betId];
    const expiry = this.tokenExpiryTimes[betId];
    
    // Check if token exists and hasn't expired
    if (token && expiry && expiry > Date.now()) {
      return token;
    }
    
    // Clean up expired token
    if (token) {
      delete this.cashoutTokens[betId];
      delete this.tokenExpiryTimes[betId];
      
      // Also clean up from activeBets if token is expired
      if (this.activeBets[betId]?.token) {
        this.activeBets[betId].token = null;
      }
    }
    
    return null;
  }

  // Get active bet by ID
  public getActiveBet(betId: string): ActiveBet | null {
    return this.activeBets[betId] || null;
  }
  
  // Get all active bets
  public getAllActiveBets(): ActiveBet[] {
    return Object.values(this.activeBets);
  }
  
  // Get the most recent active bet
  public getMostRecentBet(): ActiveBet | null {
    const bets = this.getAllActiveBets();
    if (bets.length === 0) return null;
    
    // Sort by timestamp descending and return the first one
    return bets.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  // Enhance unified cashout to work with any available bet
  public async unifiedCashout(betId: string, currentMultiplier: number): Promise<BetResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Unified cashout requested for bet ${betId} at multiplier ${currentMultiplier}`);
        
        // If no betId provided, try to get most recent bet
        if (!betId) {
          const mostRecentBet = this.getMostRecentBet();
          if (mostRecentBet) {
            console.log(`Using most recent bet ID: ${mostRecentBet.betId} instead of empty betId`);
            betId = mostRecentBet.betId;
          } else {
            console.error("CASHOUT FAILED: No bet ID provided or available");
            resolve({
              success: false,
              message: 'No active bet found for cashout'
            });
            return;
          }
        }
        
        // Get token
        const token = getToken();
        if (!token) {
          console.error("CASHOUT FAILED: No authentication token");
          resolve({
            success: false, 
            message: 'Authentication required'
          });
          return;
        }
        
        // Step 1: Try to find active bet and valid token
        const effectiveBetId = betId === 'latest' 
          ? (this.getMostRecentBet()?.betId || betId) 
          : betId;
        
        const activeBet = this.getActiveBet(effectiveBetId);
        const cashoutToken = activeBet?.token || this.getCashoutToken(effectiveBetId);
        
        // Log attempted cashout for debugging
        console.log(`Attempting cashout:`, {
          effectiveBetId,
          hasActiveBet: !!activeBet,
          hasToken: !!cashoutToken,
          hasSocketConnection: this.socketInstance?.connected
        });
        
        // Step 2: Try token-based cashout if we have a valid token
        if (cashoutToken) {
          try {
            console.log(`Attempting token-based cashout for bet ${effectiveBetId}`);
            const response = await this.cashoutWithToken({
              cashoutToken,
              betId: effectiveBetId
            });
            
            if (response.success) {
              // Clean up successful cashout
              if (this.activeBets[effectiveBetId]) {
                delete this.activeBets[effectiveBetId];
              }
              resolve(response);
              return;
            }
          } catch (tokenError) {
            console.warn(`Token-based cashout failed: ${tokenError}. Trying standard cashout...`);
            // Continue to next method if token cashout fails
          }
        }
        
        // Step 3: Try standard cashout
        try {
          const response = await this.cashoutBet({
            token,
            betId: effectiveBetId,
            currentMultiplier
          });
          
          if (response.success) {
            // Clean up successful cashout
            if (this.activeBets[effectiveBetId]) {
              delete this.activeBets[effectiveBetId];
            }
            resolve(response);
            return;
          }
          
          // If we get here, none of the cashout methods succeeded
          resolve({
            success: false,
            message: response.message || 'Cashout failed for unknown reason'
          });
        } catch (error) {
          reject(new Error(`Cashout failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      } catch (error) {
        console.error('Error in unified cashout:', error);
        resolve({
          success: false,
          message: `Cashout error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
  }

  // Improve token cleanup to avoid expired tokens
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    Object.keys(this.tokenExpiryTimes).forEach(betId => {
      if (this.tokenExpiryTimes[betId] < now) {
        console.log(`Cleaning up expired token for bet ${betId}`);
        delete this.cashoutTokens[betId];
        delete this.tokenExpiryTimes[betId];
        
        // Also clean up from activeBets if token is expired
        if (this.activeBets[betId]?.token) {
          this.activeBets[betId].token = null;
        }
      }
    });
  }

  // Call token cleanup periodically
  private setupTokenCleanup(): void {
    setInterval(() => this.cleanupExpiredTokens(), 5000); // Check every 5 seconds
  }

  /**
   * Check if a bet exists by ID - asks the backend if needed
   * @param {string} betId - The bet ID to check
   * @returns {Promise<boolean>} - Whether the bet exists and is active
   */
  public async checkBetExists(betId: string): Promise<boolean> {
    try {
      // First check our local cache
      if (this.activeBets[betId]) {
        return true;
      }
      
      // Then ask the server
      const response = await get<{ success: boolean; active: boolean }>(`/api/bets/check/${betId}`);
      return response?.success && response?.active;
    } catch (error) {
      console.error('Error checking bet existence:', error);
      return false;
    }
  }
}

// Create a singleton instance
const betServiceInstance = BetService.getInstance();

// Export the singleton instance as default
export default betServiceInstance;