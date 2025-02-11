import { io, Socket } from 'socket.io-client';

// Define types for game state and actions
export interface Player {
  id: string;
  betAmount?: number;
  cashOutPoint?: number;
  potentialWinnings?: number;
  result?: {
    status: 'won' | 'lost';
    winnings: number;
  };
}

export interface GameState {
  status: 'betting' | 'flying' | 'crashed';
  gameId: string;
  countdown?: number;
  crashPoint?: string;
  multiplier?: string;
  startTime?: number;
  players: Player[];
}

class GameSocketService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private backendUrls: string[];

  constructor() {
    // Ensure backend URL is set, throw an error if not
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';
    if (!backendUrl) {
      throw new Error('NEXT_PUBLIC_BACKEND_URL is not set. Please configure the backend URL in your .env file.');
    }
    this.baseUrl = backendUrl;
    this.backendUrls = [
      this.baseUrl,
      'http://192.168.0.12:8000',
      'http://localhost:8000',
      'http://127.0.0.1:8000'
    ];
  }

  // Connect to WebSocket
  connect(): Socket {
    // If socket already exists and is connected, return it
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Create new socket connection
    this.socket = io(this.baseUrl, {
      transports: ['websocket', 'polling'],  // Add polling as fallback
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,  // Always create a new connection
      extraHeaders: {
        'X-Client-Timestamp': Date.now().toString(),
        'X-Client-Version': '1.0.0'
      }
    });

    // Minimal connection logging
    this.socket.on('connect', () => {
    });

    // Minimal connection error handling
    this.socket.on('connect_error', (error) => {
    });

    // Connection timeout handling
    this.socket.on('connect_timeout', () => {
    });

    return this.socket;
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get the current socket
  getSocket(): Socket | null {
    return this.socket;
  }

  // Ensure socket is connected before performing operations
  async ensureConnection(): Promise<Socket> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    return new Promise((resolve, reject) => {
      this.connect();
      
      if (!this.socket) {
        reject(new Error('Failed to initialize socket'));
        return;
      }

      this.socket.on('connect', () => {
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });
    });
  }

  // Ensure socket is connected before performing actions
  private ensureSocketConnected(): Socket {
    if (!this.socket) {
      this.connect();
    }
    return this.socket!;
  }

  // Join game
  joinGame(playerData: Partial<Player>) {
    const socket = this.ensureSocketConnected();
    console.log('[SOCKET] Join Game:', JSON.stringify(playerData, null, 2));
    socket.emit('joinGame', playerData);
  }

  // Place bet
  placeBet(betData: { betAmount: number }) {
    const socket = this.ensureSocketConnected();
    console.log('[SOCKET] Place Bet:', JSON.stringify(betData, null, 2));
    socket.emit('placeBet', betData);
  }

  // Cash out
  cashOut() {
    const socket = this.ensureSocketConnected();
    console.log('[SOCKET] Cash Out Request');
    socket.emit('cashOut');
  }

  // Listen for game state updates
  onGameStateUpdate(callback: (gameState: GameState) => void) {
    const socket = this.ensureSocketConnected();
    socket.on('gameStateUpdate', (gameState: GameState) => {
      console.log('[SOCKET] Game State Update:', JSON.stringify(gameState, null, 2));
      // Validate game state before calling callback
      if (this.validateGameState(gameState)) {
        callback(gameState);
      } else {
        console.warn('[SOCKET] Invalid game state received');
      }
    });
  }

  // Listen for join game response
  onJoinGameResponse(callback: (response: { success: boolean; message: string }) => void) {
    const socket = this.ensureSocketConnected();
    socket.on('joinGameResponse', (response) => {
      console.log('[SOCKET] Join Game Response:', JSON.stringify(response, null, 2));
      callback(response);
    });
  }

  // Listen for bet placement response
  onBetPlacementResponse(callback: (response: { success: boolean; message: string }) => void) {
    const socket = this.ensureSocketConnected();
    socket.on('betPlacementResponse', (response) => {
      console.log('[SOCKET] Bet Placement Response:', JSON.stringify(response, null, 2));
      callback(response);
    });
  }

  // Listen for cash out response
  onCashOutResponse(callback: (response: { success: boolean; message: string }) => void) {
    const socket = this.ensureSocketConnected();
    socket.on('cashOutResponse', (response) => {
      console.log('[SOCKET] Cash Out Response:', JSON.stringify(response, null, 2));
      callback(response);
    });
  }

  // Validate game state structure
  private validateGameState(gameState: GameState): boolean {
    const requiredFields = ['status', 'gameId'];
    return requiredFields.every(field => gameState.hasOwnProperty(field));
  }
}

export default new GameSocketService();
