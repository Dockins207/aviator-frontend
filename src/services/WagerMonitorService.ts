import io, { Socket } from 'socket.io-client';
import { makeAutoObservable } from 'mobx';
import axios /* , { AxiosError } */ from 'axios';

// Expanded TypeScript interfaces for type safety
export interface Wager {
  id: string;
  userId: string;
  gameId: string;
  betAmount: number;
  cashoutPoint: string | number;
  cashoutAmount: string | number;
  status: 'active' | 'completed' | 'crashed';
  multiplier?: number;
  createdAt: string;
  updatedAt?: string;
  gameCrashed?: boolean;
}

// Define response types for socket and HTTP events
interface SocketResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

interface BetPlacementResponse extends SocketResponse<Wager> {
  wager?: Wager;
}

interface LiveBetsResponse extends SocketResponse<Wager[]> {
  liveBets?: Wager[];
}

// Game crash interfaces
interface WagerCrashPayload {
  wagerId: string;
}

interface GlobalGameCrashPayload {
  gameId: string;
}

class WagerMonitorService {
  private socket: Socket;
  private baseUrl: string; // Base URL for HTTP requests
  private socketUrl: string; // Socket connection URL
  
  // Observables for MobX state management
  public currentWager: Wager | null = null;
  public activeWagers: Wager[] = [];
  public lastCashedOutWager: Wager | null = null;
  public error: string | null = null;

