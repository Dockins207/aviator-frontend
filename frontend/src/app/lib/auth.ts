import axios from 'axios';

// Base URL from environment
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';

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
  balance: number;
  currency: string;
}

// Authentication Service
export class AuthService {
  // Client-side token storage
  static getToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  }

  private static setToken(token: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('token', token);
      } catch (error) {
        console.error('Failed to store token in localStorage:', error);
      }
    }
  }

  private static removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
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
    } catch (error: any) {
      console.error('Registration Error:', error.response?.data || error.message);
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
    } catch (error: any) {
      console.error('Login Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
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
      const response = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Always remove token, regardless of server response
      this.removeToken();

      return true;
    } catch (error: any) {
      console.error('Logout Error:', {
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });

      // Always remove token, even if logout request fails
      this.removeToken();

      return false;
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
    } catch (error: any) {
      console.error('Profile Fetch Error:', {
        message: error.response?.data || error.message,
        status: error.response?.status
      });
      
      // If token is invalid or expired, remove it
      if (error.response?.status === 401) {
        this.removeToken();
      }
      
      return null;
    }
  }

  // Get wallet balance
  static async getWalletBalance(): Promise<WalletBalanceResponse | null> {
    try {
      const token = this.getToken();
      if (!token) {
        console.error('No authentication token found');
        return null;
      }

      const response = await axios.get(`${BASE_URL}/api/auth/profile/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Validate response structure
      if (response.data && 
          typeof response.data.balance === 'number' && 
          typeof response.data.currency === 'string') {
        return {
          balance: response.data.balance,
          currency: response.data.currency
        };
      }
      
      console.warn('Invalid wallet balance response structure');
      return null;
    } catch (error: any) {
      console.error('Wallet Balance Fetch Error:', {
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
      
      // If token is invalid or expired, remove it
      if (error.response?.status === 401) {
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
    } catch (error: any) {
      console.error('Profile Update Error:', {
        message: error.response?.data || error.message,
        status: error.response?.status
      });
      
      // If token is invalid or expired, remove it
      if (error.response?.status === 401) {
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

      const response = await axios.post(`${BASE_URL}/api/auth/profile/deposit`, 
        { amount, currency, paymentMethod },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Deposit Funds Error:', error.response?.data || error.message);
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

      const response = await axios.post(`${BASE_URL}/api/auth/profile/withdraw`, 
        { amount, currency, paymentMethod },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Withdraw Funds Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
