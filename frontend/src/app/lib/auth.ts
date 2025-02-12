import axios from 'axios';

// Base URL from environment
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.12:8000';

// Configure Axios with CORS and error handling
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,  // Important for CORS cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000,  // 10 seconds timeout
});

// Add a request interceptor to handle errors
axiosInstance.interceptors.request.use(
  (config) => {
    const token = AuthService.getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Server Error:', error.response.data);
      console.error('Status Code:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error: No response received', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

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
  id?: string;
  username: string;
  phoneNumber: string;
}

export interface UpdateProfileData {
  username: string;
  phoneNumber: string;
}

// Authentication Service
export class AuthService {
  // Client-side token storage
  static getToken(): string | null {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    console.log('Getting token:', token ? 'Token exists' : 'No token found');
    return token;
  }

  private static setToken(token: string): void {
    if (typeof window !== 'undefined') {
      console.log('Setting token:', token ? 'Token provided' : 'No token');
      try {
        localStorage.setItem('token', token);
        console.log('Token successfully stored in localStorage');
      } catch (error) {
        console.error('Failed to store token in localStorage:', error);
      }
    } else {
      console.warn('Attempted to set token on server-side');
    }
  }

  private static removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  // Register a new user
  static async register(userData: RegisterData) {
    try {
      console.log('Attempting to register new user');
      const response = await axiosInstance.post('/api/auth/register', userData);
      console.log('User registered:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Registration Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Login user
  static async login(credentials: LoginData) {
    try {
      console.log('Attempting to login user with phone:', credentials.phoneNumber);
      const response = await axiosInstance.post('/api/auth/login', credentials);
      
      console.log('Login API Response:', {
        status: response.status,
        data: response.data
      });

      // Store token if available
      if (response.data.token) {
        console.log('Token received from login response');
        this.setToken(response.data.token);
      } else {
        console.warn('No token found in login response');
      }
      
      console.log('User logged in:', response.data);
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
  static async logout() {
    try {
      console.log('Attempting to logout user');
      const token = this.getToken();
      
      if (token) {
        await axiosInstance.post('/api/auth/logout');
      }
      
      // Remove token
      this.removeToken();
      console.log('User logged out');
    } catch (error: any) {
      console.error('Logout Error:', error.response?.data || error.message);
      this.removeToken(); // Always remove token even if logout request fails
    }
  }

  // Get user profile
  static async getProfile(): Promise<UserProfile | null> {
    try {
      console.log('Attempting to retrieve user profile');
      const token = this.getToken();
      
      if (!token) {
        console.warn('No token found when retrieving profile');
        return null;
      }
      
      const response = await axiosInstance.get('/api/auth/profile');
      console.log('User profile retrieved:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Profile Fetch Error:', {
        message: error.response?.data || error.message,
        status: error.response?.status,
        headers: error.response?.headers
      });
      return null;
    }
  }

  // Update user profile
  static async updateProfile(profileData: UpdateProfileData): Promise<UserProfile | null> {
    try {
      console.log('Attempting to update user profile');
      const token = this.getToken();
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axiosInstance.put('/api/auth/profile', profileData);
      console.log('User profile updated:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Profile Update Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Utility method to get axios instance with auth headers
  static getAuthenticatedAxios() {
    const token = this.getToken();
    return axios.create({
      baseURL: BASE_URL,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  }
}
