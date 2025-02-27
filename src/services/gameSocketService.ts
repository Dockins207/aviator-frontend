import { io, Socket } from 'socket.io-client';
import { getSocketAuthPayload, BASE_URL } from '../utils/authUtils';
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
  private static instance: GameSocketService;
  private socket: Socket | null = null;
  private gameState: GameState = {
    status: 'waiting',
    multiplier: 1,
    currentMultiplier: 1
  };
  private gameStateListeners: Array<(state: GameState) => void> = [];

  private constructor() {}

  static getInstance(): GameSocketService {
    if (!GameSocketService.instance) {
      GameSocketService.instance = new GameSocketService();
    }
    return GameSocketService.instance;
  }

  connect() {
    // Use shared socket authentication payload
    const auth = getSocketAuthPayload();

    this.socket = io(BASE_URL, {
      path: '/socket.io',
      auth,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000
    });

    this.setupListeners();
    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Game socket connected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Game socket connection error:', error);
      // Potential re-authentication or user notification
    });

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

  disconnect() {
    this.socket?.disconnect();
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export default GameSocketService;
