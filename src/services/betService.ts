import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export interface BetDetails {
  amount: number;
  userId: string | null;
  cashoutMultiplier: number;
}

export interface BetResponse {
  playerBetId: string;
  status: 'placed' | 'active' | 'cashed_out' | 'expired';
  betAmount: number;
  payoutAmount?: number;
  message?: string;
}

export class BettingService {
  private socket: Socket;
  private baseUrl: string;
  private fallbackUrls: string[];

  constructor() {
    // Ensure backend URL is strictly from environment variable
    const primaryBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';
    const primaryWebsocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || primaryBackendUrl;
    
    // Fallback URLs with backend link as primary fallback
    this.fallbackUrls = [
      primaryBackendUrl,   // Primary backend URL
      primaryWebsocketUrl  // WebSocket URL
    ];

    // Set base URL with backend URL
    this.baseUrl = `${primaryBackendUrl}/api/bets`;
    
    // Connect to socket with fallback
    this.socket = this.createSocketConnection(primaryWebsocketUrl);
  }

  // Public method to get authentication token
  public getAuthToken(): string {
    // Check multiple storage mechanisms with detailed logging
    const localStorageToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const sessionStorageToken = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    const cookieToken = this.getCookieToken(); // Add a method to retrieve token from cookies

    console.log('🔐 Token Retrieval Attempt', {
      localStorageTokenExists: !!localStorageToken,
      sessionStorageTokenExists: !!sessionStorageToken,
      cookieTokenExists: !!cookieToken,
      timestamp: new Date().toISOString()
    });

    return localStorageToken || sessionStorageToken || cookieToken || '';
  }

  // New method to retrieve token from cookies
  private getCookieToken(): string {
    if (typeof document === 'undefined') return '';
    
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
    
    if (tokenCookie) {
      console.log('🍪 Token retrieved from cookie', {
        timestamp: new Date().toISOString()
      });
      return tokenCookie.split('=')[1];
    }
    
    return '';
  }

