import io, { Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';
import WalletService from '@/services/walletService'; // Corrected import

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
      return this.socketInitPromise;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';

    this.socketInitPromise = new Promise((resolve, reject) => {
      // Get the JWT token from AuthService
      const token = AuthService.getToken();

      if (!token) {
        reject(new Error('No authentication token found'));
        return;
      }

      // Create socket with token in auth object
      const socket = io(backendUrl, {
        auth: {
          token: token
        }
      });

      socket.on('connect', () => {
        console.log('Game socket connected successfully');
        this.socket = socket;
        this.setupGameStateListeners();
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.socketInitPromise = null;
        this.socket = null;
        reject(error);
      });

      socket.on('connect_timeout', () => {
        this.socketInitPromise = null;
        this.socket = null;
        reject(new Error('Socket connection timeout'));
      });

      socket.on('disconnect', (reason) => {
        this.socketInitPromise = null;
        this.socket = null;
      });

      // Add error event listener
      socket.on('error', (error) => {
        this.socketInitPromise = null;
        this.socket = null;
        reject(error);
      });
    });

    return this.socketInitPromise;
  }

  private setupGameStateListeners() {
    // Ensure socket exists before setting up listeners
    if (!this.socket) {
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
        return;
      }

      // Merge new state with existing state, preserving players if not provided
      this.gameState = { 
        ...this.gameState, 
        ...state,
        players: state.players || this.gameState.players,
        totalPlayers: state.totalPlayers ?? this.gameState.totalPlayers,
        totalBetAmount: state.totalBetAmount ?? this.gameState.totalBetAmount
      };

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

    this.socket.emit('requestGameState', (response: GameState) => {
      if (response) {
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
        }
        
        if (response.remainingBalance !== undefined) {
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

  // Get the current game multiplier
  getCurrentMultiplier(): number | undefined {
    // Return the current multiplier from the latest game state
    return this.gameState.multiplier;
  }

  // Connect to WebSocket (compatibility method)
  connect(): Promise<Socket> {
    if (!this.socket) {
      return this.initializeSocket();
    }
    
    if (this.socket.connected) {
      return Promise.resolve(this.socket);
    }
    
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

  // Retrieve current user's balance
  async getCurrentBalance(): Promise<number> {
    try {
      // Use WalletService to fetch balance
      const walletBalance = await WalletService.getWalletBalance();
      
      if (!walletBalance) {
        console.warn('🚨 Unable to retrieve wallet balance');
        return 0;
      }

      // Log balance retrieval for diagnostics
      console.group('💰 Game Socket Balance Retrieval');
      console.log('Balance:', walletBalance.balance);
      console.log('User ID:', walletBalance.user_id);
      console.groupEnd();

      return walletBalance.balance;
    } catch (error) {
      console.error('Failed to retrieve balance in GameSocketService:', error);
      return 0;
    }
  }

  // Optional: Subscribe to balance updates
  subscribeToBalanceUpdates(callback: (balance: number) => void): () => void {
    const balanceUpdateCallback = async () => {
      try {
        const balance = await this.getCurrentBalance();
        callback(balance);
      } catch (error) {
        console.error('Error in balance update subscription:', error);
      }
    };

    // Initial balance fetch
    balanceUpdateCallback();

    // Use WalletService's wallet update subscription
    const unsubscribe = WalletService.subscribeToWalletUpdates((update) => {
      callback(update.balance);
    });

    // Return unsubscribe function
    return unsubscribe;
  }
}

export default new GameSocketService();
