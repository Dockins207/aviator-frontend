import axios, { AxiosError } from 'axios';
import gameSocketService from './gameSocketService'; // Using existing socket service

// Restore the original backend URL for the remote machine
const BACKEND_URL = 'http://192.168.0.12:8000';

export interface BetRequest {
  amount: number;
  gameId?: string;
}

export interface BetResponse {
  success: boolean;
  betId?: string;
  message?: string;
  winnings?: number;
}

class BetService {
  private baseUrl = `${BACKEND_URL}/api/bet`; // Use full backend URL

  private axiosInstance = axios.create({
    baseURL: this.baseUrl,
    withCredentials: true,
    timeout: 10000, // 10-second timeout
  });

  // Centralized error handling
  private handleError(error: AxiosError, context: string) {
    if (error.response) {
      // Server responded with an error status
      console.error(`${context} - Server Error:`, {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      // Request made but no response received
      console.error(`${context} - Network Error:`, {
        url: error.config?.url,
        method: error.config?.method,
        networkError: error.message
      });
    } else {
      // Error setting up the request
      console.error(`${context} - Request Setup Error:`, error.message);
    }
    throw error;
  }

  // Place a bet
  async placeBet(amount: number, gameId?: string): Promise<BetResponse> {
    try {
      const response = await this.axiosInstance.post<BetResponse>('/place', {
        amount,
        gameId,
        user: 'currentUser' // TODO: Replace with actual user logic
      });

      // Ensure socket connection before emitting event
      try {
        await gameSocketService.ensureConnection();
        gameSocketService.getSocket()?.emit('betPlaced', {
          amount,
          betId: response.data.betId
        });
      } catch (socketError) {
        console.warn('Could not emit bet placed event:', socketError);
      }

      console.group('Bet Placement');
      console.log('Bet Request:', { amount, gameId });
      console.log('Bet Response:', response.data);
      console.groupEnd();

      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, 'Bet Placement');
      throw error;
    }
  }

  // Cash out a bet
  async cashOutBet(betId: string): Promise<BetResponse> {
    try {
      const response = await this.axiosInstance.post<BetResponse>('/cashout', {
        betId
      });

      // Ensure socket connection before emitting event
      try {
        await gameSocketService.ensureConnection();
        gameSocketService.getSocket()?.emit('betCashedOut', {
          betId,
          winnings: response.data.winnings
        });
      } catch (socketError) {
        console.warn('Could not emit bet cashout event:', socketError);
      }

      console.group('Bet Cashout');
      console.log('Cashout Request:', { betId });
      console.log('Cashout Response:', response.data);
      console.groupEnd();

      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, 'Bet Cashout');
      throw error;
    }
  }

  // Listen for bet-related socket events
  setupBetListeners() {
    gameSocketService.getSocket()?.on('betPlaced', (data) => {
      console.log('New bet placed:', data);
      // Handle bet placement notification
    });

    gameSocketService.getSocket()?.on('betCashedOut', (data) => {
      console.log('Bet cashed out:', data);
      // Handle bet cashout notification
    });
  }
}

export default new BetService();
