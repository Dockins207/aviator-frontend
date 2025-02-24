import axios from 'axios';

// Base URL from environment with fallback
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://2d19-41-212-94-41.ngrok-free.app';

// Configure Axios with CORS and error handling
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000,
});

// Validation Utilities
const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Support formats: +254712345678, 0712345678, 0112345678
  const phoneRegex = /^(\+?254|0)1?[17]\d{8}$/;
  return phoneRegex.test(phoneNumber);
};

const normalizePhoneNumber = (phoneNumber: string): string => {
  // Remove any spaces or dashes
  phoneNumber = phoneNumber.replace(/[\s-]/g, '');
  
  // If it starts with 0, replace with +254
  if (phoneNumber.startsWith('0')) {
    return '+254' + phoneNumber.slice(1);
  }
  
  // If it starts with 254, add +
  if (phoneNumber.startsWith('254')) {
    return '+' + phoneNumber;
  }
  
  return phoneNumber;
};

const validatePassword = (password: string): boolean => {
  // At least 8 characters, must include:
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

// Interfaces
export interface RegisterData {
  username: string;
  phoneNumber: string;
  password: string;
}

export interface LoginData {
  phoneNumber: string;
  password: string;
}

export interface UserProfile {
  user_id: string;
  username: string;
  phone_number: string;
  role: string;
}

export interface WalletBalanceResponse {
  user_id: string;
  balance: number;
  currency: string;
  formattedBalance: string;
}

// Authentication Service
export class AuthService {
  // Enhanced token management methods
  private static getValidToken(): string | null {
    try {
      // Ensure we're in a browser environment
      if (typeof window === 'undefined') {
        return null;
      }

      // Check multiple storage locations
      const storageLocations = [
        () => localStorage.getItem('token'),
        () => sessionStorage.getItem('token'),
        // Add more storage locations if needed
      ];

      for (const getToken of storageLocations) {
        const token = getToken();
        
        // Validate token if found
        if (token && this.validateToken(token)) {
          return token;
        }
      }

      // No valid token found
      return null;
    } catch (error) {
      console.warn('🚨 Token Retrieval Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  // Enhanced token validation
  static validateToken(token: string | null): boolean {
    // Basic validation checks
    if (!token) {
      console.warn('🚨 Token Validation Failed: No token provided');
      return false;
    }

    try {
      // Check token structure
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('🚨 Token Validation Failed: Invalid token structure', {
          tokenLength: token.length,
          tokenParts: parts.length
        });
        return false;
      }

      // Optional: Decode and check expiration
      const base64Payload = parts[1];
      const payload = JSON.parse(atob(base64Payload));
      
      // Check token expiration
      if (payload.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          console.warn('🚨 Token Validation Failed: Token expired');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn('🚨 Token Validation Error:', {
        message: error instanceof Error ? error.message : 'Unknown validation error',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Modify existing getToken method
  static getToken(): string | null {
    return this.getValidToken();
  }

  private static setToken(token: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('token', token);
        console.log('Token set successfully:', {
          tokenLength: token.length,
          tokenFirstChars: token.substring(0, 10)
        });
      } catch (error) {
        console.error('Failed to store token in localStorage:', error);
      }
    }
  }

  // Public method to remove token
  static removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      console.log('Token removed from localStorage');
    }
  }

  // Logout user
  static async logout(): Promise<boolean> {
    try {
      const token = this.getToken();
      
      // If no token, consider logout successful
      if (!token) {
        console.warn('No token found during logout');
        this.removeToken();
        return true;
      }

      // Attempt to call logout endpoint
      await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Always remove token, regardless of server response
      this.removeToken();

      return true;
    } catch (error) {
      console.error('Logout Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      // Always remove token, even if logout request fails
      this.removeToken();

      return false;
    }
  }

  // Register a new user with enhanced validation
  static async register(userData: RegisterData) {
    // Validate input
    if (userData.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (!validatePhoneNumber(userData.phoneNumber)) {
      throw new Error('Invalid phone number. Must be in Kenyan format (+254 or 0712345678)');
    }

    if (!validatePassword(userData.password)) {
      throw new Error('Password must be at least 8 characters long and include uppercase, lowercase, and number');
    }

    try {
      const response = await axiosInstance.post('/api/auth/register', {
        username: userData.username,
        phoneNumber: normalizePhoneNumber(userData.phoneNumber),
        password: userData.password
      });
      return response.data;
    } catch (error) {
      console.error('Registration Error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Login user with precise error handling
  static async login(credentials: LoginData) {
    // Validate input
    if (!validatePhoneNumber(credentials.phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    try {
      const response = await axiosInstance.post('/api/auth/login', {
        phoneNumber: normalizePhoneNumber(credentials.phoneNumber),
        password: credentials.password
      });
      
      // Store token and extract user details
      if (response.data.token) {
        this.setToken(response.data.token);
      } else {
        throw new Error('No authentication token received');
      }
      
      return response.data;
    } catch (error) {
      console.error('Login Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // Get user profile
  static async getProfile(): Promise<UserProfile | null> {
    try {
      const token = this.getToken();
      if (!token) {
        console.error('No authentication token found');
        return null;
      }

      const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Handle nested response structure
      if (response.data && response.data.status === 'success' && response.data.data) {
        const { data } = response.data;
        return {
          user_id: data.user_id,
          username: data.username,
          phone_number: data.phone_number,
          role: data.role
        };
      }
      
      console.error('Invalid profile response structure');
      return null;
    } catch (error) {
      console.error('Profile Fetch Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // If token is invalid or expired, remove it
      if (error instanceof Error && error.message.includes('401')) {
        this.removeToken();
      }
      
      return null;
    }
  }

  // Update user profile
  static async updateProfile(profileData: { username: string; phoneNumber: string }): Promise<UserProfile | null> {
    try {
      const token = this.getToken();
      if (!token) {
        console.error('No authentication token found');
        return null;
      }

      // Validate input
      if (profileData.username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }

      if (!validatePhoneNumber(profileData.phoneNumber)) {
        throw new Error('Invalid phone number. Must be in Kenyan format (+254 or 0712345678)');
      }

      const response = await axios.put(`${BASE_URL}/api/auth/profile`, {
        username: profileData.username,
        phoneNumber: normalizePhoneNumber(profileData.phoneNumber)
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Profile Update Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // If token is invalid or expired, remove it
      if (error instanceof Error && error.message.includes('401')) {
        this.removeToken();
      }
      
      throw error;
    }
  }

  // Deposit funds
  static async depositFunds(amount: number, paymentMethod: string = 'M-PESA', currency: string = 'KSH'): Promise<{
    status: string;
    transactionId: string;
    amount: number;
    newBalance: number;
  }> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.post(`${BASE_URL}/api/wallet/deposit`, 
        { amount, currency, paymentMethod },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Deposit Funds Error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Withdraw funds
  static async withdrawFunds(amount: number, paymentMethod: string = 'M-PESA', currency: string = 'KSH'): Promise<{
    status: string;
    transactionId: string;
    amount: number;
    newBalance: number;
  }> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.post(`${BASE_URL}/api/wallet/withdraw`, 
        { amount, currency, paymentMethod },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Withdraw Funds Error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Get user ID from profile or token
  static getUserId(): string | null {
    try {
      // First, try to get user ID from stored profile
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        const profile: UserProfile = JSON.parse(storedProfile);
        return profile.user_id;
      }

      // If no profile, attempt to extract from token
      const token = this.getToken();
      if (token) {
        // Decode JWT token to extract user ID
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(atob(base64Payload));
        
        // Common JWT claims for user ID
        return payload.sub || payload.user_id || payload.id;
      }

      return null;
    } catch (error) {
      console.warn('Error retrieving user ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  // Check if user is currently authenticated
  static isAuthenticated(): boolean {
    try {
      // Use the new getToken method which includes comprehensive validation
      const token = this.getToken();
      
      // Additional check for user profile (optional, depending on your requirements)
      return !!token;
    } catch (error) {
      console.warn('Authentication check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  // Token Extraction Strategies
  static getTokenExtractionStrategies(): Record<string, string | null> {
    const token = this.getToken();
    
    return {
      'auth.token': token,
      'auth.accessToken': token,
      'headers.authorization': token ? `Bearer ${token}` : null,
      'headers.x-access-token': token,
      'query.token': token
    };
  }

  // Wallet Balance Retrieval
  static async getWalletBalance(): Promise<WalletBalanceResponse | null> {
    try {
      const token = this.getToken();
      if (!token) {
        console.warn('🚨 No authentication token found for wallet balance');
        return null;
      }

      const response = await axiosInstance.get('/api/wallet/balance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Validate response structure
      if (response.data && response.data.status === 'success' && response.data.wallet) {
        const { 
          balance, 
          currency = 'KSH', 
          userId,  
          formattedBalance  
        } = response.data.wallet;
        
        // Convert balance to number, handling potential string input
        const numericBalance = typeof balance === 'string' 
          ? parseFloat(balance) 
          : balance;

        if (!isNaN(numericBalance) && typeof currency === 'string' && userId) {
          const walletUpdate: WalletBalanceResponse = {
            user_id: userId,
            balance: numericBalance,
            currency: currency,
            formattedBalance: formattedBalance || this.formatBalance(numericBalance)
          };

          // Log wallet balance retrieval for diagnostics
          console.group('💰 Wallet Balance Retrieved');
          console.log('Balance:', walletUpdate.balance);
          console.log('User ID:', walletUpdate.user_id);
          console.log('Currency:', walletUpdate.currency);
          console.groupEnd();

          return walletUpdate;
        }
      }
      
      console.warn('🚨 Invalid wallet balance response structure');
      return null;
    } catch (error) {
      console.group('🚨 Wallet Balance Retrieval Error');
      console.error('Error Details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      console.groupEnd();
      
      // If token is invalid or expired, remove it
      if (error instanceof Error && error.message.includes('401')) {
        this.removeToken();
      }
      
      return null;
    }
  }

  // Helper method to format balance
  private static formatBalance(balance: number): string {
    return balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'KSH',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
