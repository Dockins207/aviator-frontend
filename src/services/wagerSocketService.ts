import io, { Socket } from 'socket.io-client';

// Export the interface to make it available for import
export interface WagerData {
  id?: string;
  username: string;
  userId?: string;
  betAmount: number;
  gameId?: string;
  cashoutAmount?: number;
  cashoutPoint?: number;
  currentMultiplier?: number;
  status?: 'active' | 'completed' | 'crashed';
  userProfile?: {
    displayName?: string;
    avatar?: string;
  };
}

// Define interfaces for better type safety
interface WagerError {
  message: string;
  code?: string;
  status?: number;
}

interface WagerSocketResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

class WagerSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  
  // Local state for live bets
  private liveBets: WagerData[] = [];

  // Observers for live bets updates
  private liveBetsObservers: Array<(bets: WagerData[]) => void> = [];

  // Register an observer for live bets updates
  registerLiveBetsObserver(observer: (bets: WagerData[]) => void) {
    this.liveBetsObservers.push(observer);
  }

  // Unregister an observer
  unregisterLiveBetsObserver(observer: (bets: WagerData[]) => void) {
    this.liveBetsObservers = this.liveBetsObservers.filter(obs => obs !== observer);
  }

  // Notify observers about live bets update
  private notifyLiveBetsObservers() {
    this.liveBetsObservers.forEach(observer => observer(this.liveBets));
  }

  connect(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.token = token;

    this.socket = io(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000'}/wager-monitor`, {
      auth: {
        token: token
      }
    });

    this.setupListeners();

    return new Promise<void>((resolve, reject) => {
      this.socket?.on('connect', () => {
        console.log('✅ Wager Socket Connected Successfully');
        resolve();
      });

      this.socket?.on('connect_error', (error) => {
        console.error('❌ Wager Socket Connection Failed:', error);
        reject(error);
      });
    });
  }

  private setupListeners() {
    if (!this.socket) return;

    // Bet Placement Listener
    this.socket.on('bet_placed', (data: WagerData) => {
      // Format bet amount
      data.betAmount = this.formatBetAmount(data.betAmount);

      // Prioritize username fallback mechanism
      data.username = data.username || 
                      data.userProfile?.displayName || 
                      data.userId || 
                      'Unknown Player';

      // Add bet to live bets
      this.liveBets.push(data);
      this.notifyLiveBetsObservers();

      console.log('🎲 New Bet Placed:', {
        username: data.username,  // Guaranteed to have a value
        betAmount: data.betAmount
      });
      this.dispatchBetPlaced(data);
    });

    // New listener for game data clearing
    this.socket.on('game:data_cleared', () => {
      console.log('🧹 Game data cleared: Resetting live bets');
      
      // Clear all live bets
      this.liveBets = [];
      
      // Notify observers
      this.notifyLiveBetsObservers();
    });

    // Bet Cashout Listener
    this.socket.on('bet_cashout', (data: WagerData) => {
      // Format bet and cashout amounts
      data.betAmount = this.formatBetAmount(data.betAmount);
      data.cashoutAmount = this.formatBetAmount(data.cashoutAmount || 0);

      // Prioritize username fallback mechanism
      data.username = data.username || 
                      data.userProfile?.displayName || 
                      data.userId || 
                      'Unknown Player';

      // Remove the bet from live bets
      this.liveBets = this.liveBets.filter(bet => bet.id !== data.id);
      this.notifyLiveBetsObservers();

      console.log('💰 Bet Cashed Out:', {
        username: data.username,
        betAmount: data.betAmount,
        cashoutAmount: data.cashoutAmount
      });
      this.dispatchBetCashout(data);
    });

    // Wager Crash Listener
    this.socket.on('wager_crashed', (data: WagerData) => {
      // Format bet amount
      data.betAmount = this.formatBetAmount(data.betAmount);

      // Prioritize username fallback mechanism
      data.username = data.username || 
                      data.userProfile?.displayName || 
                      data.userId || 
                      'Unknown Player';

      // Clear live bets on wager crash
      this.liveBets = [];
      this.notifyLiveBetsObservers();

      console.log('💥 Wager Crashed:', {
        username: data.username,
        betAmount: data.betAmount
      });
      this.dispatchWagerCrashed(data);
    });

    // Add a more robust listener for game crash event
    this.socket.on('game_state_update', (gameState: { 
      status: 'waiting' | 'flying' | 'crashed', 
      multiplier?: number 
    }) => {
      console.log('🎮 Game State Update:', gameState);

      if (gameState.status === 'crashed') {
        console.log('💥 Game Crashed - Triggering Data Clear');
        
        // Clear game data
        this.clearGameData();

        // Dispatch custom events with multiple methods
        window.dispatchEvent(new CustomEvent('game_crashed', { 
          detail: { 
            timestamp: Date.now(),
            reason: 'Game crashed' 
          } 
        }));

        // Fallback broadcast method
        const broadcastEvent = () => {
          const event = document.createEvent('Event');
          event.initEvent('game_crashed', true, true);
          window.dispatchEvent(event);
        };
        broadcastEvent();
      }
    });
  }

  // Utility method to format bet amounts
  private formatBetAmount(amount: number): number {
    return Number(amount.toFixed(2));
  }

  // Method to validate and format bet amount
  private validateBetAmount(amount: number): number {
    // Ensure positive amount
    if (amount <= 0) {
      throw new Error('Bet amount must be greater than zero');
    }

    // Format to two decimal places
    return this.formatBetAmount(amount);
  }

  async placeBet(gameId: string, betAmount: number): Promise<WagerData> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    // Validate and format bet amount
    const formattedBetAmount = this.validateBetAmount(betAmount);

    return new Promise((resolve, reject) => {
      this.socket?.emit('place_bet', 
        { 
          gameId, 
          betAmount: formattedBetAmount 
        }, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            // Ensure the returned bet also has formatted amount
            const processedBet = {
              ...response.bet,
              betAmount: this.formatBetAmount(response.bet.betAmount)
            };
            resolve(processedBet);
          }
        }
      );
    });
  }

  async cashoutBet(betId: string, currentMultiplier: number, cashoutMultiplier: number): Promise<WagerData> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('cashout_bet', { 
        betId, 
        currentMultiplier, 
        cashoutMultiplier 
      }, (response: { error?: string; bet?: WagerData }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          // Format bet and cashout amounts
          const processedBet = {
            ...response.bet!,
            betAmount: this.formatBetAmount(response.bet!.betAmount),
            cashoutAmount: this.formatBetAmount(response.bet!.cashoutAmount || 0)
          };
          resolve(processedBet);
        }
      });
    });
  }

  placeBetLegacy(gameId: string, betAmount: number) {
    return new Promise((resolve, reject) => {
      this.socket?.emit('place_bet', 
        { gameId, betAmount }, 
        (response: { success: boolean; betAmount?: number; gameId?: string; error?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(response.error);
          }
        }
      );
    });
  }

  cashoutBetLegacy(wagerId: string, cashoutPoint: number, multiplier: number) {
    return new Promise((resolve, reject) => {
      this.socket?.emit('cashout_bet', 
        { wagerId, cashoutPoint, multiplier }, 
        (response: { 
          success: boolean; 
          betAmount?: number; 
          cashoutAmount?: number; 
          cashoutPoint?: number; 
          error?: string 
        }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(response.error);
          }
        }
      );
    });
  }

  // Modify getLiveBets to return local state
  getLiveBets(): WagerData[] {
    return this.liveBets;
  }

  // Fetch live bets from server and update local state
  fetchLiveBets(): Promise<WagerData[]> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('get_live_bets', null, (response: { 
        success: boolean, 
        liveBets?: WagerData[], 
        error?: string 
      }) => {
        if (response.success) {
          // Update local live bets state
          this.liveBets = response.liveBets || [];
          
          // Notify observers
          this.notifyLiveBetsObservers();
          
          resolve(this.liveBets);
        } else {
          reject(response.error);
        }
      });
    });
  }

  // Clear game data method
  clearGameData() {
    try {
      // Clear local live bets
      this.liveBets = [];
      
      // Notify observers
      this.notifyLiveBetsObservers();

      // Clear storage
      const gameRelatedKeys = [
        'currentGameId',
        'activeBets',
        'lastBetPlaced',
        'gameMultiplier',
        'currentGameState',
        'liveBets',
        'gameStats'
      ];

      gameRelatedKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      console.log('🧹 Game data comprehensively cleared');
    } catch (error) {
      console.error('❌ Error clearing game data:', error);
    }
  }

  private dispatchBetPlaced(data: WagerData) {
    console.log('Dispatching Bet Placed:', data);
  }

  private dispatchBetCashout(data: WagerData) {
    console.log('Dispatching Bet Cashout:', data);
  }

  private dispatchWagerCrashed(data: WagerData) {
    console.log('Dispatching Wager Crashed:', data);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  // Replace first 'any' with proper error type
  private handleError(error: WagerError): WagerSocketResponse {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }

  // Replace second 'any' with proper error type
  private handleSocketError(error: WagerError): void {
    console.error('Socket error:', error);
    // ... existing code ...
  }
}

// Export as a named constant instead of anonymous default
const wagerSocketService = new WagerSocketService();
export default wagerSocketService;