  // Public method to get access token
  public getAccessToken(): string {
    return (
      (typeof window !== 'undefined' && localStorage.getItem('accessToken')) || 
      (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || 
      ''
    );
  }

  // Public method to get user ID
  public getUserId(): string {
    return (
      (typeof window !== 'undefined' && localStorage.getItem('userId')) || 
      (typeof window !== 'undefined' && sessionStorage.getItem('userId')) || 
      ''
    );
  }

  // Generate socket connection options with improved authentication handling
  private getSocketOptions(url: string) {
    const token = this.getAuthToken();
    const userId = this.getUserId();

    console.log('🔐 Socket Authentication Options', {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 0,
      userIdPresent: !!userId,
      timestamp: new Date().toISOString()
    });

    const options: any = {
      path: '/socket.io', // Common socket path
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      auth: {
        token: token,  // Ensure token is always passed
        userId: userId
      }
    };

    // Always add Authorization header if token exists
    if (token) {
      options.extraHeaders = {
        Authorization: `Bearer ${token}`
      };
    }

    return options;
  }

  // Create socket connection with fallback mechanism and authentication error handling
  private createSocketConnection(primaryUrl: string): Socket {
    try {
      console.log(`🔌 Attempting to connect to backend socket at: ${primaryUrl}`);
      
      const socket = io(primaryUrl, this.getSocketOptions(primaryUrl));

      // Add more detailed connection logging
      socket.on('connect', () => {
        console.log(`✅ Successfully connected to backend socket at: ${primaryUrl}`);
      });

      socket.on('connect_error', (error) => {
        console.error(`❌ Backend socket connection error at ${primaryUrl}:`, error);
        
        // Specific handling for authentication errors
        if (error.message.includes('Authentication') || error.message.includes('Token')) {
          console.error('🔒 Authentication failed. Please log in again.');
          this.handleAuthenticationError();
        }
      });

      this.setupSocketListeners(socket);
      return socket;
    } catch (primaryError) {
      console.warn('🚨 Primary socket connection failed, attempting fallbacks', primaryError);
      
      // Try fallback URLs
      for (const fallbackUrl of this.fallbackUrls) {
        try {
          console.log(`🔄 Attempting fallback connection to: ${fallbackUrl}`);
          
          const fallbackSocket = io(fallbackUrl, this.getSocketOptions(fallbackUrl));

          fallbackSocket.on('connect', () => {
            console.log(`✅ Successfully connected to fallback socket at: ${fallbackUrl}`);
          });

          fallbackSocket.on('connect_error', (error) => {
            console.error(`❌ Fallback socket connection error at ${fallbackUrl}:`, error);
            
            if (error.message.includes('Authentication') || error.message.includes('Token')) {
              console.error('🔒 Authentication failed on fallback. Please log in again.');
              this.handleAuthenticationError();
            }
          });

          this.setupSocketListeners(fallbackSocket);
          return fallbackSocket;
        } catch (fallbackError) {
          console.warn(`🚫 Fallback socket URL ${fallbackUrl} failed`, fallbackError);
        }
      }

      // If all connections fail, throw a detailed error
      throw new Error(`🆘 Failed to connect to any socket URL. Primary URL: ${primaryUrl}`);
    }
  }

  // Handle authentication errors
  private handleAuthenticationError() {
    // Clear existing tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
    }

    // Optional: Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=token_expired';
    }
  }

  private setupSocketListeners(socket: Socket) {
    socket.on('connect', () => {
      console.log('Connected to betting socket', {
        connectionTime: new Date().toISOString(),
        socketId: socket.id,
        url: socket.io.opts.host || 'Unknown'
      });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', {
        reason: reason,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('betPlaced', (betData: any) => {
      // Dynamically parse bet details
      const parsedBetData = typeof betData === 'string' 
        ? JSON.parse(betData) 
        : betData;

      console.log('🎲 Comprehensive Bet Placement Details:', {
        fullBetData: JSON.stringify(parsedBetData),
        playerBetId: parsedBetData.betId || parsedBetData.playerBetId || 'Unknown',
        status: parsedBetData.status || 'placed',
        betAmount: parsedBetData.amount || parsedBetData.betAmount || 0,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('cashoutResult', (cashoutData: any) => {
      console.log('💰 Cashout Result:', {
        playerBetId: cashoutData.playerBetId,
        status: cashoutData.status,
        payoutAmount: cashoutData.payoutAmount,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('error', (error: any) => {
      console.error('🚨 Betting Socket Error:', {
        errorMessage: error.message,
        errorName: error.name,
        errorDetails: JSON.stringify(error),
        timestamp: new Date().toISOString()
      });
    });
  }

  async placeBet(betDetails: BetDetails): Promise<BetResponse> {
    // Validate input
    console.debug('🕵️ Bet Amount Validation', {
      rawAmount: betDetails.amount,
      typeOfAmount: typeof betDetails.amount,
      isNumber: !isNaN(Number(betDetails.amount)),
      parsedAmount: Number(betDetails.amount),
      timestamp: new Date().toISOString()
    });

    if (!betDetails.amount || betDetails.amount <= 0) {
      console.error('❌ Invalid bet amount', {
        providedAmount: betDetails.amount,
        timestamp: new Date().toISOString()
      });
      throw new Error('Bet amount must be a positive number');
    }

    // Get authentication token with enhanced logging
    const authToken = this.getAuthToken();
    const userId = this.getUserId();
    
    console.log('🔑 Authentication Details for Bet Placement', {
      tokenLength: authToken ? authToken.length : 0,
      tokenPresent: !!authToken,
      userIdPresent: !!userId,
      socketConnected: this.socket.connected,
      socketId: this.socket.id,
      rawToken: this.maskToken(authToken), // Mask token for safe logging
      timestamp: new Date().toISOString()
    });

    if (!authToken) {
      console.error('❌ No authentication token found', {
        localStorageToken: !!localStorage.getItem('token'),
        sessionStorageToken: !!sessionStorage.getItem('token'),
        timestamp: new Date().toISOString()
      });
      throw new Error('Authentication required. Please log in.');
    }

    return new Promise((resolve, reject) => {
      // Prepare bet details with comprehensive authentication context
      const authenticatedBetDetails = {
        ...betDetails,
        token: authToken,  // Explicit token field
        userId: userId,
        authentication: {
          method: 'bearer',
          token: this.maskToken(authToken)  // Masked token for logging
        },
        // Add additional context for debugging
        clientTimestamp: new Date().toISOString()
      };

      console.log('🚀 Sending Authenticated Bet Details', {
        tokenMethod: 'explicit token field',
        authTokenLength: authenticatedBetDetails.token.length,
        userIdPresent: !!authenticatedBetDetails.userId,
        timestamp: new Date().toISOString()
      });

      // Add more robust error handling
      const placementTimeout = setTimeout(() => {
        console.warn('⏰ Bet placement timed out', {
          betAmount: betDetails.amount,
          timestamp: new Date().toISOString()
        });
        reject(new Error('Bet placement timed out. Please try again.'));
      }, 7000);

      this.socket.emit('placeBet', authenticatedBetDetails, (response: any) => {
        // Clear timeout
        clearTimeout(placementTimeout);

        console.log('📥 Complete Bet Placement Response', {
          fullResponse: JSON.stringify(response),
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : 'No Response',
          timestamp: new Date().toISOString()
        });

        // Comprehensive error handling
        if (!response) {
          console.error('❌ No response received from server', {
            betAmount: betDetails.amount,
            timestamp: new Date().toISOString()
          });
          return reject(new Error('No response from server. Please check your connection.'));
        }

        // Detailed authentication error logging
        if (!response.success) {
          console.error('❌ Bet Placement Authentication Failure', {
            errorMessage: response.message || 'Unknown authentication error',
            errorType: response.type || 'Unknown',
            providedTokenLength: authToken.length,
            providedUserId: userId,
            socketConnected: this.socket.connected,
            timestamp: new Date().toISOString()
          });

          // More informative error message
          const errorMessage = response.message || 'Authentication failed. Please log in again.';
          return reject(new Error(errorMessage));
        }

        // Successful bet placement
        const betResponse: BetResponse = {
          playerBetId: response.betId || '',
          status: 'placed',
          betAmount: betDetails.amount,
          payoutAmount: response.payoutAmount || 0,
          message: 'Bet placed successfully'
        };

        resolve(betResponse);
      });
    });
  }

  // Utility method to mask token for safe logging
  private maskToken(token: string): string {
    if (!token) return 'No Token';
    return token.length > 10 
      ? `${token.slice(0, 5)}...${token.slice(-5)}` 
      : 'Short Token';
  }

  async cashoutBet(playerBetId: string): Promise<BetResponse> {
    return new Promise((resolve, reject) => {
      // Ensure socket is connected before emitting
      if (!this.socket.connected) {
        this.socket = this.createSocketConnection(this.fallbackUrls[0]);
      }

      this.socket.emit('cashoutBet', { playerBetId }, (response: BetResponse) => {
        if (response && response.status === 'cashed_out') {
          resolve(response);
        } else {
          reject(new Error('Cashout failed'));
        }
      });
    });
  }

  async getActiveBets(): Promise<BetResponse[]> {
    try {
      const token = this.getAuthToken();
      const response = await axios.get(`${this.baseUrl}/active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching active bets:', error);
      throw error;
    }
  }

  // Clean up socket connection
  disconnect() {
    this.socket.disconnect();
  }
}

export default new BettingService();