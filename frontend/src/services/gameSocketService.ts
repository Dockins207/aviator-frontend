import io, { Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';

// Player interface for game participants
export interface Player {
  id: string;
  username: string;
  betAmount?: number;
  cashoutMultiplier?: number;
  status: 'betting' | 'playing' | 'cashed_out' | 'crashed';
}

// Updated GameState interface with player tracking
export interface GameState {
  gameId?: string;
  status: 'betting' | 'flying' | 'crashed';
  betAmount?: number;
  multiplier?: number;
  startTime?: number;
  crashPoint?: number;
  countdown?: number;
  players: Player[];
  totalPlayers: number;
  totalBetAmount: number;
}

class GameSocketService {
  private socket: Socket | null = null;
  private socketInitPromise: Promise<Socket> | null = null;
  private gameState: GameState = {
    status: 'betting',
    players: [],
    totalPlayers: 0,
    totalBetAmount: 0
  };
  private gameStateListeners: Array<(state: GameState) => void> = [];

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket(): Promise<Socket> {
    // If socket initialization is already in progress, return the existing promise
    if (this.socketInitPromise) {
      console.log('[SOCKET] Existing initialization in progress');
      return this.socketInitPromise;
    }

    console.log('[SOCKET] Starting initialization process');
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    console.log('[SOCKET] Backend URL:', backendUrl);
    
    // Enhanced user authentication retrieval
    this.socketInitPromise = new Promise(async (resolve, reject) => {
      try {
        // Verify authentication details
        const token = AuthService.getToken();
        const profile = await AuthService.getProfile();

        console.log('[SOCKET] Authentication check:', {
          tokenExists: !!token,
          profileExists: !!profile
        });

        if (!token || !profile) {
          const errorMsg = !token ? 'No authentication token' : 'No user profile';
          console.error(`[SOCKET] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // Ensure previous socket is disconnected
        if (this.socket) {
          console.log('[SOCKET] Disconnecting previous socket');
          this.socket.disconnect();
        }

        console.log('[SOCKET] Preparing connection with:', {
          userId: profile.id,
          username: profile.username
        });
        
        // Configure socket connection with authentication
        const socket = io(backendUrl, {
          auth: {
            userId: profile.id,
            username: profile.username,
            token: token
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
          transports: ['websocket', 'polling']  // Explicit transport specification
        });

        // Comprehensive event listeners
        socket.on('connect', () => {
          console.log('[SOCKET] Connected successfully. Socket ID:', socket.id);
          this.socket = socket;
          this.setupGameStateListeners();
          resolve(socket);
        });

        socket.on('connect_error', (error) => {
          console.error('[SOCKET] Connection error:', {
            name: error.name,
            message: error.message
          });
          this.socketInitPromise = null;
          this.socket = null;
          reject(error);
        });

        socket.on('connect_timeout', () => {
          console.error('[SOCKET] Connection timeout');
          this.socketInitPromise = null;
          this.socket = null;
          reject(new Error('Socket connection timeout'));
        });

        socket.on('disconnect', (reason) => {
          console.warn('[SOCKET] Disconnected:', reason);
          this.socketInitPromise = null;
          this.socket = null;
        });

        // Add error event listener
        socket.on('error', (error) => {
          console.error('[SOCKET] Socket error:', error);
          this.socketInitPromise = null;
          this.socket = null;
          reject(error);
        });
      } catch (error) {
        console.error('[SOCKET] Initialization failed:', error);
        this.socketInitPromise = null;
        this.socket = null;
        reject(error);
      }
    });

    return this.socketInitPromise;
  }

  private setupGameStateListeners() {
    // Ensure socket exists before setting up listeners
    if (!this.socket) {
      console.warn('Attempted to setup game state listeners without an active socket');
      return;
    }

    // Safely remove any existing listeners to prevent duplicates
    this.socket.off('gameStateUpdate');
    this.socket.off('playerJoined');
    this.socket.off('playerLeft');
    this.socket.off('playerBet');
    this.socket.off('playerCashout');
    this.socket.off('gameStarted');
    this.socket.off('gameCrashed');

    // Listen for comprehensive game state updates
    this.socket.on('gameStateUpdate', (state: Partial<GameState>) => {
      if (!state) {
        console.warn('Received empty game state');
        return;
      }

      console.group('Game State Update');
      console.log('Raw State:', JSON.stringify(state, null, 2));
      
      // Merge new state with existing state, preserving players if not provided
      this.gameState = { 
        ...this.gameState, 
        ...state,
        players: state.players || this.gameState.players,
        totalPlayers: state.totalPlayers ?? this.gameState.totalPlayers,
        totalBetAmount: state.totalBetAmount ?? this.gameState.totalBetAmount
      };
      
      console.log('Updated Game State:', JSON.stringify(this.gameState, null, 2));
      console.groupEnd();

      // Notify all registered listeners
      this.gameStateListeners.forEach(listener => {
        try {
          listener(this.gameState);
        } catch (error) {
          console.error('Error in game state listener:', error);
        }
      });
    });

    // Player joined game event
    this.socket.on('playerJoined', (player: Player) => {
      console.log('Player Joined:', player);
      
      // Add player to game state if not already present
      const existingPlayerIndex = this.gameState.players.findIndex(p => p.id === player.id);
      if (existingPlayerIndex === -1) {
        this.gameState.players.push(player);
        this.gameState.totalPlayers++;
      }

      // Trigger game state update
      this.updateGameState({
        players: this.gameState.players,
        totalPlayers: this.gameState.totalPlayers
      });
    });

    // Player left game event
    this.socket.on('playerLeft', (playerId: string) => {
      console.log('Player Left:', playerId);
      
      // Remove player from game state
      const updatedPlayers = this.gameState.players.filter(p => p.id !== playerId);
      this.gameState.players = updatedPlayers;
      this.gameState.totalPlayers = updatedPlayers.length;

      // Trigger game state update
      this.updateGameState({
        players: updatedPlayers,
        totalPlayers: updatedPlayers.length
      });
    });

    // Player bet event
    this.socket.on('playerBet', (betInfo: { 
      playerId: string, 
      betAmount: number 
    }) => {
      console.log('Player Bet:', betInfo);
      
      // Update player bet in game state
      const playerIndex = this.gameState.players.findIndex(p => p.id === betInfo.playerId);
      if (playerIndex !== -1) {
        this.gameState.players[playerIndex].betAmount = betInfo.betAmount;
        this.gameState.players[playerIndex].status = 'playing';
        
        // Recalculate total bet amount
        this.gameState.totalBetAmount = this.gameState.players.reduce(
          (total, player) => total + (player.betAmount || 0), 
          0
        );
      }

      // Trigger game state update
      this.updateGameState({
        players: this.gameState.players,
        totalBetAmount: this.gameState.totalBetAmount
      });
    });

    // Player cashout event
    this.socket.on('playerCashout', (cashoutInfo: { 
      playerId: string, 
      multiplier: number 
    }) => {
      console.log('Player Cashout:', cashoutInfo);
      
      // Update player cashout in game state
      const playerIndex = this.gameState.players.findIndex(p => p.id === cashoutInfo.playerId);
      if (playerIndex !== -1) {
        this.gameState.players[playerIndex].cashoutMultiplier = cashoutInfo.multiplier;
        this.gameState.players[playerIndex].status = 'cashed_out';
      }

      // Trigger game state update
      this.updateGameState({
        players: this.gameState.players
      });
    });

    // Game started event
    this.socket.on('gameStarted', (gameStartData) => {
      console.log('Game Started:', gameStartData);
      
      // Reset player statuses and prepare for new game
      const updatedPlayers = this.gameState.players.map(player => ({
        ...player,
        status: 'playing' as Player['status'],
        betAmount: undefined,
        cashoutMultiplier: undefined
      }));

      this.updateGameState({ 
        status: 'flying',
        players: updatedPlayers,
        startTime: Date.now()
      });
    });

    // Game crashed event
    this.socket.on('gameCrashed', (crashPoint) => {
      console.log('Game Crashed at:', crashPoint);
      
      // Update player statuses based on crash
      const updatedPlayers = this.gameState.players.map(player => {
        const status = player.cashoutMultiplier && player.cashoutMultiplier < crashPoint 
          ? 'cashed_out' 
          : 'crashed';
        
        return {
          ...player,
          status: status as Player['status']
        };
      });

      this.updateGameState({ 
        status: 'crashed', 
        crashPoint,
        players: updatedPlayers
      });
    });
  }

  // Request current game state from server
  private requestGameState() {
    if (!this.socket) return;

    console.log('Requesting initial game state');
    this.socket.emit('requestGameState', (response: GameState) => {
      if (response) {
        console.log('Received initial game state:', response);
        this.updateGameState(response);
      } else {
        console.warn('No initial game state received');
      }
    });
  }

  // Update game state and notify listeners
  private updateGameState(newState: Partial<GameState>) {
    this.gameState = { ...this.gameState, ...newState };
    
    // Notify listeners
    this.gameStateListeners.forEach(listener => {
      try {
        listener(this.gameState);
      } catch (error) {
        console.error('Error in game state listener:', error);
      }
    });
  }

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

  // Place a bet with callback
  placeBet(betData: { betAmount: number }) {
    if (!this.socket) {
      toast.error('Socket not connected');
      return;
    }

    console.log('[SOCKET] Place Bet:', JSON.stringify(betData, null, 2));
    
    this.socket.emit('placeBet', betData, (response: { 
      success: boolean, 
      message?: string, 
      remainingBalance?: number,
      betId?: string 
    }) => {
      if (response.success) {
        toast.success('Bet placed successfully');
        
        // Optionally update balance or game state
        if (response.remainingBalance !== undefined) {
          // You might want to dispatch an action or use a state management solution
          console.log('Updated Balance:', response.remainingBalance);
        }
      } else {
        toast.error(response.message || 'Failed to place bet');
      }
    });
  }

  // Cashout a bet with callback
  cashoutBet(betId: string) {
    if (!this.socket) {
      toast.error('Socket not connected');
      return;
    }

    this.socket.emit('cashoutBet', { betId }, (response: { 
      success: boolean, 
      message?: string, 
      remainingBalance?: number,
      winnings?: number 
    }) => {
      if (response.success) {
        toast.success('Bet cashed out successfully');
        
        if (response.winnings !== undefined) {
          console.log('Winnings:', response.winnings);
        }
        
        if (response.remainingBalance !== undefined) {
          console.log('Updated Balance:', response.remainingBalance);
        }
      } else {
        toast.error(response.message || 'Failed to cashout bet');
      }
    });
  }

  // Get current game state
  getGameState() {
    return this.gameState;
  }

  // Connect to WebSocket (compatibility method)
  connect(): Promise<Socket> {
    console.log('[SOCKET] Connect method called');
    
    // If socket is not initialized, initialize it
    if (!this.socket) {
      console.log('[SOCKET] No existing socket, initializing');
      return this.initializeSocket();
    }
    
    // If socket exists and is connected, return it
    if (this.socket.connected) {
      console.log('[SOCKET] Existing socket is connected');
      return Promise.resolve(this.socket);
    }
    
    // If socket exists but is not connected, reinitialize
    console.log('[SOCKET] Existing socket not connected, reinitializing');
    return this.initializeSocket();
  }

  // Ensure socket is connected before performing operations
  async ensureConnection(): Promise<Socket> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    return new Promise((resolve, reject) => {
      // Ensure socket is initialized
      if (!this.socket) {
        this.initializeSocket();
      }

      // Wait for connection with timeout
      const connectionTimeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);

      this.socket!.on('connect', () => {
        clearTimeout(connectionTimeout);
        resolve(this.socket!);
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        reject(error);
      });
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Get current socket instance
  getSocket() {
    return this.socket;
  }
}

export default new GameSocketService();
