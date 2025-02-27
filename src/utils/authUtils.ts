import axios from 'axios';
import Cookies from 'js-cookie';
import { PhoneValidator } from './phoneValidator';

// Constants
export const AUTH_TOKEN_KEY = 'aviator_auth_token';
export const DEVICE_ID_KEY = 'aviator_device_id';
export const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Interfaces
export interface UserProfile {
  user_id: string;
  username: string;
  phone_number: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

// Phone number normalization (using PhoneValidator)
export function normalizePhoneNumber(phoneNumber: string): string | null {
  return PhoneValidator.normalize(phoneNumber);
}

// Token management with SSR-safe methods
export function getToken(): string | null {
  console.group('🔍 Token Retrieval Attempt');
  
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // First try localStorage
    const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
    console.log('Raw token:', localToken ? 'Present' : 'Not Found');
    
    if (localToken) {
      console.log('Token Source:', 'localStorage');
      console.groupEnd();
      return localToken;
    }

    // Fallback to js-cookie
    const cookieToken = Cookies.get(AUTH_TOKEN_KEY);
    console.log('Cookie Token:', cookieToken ? 'Present' : 'Not Found');
    
    console.groupEnd();
    return cookieToken || null;
  }

  // Server-side or SSR fallback
  console.log('Environment:', 'Server-side');
  console.groupEnd();
  return null;
}

export function setToken(token: string): void {
  console.group('🔑 Token Storage');
  
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    
    console.log('Token Storage:', {
      method: 'localStorage and Cookies',
      tokenLength: cleanToken.length,
      firstChars: cleanToken.substring(0, 10)
    });
    
    // Set in localStorage
    localStorage.setItem(AUTH_TOKEN_KEY, cleanToken);
    
    // Set in cookies with appropriate options
    Cookies.set(AUTH_TOKEN_KEY, cleanToken, {
      expires: 7, // 7 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }

  console.groupEnd();
}

export function clearToken(): void {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Remove from localStorage
    localStorage.removeItem(AUTH_TOKEN_KEY);
    
    // Remove from cookies
    Cookies.remove(AUTH_TOKEN_KEY, { path: '/' });
  }
}

export function isAuthenticated(): boolean {
  console.group('🔐 Authentication Validation');
  
  const token = getToken();
  console.log('Token Presence:', !!token);

  if (!token) {
    console.log('Authentication Result:', false);
    console.groupEnd();
    return false;
  }

  // Basic token validation
  const isValid = token.length > 10; // Basic length check
  console.log('Token Validation:', {
    length: token.length,
    isValid
  });

  console.log('Authentication Result:', isValid);
  console.groupEnd();

  return isValid;
}

// Axios instance with authentication
export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000,
});

// Add authentication interceptor
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token on authentication error
      clearToken();
      
      // Redirect to login if needed (client-side only)
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Socket authentication helper
export function getSocketAuthPayload() {
  const token = getToken();
  return token ? { token: token.replace('Bearer ', '') } : {};
}

// Server-side token extraction (for API routes or server-side rendering)
export function extractTokenFromServerRequest(req: any): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    return authHeader.replace(/^Bearer\s+/i, '');
  }

  // Check cookies
  const cookieToken = req.cookies?.[AUTH_TOKEN_KEY];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}
