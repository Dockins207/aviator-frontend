import axios, { AxiosError } from 'axios';
import gameSocketService from './gameSocketService';
import { AuthService } from '@/app/lib/auth';

// Use environment variable for backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface BetRequest {
  amount: number;
}

export interface BetResponse {
  success: boolean;
  betId?: string | null;
  message?: string | null;
  winnings?: number | null;
}

class BetService {
  private baseUrl = `${BACKEND_URL}/api/bet`; // Use full backend URL

  // Centralized error handling
  private handleError(error: AxiosError<{ message?: string }>, context: string): BetResponse {
    console.error(`Error in ${context}:`, error);
    
    // Log full error object for comprehensive debugging
    console.error('Full Error Object:', error);
    console.error('=== END OF DETAILED ERROR LOGGING ===');
    
    // Check if the error is from a failed request
    if (error.response) {
      // Server responded with an error status
      return {
        success: false,
        message: error.response.data?.message || 'An unexpected server error occurred',
        betId: null,
        winnings: null
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        success: false,
        message: 'No response from server. Please check your internet connection.',
        betId: null,
        winnings: null
      };
    } else {
      // Error setting up the request
      return {
        success: false,
        message: error.message || 'Error setting up the request',
        betId: null,
        winnings: null
      };
    }
  }

  // Notification system
  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    // Create a toast-like notification
    const notificationContainer = document.createElement('div');
    notificationContainer.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 
      ${type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'info' ? 'bg-blue-500 text-white' : 
        'bg-blue-500 text-white'}`;
    notificationContainer.textContent = message;
    
    document.body.appendChild(notificationContainer);
    
    // Automatically remove notification after 3 seconds
    setTimeout(() => {
      notificationContainer.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => {
        document.body.removeChild(notificationContainer);
      }, 300);
    }, 3000);
  }

  // Place a bet
  async placeBet(amount: number): Promise<BetResponse> {
    console.log('Attempting to place bet with amount:', amount);

    try {
      // Get the authentication token
      const token = AuthService.getToken();

      // Make the API call to the specific bet placement endpoint
      const response = await axios.post<BetResponse>(`${this.baseUrl}/place`, 
        { amount }, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      // Use the existing error handling method
      return this.handleError(error as AxiosError<{ message?: string }>, 'placeBet');
    }
  }

  // Cash out a bet
  async cashOutBet(betId: string): Promise<BetResponse> {
    console.log('Attempting to cash out bet:', betId);

    try {
      // Get the authentication token
      const token = AuthService.getToken();

      const response = await axios.post<BetResponse>(`${this.baseUrl}/cashout`, 
        { betId }, 
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      // Ensure a complete response object
      return {
        success: response.data.success ?? false,
        betId: response.data.betId ?? null,
        message: response.data.message ?? null,
        winnings: response.data.winnings ?? null
      };
    } catch (error) {
      // Use the existing error handling method
      this.handleError(error as AxiosError<{ message?: string }>, 'cashOutBet');
      
      // Return a default error response
      return {
        success: false,
        message: 'Failed to cash out bet',
        betId: null,
        winnings: null
      };
    }
  }

  // Listen for bet-related socket events
  setupBetListeners() {
    const socket = gameSocketService.getSocket();
    if (!socket) return;

    // Bet placement confirmation
    socket.on('betPlaced', (data: { 
      success: boolean, 
      betId: string, 
      amount: number, 
      message?: string 
    }) => {
      if (data.success) {
        this.showNotification(`Bet of $${data.amount} placed successfully. Bet ID: ${data.betId}`, 'success');
      } else {
        this.showNotification(data.message || 'Bet placement failed', 'error');
      }
    });

    // Bet cashout confirmation
    socket.on('betCashedOut', (data: { 
      success: boolean, 
      betId: string, 
      winnings?: number, 
      message?: string 
    }) => {
      if (data.success) {
        this.showNotification(
          data.winnings 
            ? `Cashed out successfully! Winnings: $${data.winnings}` 
            : 'Bet cashed out successfully', 
          'success'
        );
      } else {
        this.showNotification(data.message || 'Cashout failed', 'error');
      }
    });

    // Game crash event
    socket.on('gameCrashed', (data: { 
      crashPoint: number, 
      message?: string 
    }) => {
      this.showNotification(
        `Game crashed at ${data.crashPoint}x`, 
        'warning'
      );
    });
  }
}

export default new BetService();