  constructor(
    private customToken?: string, 
    baseUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000',
    socketUrl: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000'
  ) {
    makeAutoObservable(this);
    
    this.baseUrl = baseUrl;
    this.socketUrl = socketUrl;

    // Log connection attempt
    console.log(`🔌 Wager Monitor: Attempting to connect to ${this.socketUrl}/wager-monitor`);

    // Initialize socket connection with recommended settings
    this.socket = io(`${this.socketUrl}/wager-monitor`, {
      auth: {
        token: customToken || this.getStoredToken()
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ['websocket', 'polling']
    });

    // Detailed connection logging
    this.socket.on('connect', () => {
      console.log(`✅ Wager Monitor: Successfully connected to ${this.socketUrl}/wager-monitor`);
      this.error = null;
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Wager Monitor: Connection Failed`, {
        url: `${this.socketUrl}/wager-monitor`,
        error: error.message
      });
      this.error = `Socket connection failed: ${error.message}`;
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`⚠️ Wager Monitor: Disconnected`, {
        reason,
        url: `${this.socketUrl}/wager-monitor`
      });
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔁 Wager Monitor: Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error(`❌ Wager Monitor: Reconnection Failed`, {
        error: error.message
      });
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    // Bet placement listener
    this.socket.on('bet_placed', (data: { userId: string, wager: Wager }) => {
      if (data.userId === this.getUserId()) {
        this.currentWager = data.wager;
        this.activeWagers.push(data.wager);
      }
    });

    // Cashout listener
    this.socket.on('bet_cashout', (data: { userId: string, wager: Wager }) => {
      if (data.userId === this.getUserId()) {
        this.lastCashedOutWager = data.wager;
        this.removeWagerFromActive(data.wager.id);
      }
    });

    // Game crash listeners
    this.socket.on('wager_crashed', (data: { userId: string, wager: Wager }) => {
      if (data.userId === this.getUserId()) {
        this.removeWagerFromActive(data.wager.id);
      }
    });

    this.socket.on('global_game_crashed', (data: { gameId: string, crashedWagers: Wager[] }) => {
      // Handle global game crash
      this.activeWagers = this.activeWagers.filter(
        wager => !data.crashedWagers.some(crashed => crashed.id === wager.id)
      );
    });

    // Live bets update listener
    this.socket.on('live_bets_update', (data: { liveBets: Wager[] }) => {
      this.activeWagers = data.liveBets;
    });

    // Error handling
    this.socket.on('connect_error', (error: Error) => {
      this.error = `Socket connection error: ${error.message}`;
    });
  }

  // HTTP-based bet placement (fallback method)
  async placeBetHTTP(gameId: string, betAmount: number): Promise<Wager> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/wager/place`, 
        { gameId, betAmount },
        { 
          headers: { 
            Authorization: `Bearer ${this.getStoredToken()}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      this.currentWager = response.data.wager;
      return response.data.wager;
    } catch (error: unknown) {
      // Type guard to check if error is an AxiosError
      if (axios.isAxiosError(error)) {
        console.error('Bet placement axios error:', error.response?.data);
        this.error = error.response?.data?.error || 'Bet placement network error';
      } else if (error instanceof Error) {
        console.error('Bet placement error:', error.message);
        this.error = error.message;
      } else {
        console.error('Unexpected bet placement error:', error);
        this.error = 'Unexpected bet placement error';
      }
      throw error;
    }
  }

  // Socket-based bet placement
  placeBet(gameId: string, betAmount: number): Promise<Wager> {
    return new Promise<Wager>((resolve, reject) => {
      this.socket.emit('place_bet', { gameId, betAmount }, (response: BetPlacementResponse) => {
        if (response.success && response.wager) {
          this.currentWager = response.wager;
          resolve(response.wager);
        } else {
          // Fallback to HTTP method if socket fails
          this.placeBetHTTP(gameId, betAmount)
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  // Socket-based cashout
  async cashoutBet(cashoutPoint: number, multiplier: number): Promise<Wager> {
    // Throw an error if no current wager exists
    if (!this.currentWager) {
      throw new Error('No active wager to cashout');
    }

    // Safely destructure current wager to avoid null checks later
    const { id: wagerId } = this.currentWager;

    return new Promise<Wager>((resolve, reject) => {
      this.socket.emit('cashout_bet', {
        wagerId,
        cashoutPoint,
        multiplier
      }, async (response: BetPlacementResponse) => {
        if (response.success && response.wager) {
          this.lastCashedOutWager = response.wager;
          this.currentWager = null;
          resolve(response.wager);
        } else {
          // Fallback to HTTP cashout
          try {
            const httpResponse = await axios.post(`${this.baseUrl}/api/wager/cashout`, 
              { 
                wagerId, 
                cashoutPoint, 
                multiplier 
              },
              { 
                headers: { 
                  Authorization: `Bearer ${this.getStoredToken()}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            
            this.lastCashedOutWager = httpResponse.data.wager;
            this.currentWager = null;
            resolve(httpResponse.data.wager);
          } catch (error: unknown) {
            // Type guard to check if error is an AxiosError
            if (axios.isAxiosError(error)) {
              console.error('Cashout axios error:', error.response?.data);
              this.error = error.response?.data?.error || 'Cashout network error';
            } else if (error instanceof Error) {
              console.error('Cashout error:', error.message);
              this.error = error.message;
            } else {
              console.error('Unexpected cashout error:', error);
              this.error = 'Unexpected cashout error';
            }
            reject(error);
          }
        }
      });
    });
  }

  // Retrieve live bets (with HTTP fallback)
  getLiveBets(): Promise<Wager[]> {
    console.log('🔍 Attempting to retrieve live bets');
    
    return new Promise<Wager[]>((resolve, reject) => {
      // Check socket connection before emitting
      if (!this.socket.connected) {
        console.warn('⚠️ Socket not connected. Attempting to connect before fetching live bets');
        this.socket.connect();
      }

      this.socket.emit('get_live_bets', {}, async (response: LiveBetsResponse) => {
        console.log('🟢 Live bets socket response received:', response);

        if (response && response.success) {
          const liveBets = response.liveBets || [];
          console.log(`✅ Retrieved ${liveBets.length} live bets via socket`);
          resolve(liveBets);
        } else {
          console.warn('❌ Socket live bets retrieval failed. Falling back to HTTP');
          
          // Fallback to HTTP method
          try {
            const httpResponse = await axios.get(`${this.baseUrl}/api/wager/live`, {
              headers: { 
                Authorization: `Bearer ${this.getStoredToken()}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log('🌐 Live bets retrieved via HTTP:', httpResponse.data);
            resolve(httpResponse.data.liveBets || []);
          } catch (error: unknown) {
            // Type guard to check if error is an AxiosError
            if (axios.isAxiosError(error)) {
              console.error('🚨 Live bets axios error:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
              });
              this.error = error.response?.data?.error || 'Live bets network error';
            } else if (error instanceof Error) {
              console.error('🚨 Live bets error:', error.message);
              this.error = error.message;
            } else {
              console.error('🚨 Unexpected live bets error:', error);
              this.error = 'Unexpected live bets error';
            }
            reject(error);
          }
        }
      });
    });
  }

  // Handle individual wager crash
  handleWagerCrash(payload: WagerCrashPayload): Promise<Wager> {
    return new Promise<Wager>((resolve, reject) => {
      this.socket.emit('handle_wager_crash', payload, (response: BetPlacementResponse) => {
        if (response.success && response.wager) {
          this.removeWagerFromActive(payload.wagerId);
          resolve(response.wager);
        } else {
          reject(new Error(response.error || 'Wager crash handling failed'));
        }
      });
    });
  }

  // Handle global game crash
  handleGlobalGameCrash(payload: GlobalGameCrashPayload): Promise<Wager[]> {
    return new Promise<Wager[]>((resolve, reject) => {
      this.socket.emit('handle_global_game_crash', payload, (response: LiveBetsResponse) => {
        if (response.success) {
          // Clear active wagers for the crashed game
          this.activeWagers = this.activeWagers.filter(
            wager => wager.gameId !== payload.gameId
          );
          resolve(response.liveBets || []);
        } else {
          reject(new Error(response.error || 'Global game crash handling failed'));
        }
      });
    });
  }

  // Utility methods
  private getUserId(): string {
    return this.getStoredToken() || '';
  }

  private getStoredToken(): string | null {
    try {
      // First, try localStorage
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) return token;
      }

      // Fallback to sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        const token = sessionStorage.getItem('token');
        if (token) return token;
      }

      // Fallback to cookies if available
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
        if (tokenCookie) {
          return tokenCookie.split('=')[1];
        }
      }

      console.warn('🚨 No authentication token found');
      return null;
    } catch (error) {
      console.error('🔒 Token Retrieval Error:', error);
      return null;
    }
  }

  private removeWagerFromActive(wagerId: string) {
    this.activeWagers = this.activeWagers.filter(w => w.id !== wagerId);
  }

  // Disconnect socket on cleanup
  disconnect() {
    this.socket.disconnect();
  }

  // Method to manually reconnect socket if needed
  reconnectSocket() {
    if (this.socket.disconnected) {
      this.socket.connect();
    }
  }

  // Method to check current socket connection status
  isSocketConnected(): boolean {
    return this.socket.connected;
  }

  // Static method to create a new instance or return existing singleton
  static getInstance(customToken?: string): WagerMonitorService {
    if (!WagerMonitorService.instance) {
      WagerMonitorService.instance = new WagerMonitorService(customToken);
    }
    return WagerMonitorService.instance;
  }

  // Static property to hold singleton instance
  private static instance: WagerMonitorService;
}

// Export both the class and a singleton instance
export { WagerMonitorService };
export default WagerMonitorService.getInstance();
