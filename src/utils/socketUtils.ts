import { io, Socket } from 'socket.io-client';
import { getSocketAuthPayload, BASE_URL } from './authUtils';

interface SocketOptions {
  path?: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private options: SocketOptions;

  private constructor(options: SocketOptions = {}) {
    this.options = {
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      ...options
    };
  }

  static getInstance(options?: SocketOptions): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager(options);
    }
    return SocketManager.instance;
  }

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const auth = getSocketAuthPayload();

    this.socket = io(BASE_URL, {
      ...this.options,
      auth
    });

    this.setupEventHandlers();
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleReconnection();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt reconnection
        this.handleReconnection();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message?.includes('authentication')) {
        // Handle authentication errors
        this.socket?.disconnect();
      }
    });
  }

  private handleReconnection() {
    if (this.reconnectTimer) return;

    let attempts = 0;
    const maxAttempts = this.options.reconnectionAttempts || 5;
    const delay = this.options.reconnectionDelay || 3000;

    const attemptReconnect = () => {
      if (attempts >= maxAttempts) {
        console.error('Max reconnection attempts reached');
        return;
      }

      attempts++;
      console.log(`Reconnection attempt ${attempts}/${maxAttempts}`);
      
      this.socket?.connect();
      
      this.reconnectTimer = setTimeout(attemptReconnect, delay);
    };

    attemptReconnect();
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export default SocketManager;
