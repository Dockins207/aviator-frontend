import io, { Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';

// Game state interface for Aviator game
export interface GameState {
  gameId?: string;
  status: 'waiting' | 'flying' | 'crashed';
  multiplier: number;
  startTime?: number;
  crashPoint?: number;
  countdown?: number;
  currentMultiplier?: number;
}

class GameSocketService {
  private socket: Socket | null = null;
  private socketInitPromise: Promise<Socket> | null = null;
  
  // Current game state
  private gameState: GameState = {
    status: 'waiting',
    multiplier: 1,
    currentMultiplier: 1
  };

  // Listeners for game state changes
  private gameStateListeners: Array<(state: GameState) => void> = [];

  constructor() {
    this.initializeSocket();
  }

  // Initialize socket connection
  private async initializeSocket(): Promise<Socket | never> {
    if (this.socketInitPromise) return this.socketInitPromise;

    if (typeof window === 'undefined') {
      throw new Error('Cannot initialize socket on server side');
    }

    this.socketInitPromise = new Promise(async (resolve, reject) => {
      try {
        const accessToken = AuthService.getToken();
        const profile = await AuthService.getProfile();
        
        if (!accessToken || !profile) {
          reject(new Error('Authentication required. Please login to continue.'));
          return;
        }

        this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://192.168.0.12:8000', {
          auth: { 
            token: accessToken,
            username: profile.username
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        this.setupGameStateListeners();

        this.socket.on('connect', () => {
          console.log('Game socket connected successfully');
          resolve(this.socket!);
        });

        this.socket.on('connect_error', (error) => {
          console.error('Game socket connection error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Socket initialization error:', error);
        reject(error);
      }
    });

    return this.socketInitPromise;
  }

  // Set up listeners for game events
  private setupGameStateListeners() {
    if (!this.socket) return;

    // Listen for game state updates
    this.socket.on('gameStateUpdate', (newState: Partial<GameState>) => {
      this.updateGameState(newState);
    });

    // Listen for multiplier updates
    this.socket.on('multiplierUpdate', (multiplier: number) => {
      this.updateGameState({ 
        currentMultiplier: multiplier,
        status: multiplier > 1 ? 'flying' : 'waiting'
      });
    });

    // Listen for game start
    this.socket.on('gameStarted', () => {
      this.updateGameState({ 
        status: 'waiting', 
        multiplier: 1,
        currentMultiplier: 1,
        startTime: Date.now()
      });
    });

    // Listen for game crash
    this.socket.on('gameCrashed', (crashPoint: number) => {
      this.updateGameState({ 
        status: 'crashed', 
        crashPoint,
        currentMultiplier: crashPoint
      });
    });
  }

  // Update game state and notify listeners
  private updateGameState(newState: Partial<GameState>) {
    this.gameState = { ...this.gameState, ...newState };
    
    // Notify all registered listeners
    this.gameStateListeners.forEach(listener => {
      try {
        listener(this.gameState);
      } catch (error) {
        console.error('Error in game state listener:', error);
      }
    });
  }

  // Public methods for game state management

  // Add a listener for game state updates
  addGameStateListener(listener: (state: GameState) => void) {
    this.gameStateListeners.push(listener);
    
    // Immediately call listener with current state
    listener(this.gameState);
  }

  // Remove a specific listener
  removeGameStateListener(listener: (state: GameState) => void) {
    this.gameStateListeners = this.gameStateListeners.filter(l => l !== listener);
  }

  // Get current game state
  getGameState(): GameState {
    return this.gameState;
  }

  // Get current multiplier
  getCurrentMultiplier(): number {
    return this.gameState.currentMultiplier || 1;
  }

  // Ensure socket connection
  async ensureConnection(): Promise<Socket> {
    if (!this.socket) {
      return this.initializeSocket();
    }
    return this.socket;
  }

  // Get current socket
  getSocket(): Socket | null {
    return this.socket;
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.socketInitPromise = null;
    }
  }

  // Manually reconnect socket
  public async reconnectSocket(): Promise<Socket> {
    // Disconnect existing socket if it exists
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Reset initialization promise
    this.socketInitPromise = null;

    try {
      // Reinitialize socket
      const newSocket = await this.initializeSocket();
      
      // Log reconnection attempt
      console.log('Socket reconnected successfully');
      toast.success('Socket connection restored');

      return newSocket;
    } catch (error) {
      console.error('Socket reconnection failed', error);
      toast.error('Failed to restore socket connection');
      throw error;
    }
  }

  // Get current socket status
  public getSocketStatus() {
    return {
      connected: !!this.socket?.connected,
      id: this.socket?.id
    };
  }
}

const instance = new GameSocketService();

export default instance;
