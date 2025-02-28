import { io, Socket } from 'socket.io-client';

interface WalletUpdate {
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  recentTransactions?: Array<{
    transactionId: string;
    amount: number;
    description: string;
    transactionType: string;
    createdAt: string;
  }>;
}

// Define interfaces for better type safety
interface WalletError {
  message: string;
  code?: string;
  status?: number;
}

interface WalletEventData {
  balance: number;
  userId: string;
  currency: string;
  transactions?: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface WalletEventCallback {
  (data: WalletEventData): void;
}

class WalletSocketService {
  private socket: Socket | null = null;
  private listeners: Set<(data: WalletUpdate) => void> = new Set();
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, WalletEventCallback> = new Map();
  private static SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  connect(token: string) {
    this.token = token;
    
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(`${WalletSocketService.SOCKET_URL}/wallet`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Wallet socket connected');
      this.reconnectAttempts = 0;
      
      // Subscribe to updates on connect
      this.socket?.emit('subscribe:wallet');
    });

    this.socket.on('wallet:update', (data: WalletUpdate) => {
      console.log('Received wallet update:', data);
      this.notifyListeners(data);
    });

    this.socket.on('wallet:balance', (data: WalletUpdate) => {
      console.log('Received balance update:', data);
      this.notifyListeners(data);
    });

    this.socket.on('error', (error: WalletError) => {
      console.error('Wallet socket error:', error);
      this.handleError();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Wallet socket disconnected:', reason);
      this.handleDisconnect();
    });

    this.socket.on('connect_error', (error: Error & { message: string }) => {
      console.error('Connection error:', error);
      this.handleConnectionError(error);
    });
  }

  private notifyListeners(data: WalletUpdate) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in wallet update listener:', error);
      }
    });
  }

  private handleError() {
    if (this.socket && !this.socket.connected) {
      this.attemptReconnect();
    }
  }

  private handleDisconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.listeners.clear();
      this.reconnectAttempts = 0;
    }
  }

  private handleConnectionError(error: Error & { message: string }) {
    if (error.message === 'Invalid token') {
      console.error('Authentication failed');
      this.disconnect();
    } else {
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.token) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.token!);
      }, 1000 * this.reconnectAttempts);
    }
  }

  addListener(callback: (data: WalletUpdate) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.listeners.clear();
      this.reconnectAttempts = 0;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const walletSocket = new WalletSocketService();
