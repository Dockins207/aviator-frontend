import { v4 as uuidv4 } from 'uuid';

// Define UserProfile interface
interface UserProfile {
    username: string;
    balance: number;
}

class AuthService {
  private static readonly DEVICE_ID_KEY = 'aviator_device_id';
  private static readonly AUTH_TOKEN_KEY = 'aviator_auth_token';

  /**
   * Gets the unique device ID, creating one if it doesn't exist
   */
  static getDeviceId(): string {
    if (typeof window === 'undefined') {
      return 'server-side';
    }

    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Gets the authentication token from localStorage
   */
  static getToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Sets the authentication token in localStorage
   */
  static setToken(token: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
  }

  /**
   * Removes the authentication token from localStorage
   */
  static clearToken(): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Checks if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Gets the user profile
   */
  static async getProfile(): Promise<UserProfile> {
    // Mock implementation, replace with actual API call
    return new Promise((resolve) => {
        setTimeout(() => {
            const profile = { username: 'User123', balance: 1000 }; // Mock balance
            console.log('Fetched Profile:', profile);
            resolve(profile);
        }, 1000);
    });
  }
}

export default AuthService;
