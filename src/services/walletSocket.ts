import { io, Socket } from 'socket.io-client';

interface WalletUpdate {
  balance: number;
  transactionType?: string;
  amount?: number;
  gameId?: string;
}

class WalletSocketService {
  private socket: Socket | null = null;
  private listeners: Set<(data: WalletUpdate) => void> = new Set();
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    this.token = token;
    
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';
    
    this.socket = io(`${backendUrl}/wallet`, {
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

    this.socket.on('error', (error: any) => {
      console.error('Wallet socket error:', error);
      this.handleError(error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Wallet socket disconnected:', reason);
      this.handleDisconnect(reason);
    });

    this.socket.on('connect_error', (error) => {
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

  private handleError(error: any) {
    if (this.socket && !this.socket.connected) {
      this.attemptReconnect();
    }
  }

  private handleDisconnect(reason: string) {
    if (reason === 'io server disconnect' || reason === 'transport close') {
      this.attemptReconnect();
    }
  }

  private handleConnectionError(error: any) {
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
