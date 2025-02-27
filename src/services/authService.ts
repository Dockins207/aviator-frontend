import { v4 as uuidv4 } from 'uuid';
import { 
  AUTH_TOKEN_KEY, 
  DEVICE_ID_KEY,
  getToken,
  setToken,
  clearToken,
  api,
  UserProfile,
  AuthResponse
} from '../utils/authUtils';
import { PhoneValidator } from '../utils/phoneValidator';

interface LoginCredentials {
  phoneNumber: string;
  password: string;
}

interface RegisterCredentials extends LoginCredentials {
  username: string;
}

class AuthService {
  /**
   * Gets the unique device ID, creating one if it doesn't exist
   */
  static getDeviceId(): string {
    if (typeof window === 'undefined') {
      return 'server-side';
    }

    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Validate login credentials before submission
   */
  static validateLoginCredentials(credentials: LoginCredentials): void {
    // Validate phone number
    const phoneValidation = PhoneValidator.validate(credentials.phoneNumber);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || 'Invalid phone number');
    }

    // Validate password
    if (!credentials.password) {
      throw new Error('Password is required');
    }

    // Optional: Add password strength check if needed
    if (credentials.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
  }

  /**
   * Validate register credentials before submission
   */
  static validateRegisterCredentials(credentials: RegisterCredentials): void {
    // Validate phone number
    const phoneValidation = PhoneValidator.validate(credentials.phoneNumber);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || 'Invalid phone number');
    }

    // Validate username
    if (!credentials.username) {
      throw new Error('Username is required');
    }

    // Validate password
    if (!credentials.password) {
      throw new Error('Password is required');
    }

    // Optional: Add password strength check if needed
    if (credentials.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
  }

  /**
   * Login user with phone number and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate credentials before attempting login
      this.validateLoginCredentials(credentials);

      // Normalize phone number
      const normalizedPhone = PhoneValidator.normalize(credentials.phoneNumber);
      
      const response = await api.post<AuthResponse>('/api/auth/login', {
        phone_number: normalizedPhone,
        password: credentials.password
      });

      if (response.data.token) {
        setToken(response.data.token);
      }

      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   */
  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      // Validate credentials before attempting registration
      this.validateRegisterCredentials(credentials);

      // Normalize phone number
      const normalizedPhone = PhoneValidator.normalize(credentials.phoneNumber);
      
      const response = await api.post<AuthResponse>('/api/auth/register', {
        username: credentials.username,
        phone_number: normalizedPhone,
        password: credentials.password
      });

      if (response.data.token) {
        setToken(response.data.token);
      }

      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  static logout(): void {
    clearToken();
  }

  /**
   * Checks if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!getToken();
  }

  /**
   * Gets the user profile
   */
  static async getProfile(): Promise<UserProfile> {
    try {
      const response = await api.get<UserProfile>('/api/auth/profile');
      return response.data;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }
}

export default AuthService;
