import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';

// Enhanced interface for game stats with more detailed typing
export interface GameStats {
  onlineUsers: number;
  totalBets: number;
  lastUpdated?: number; // Timestamp of last update
}

// Interface for game stats update events
export interface GameStatsUpdateEvent extends GameStats {
  method?: 'addOnlineUser' | 'removeOnlineUser' | 'incrementTotalBetsByAmount' | 'resetTotalBets' | 'broadcastStats';
}

// Configuration interface for socket connection
interface SocketConfig {
  url: string;
  debug?: boolean;
}

// Custom hook for managing game stats with more robust typing
export function useGameStats(config: SocketConfig) {
  const [stats, setStats] = useState<GameStats>({
    onlineUsers: 0,
    totalBets: 0,
    lastUpdated: Date.now()
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    // Normalize the socket URL - remove protocols and trailing slashes
    const normalizedUrl = config.url
      .replace(/^(https?:\/\/)?/, '')  // Remove http:// or https:// 
      .replace(/\/$/, '')  // Remove trailing slash
      .replace(/^(ws:\/\/)?/, '');  // Remove ws:// 

    // Full URL with explicit namespace
    const socketUrl = `http://${normalizedUrl}`;
    const namespace = '/game-stats';  // Explicit namespace

    // Get the JWT token from AuthService
    const token = AuthService.getToken();

    if (!token) {
      const noTokenError = new Error('No authentication token found');
      console.error('[GameStats Socket] Authentication Error:', {
        message: noTokenError.message,
        context: 'Token retrieval failed',
        timestamp: new Date().toISOString()
      });
      setError(noTokenError);
      return () => {};
    }

    // Validate socket URL
    if (!socketUrl || socketUrl.trim() === '') {
      const invalidUrlError = new Error('Invalid WebSocket URL');
      console.error('[GameStats Socket] Connection Error:', {
        message: invalidUrlError.message,
        providedUrl: config.url,
        formattedUrl: socketUrl,
        context: 'URL validation failed',
        timestamp: new Date().toISOString()
      });
      setError(invalidUrlError);
      return () => {};
    }

    const socket: Socket = io(socketUrl, {
      // Authentication
      auth: { 
        token,
        nsp: namespace  // Change 'namespace' to 'nsp' which is the correct Socket.IO property
      },

      // Socket.IO configuration
      path: '/socket.io',

      // Transport and connection options
      transports: ['websocket', 'polling'],
      forceNew: true,
      
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,

      // WebSocket and CORS configuration
      withCredentials: false,
      extraHeaders: {
        'Access-Control-Allow-Origin': '*'
      }
    } as any);  // Type assertion to bypass TypeScript checks

    // Connection event handlers
    socket.on('connect', () => {
      if (config.debug) {
        console.log('[GameStats Socket] Connected Successfully', {
          url: socketUrl,
          namespace: namespace,
          transport: socket.io?.engine?.transport?.name || 'unknown',
          timestamp: new Date().toISOString()
        });
      }
      setIsConnected(true);
    });

    // Precise connection error handling
    socket.on('connect_error', (error) => {
      // Defensive error logging with comprehensive fallback
      const errorLog = {
        timestamp: new Date().toISOString(),
        connectionURL: socketUrl,
        namespace: namespace,
        transport: socket.io?.engine?.transport?.name || 'unknown',
        fullError: error ? JSON.stringify(error) : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'UnknownErrorType',
        errorMessage: error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'No error details available',
        errorType: error ? typeof error : 'undefined',
        stackTrace: error instanceof Error ? error.stack : undefined
      };

      // Log the error with multiple methods to ensure visibility
      console.group('[GameStats Socket] Precise Connection Error');
      console.error('Detailed Error Log:', errorLog);
      
      // Additional logging for different error scenarios
      if (error instanceof Error) {
        console.error('Error Instance:', error);
      } else if (typeof error === 'object' && error !== null) {
        console.error('Error Object:', JSON.stringify(error, null, 2));
      } else {
        console.error('Error Value:', error);
      }
      console.groupEnd();

      // Set error state
      setError(error instanceof Error 
        ? error 
        : new Error(errorLog.errorMessage));
      
      // Ensure disconnected state
      setIsConnected(false);
    });

    // Game stats event handler
    socket.on('game_stats', (newStats: GameStatsUpdateEvent) => {
      if (config.debug) {
        console.group('[GameStats Socket] Stats Update');
        console.log('Game Statistics:', newStats);
        console.log('Timestamp:', new Date().toISOString());
        console.groupEnd();
      }

      setStats(prevStats => {
        // Merge new stats with existing stats, preserving previous values if not provided
        const updatedStats: GameStats = {
          onlineUsers: newStats.onlineUsers ?? prevStats.onlineUsers,
          totalBets: newStats.totalBets ?? prevStats.totalBets,
          lastUpdated: Date.now()
        };

        return updatedStats;
      });
    });

    // Network-related error handling
    socket.io.on('reconnect_attempt', (attemptNumber) => {
      console.warn('[GameStats Socket] Reconnection Attempt', {
        attemptNumber,
        url: socketUrl,
        transport: socket.io?.engine?.transport?.name || 'unknown',
        timestamp: new Date().toISOString()
      });
    });

    socket.io.on('reconnect_error', (err) => {
      // Defensive logging with fallback for empty error objects
      const errorDetails = err instanceof Error 
        ? {
            name: err.name,
            message: err.message,
            stack: err.stack
          }
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : String(err);

      console.error('[GameStats Socket] Reconnection Error', {
        error: errorDetails,
        url: socketUrl,
        transport: socket.io?.engine?.transport?.name || 'unknown',
        context: 'Reconnection failed',
        timestamp: new Date().toISOString()
      });
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[GameStats Socket] Reconnection Failed', {
        url: socketUrl,
        transport: socket.io?.engine?.transport?.name || 'unknown',
        context: 'Maximum reconnection attempts exhausted',
        timestamp: new Date().toISOString()
      });
    });

    // Cleanup function
    return () => {
      socket.disconnect();
    };
  }, [config.url, config.debug]);

  // Effect to manage socket connection
  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return {
    stats,
    isConnected,
    error
  };
}

// Standalone service class for more manual control
export class GameStatsService {
  private socket: Socket | null = null;
  private socketInitPromise: Promise<Socket> | null = null;

  constructor(private config: SocketConfig) {}

  public initializeSocket(): Promise<Socket> {
    // If socket initialization is already in progress, return the existing promise
    if (this.socketInitPromise) {
      return this.socketInitPromise;
    }

    this.socketInitPromise = new Promise((resolve, reject) => {
      // Get the JWT token from AuthService
      const token = AuthService.getToken();

      if (!token) {
        const noTokenError = new Error('No authentication token found');
        console.error('[GameStats Socket] Authentication Error:', {
          message: noTokenError.message,
          context: 'Token retrieval failed',
          timestamp: new Date().toISOString()
        });
        reject(noTokenError);
        return;
      }

      // Normalize the socket URL - remove protocols and trailing slashes
      const normalizedUrl = this.config.url
        .replace(/^(https?:\/\/)?/, '')  // Remove http:// or https:// 
        .replace(/\/$/, '')  // Remove trailing slash
        .replace(/^(ws:\/\/)?/, '');  // Remove ws:// 

      // Full URL with explicit namespace
      const socketUrl = `http://${normalizedUrl}`;
      const namespace = '/game-stats';  // Explicit namespace

      // Validate socket URL
      if (!socketUrl || socketUrl.trim() === '') {
        const invalidUrlError = new Error('Invalid WebSocket URL');
        console.error('[GameStats Socket] Connection Error:', {
          message: invalidUrlError.message,
          providedUrl: this.config.url,
          formattedUrl: socketUrl,
          context: 'URL validation failed',
          timestamp: new Date().toISOString()
        });
        reject(invalidUrlError);
        return;
      }

      // Initialize socket with token
      const socket = io(socketUrl, {
        // Authentication
        auth: { 
          token,
          nsp: namespace  // Change 'namespace' to 'nsp' which is the correct Socket.IO property
        },

        // Socket.IO configuration
        path: '/socket.io',

        // Transport and connection options
        transports: ['websocket', 'polling'],
        forceNew: true,
        
        // Reconnection settings
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,

        // WebSocket and CORS configuration
        withCredentials: false,
        extraHeaders: {
          'Access-Control-Allow-Origin': '*'
        }
      } as any);  // Type assertion to bypass TypeScript checks

      socket.on('connect', () => {
        if (this.config.debug) {
          console.log('[GameStats Socket] Connected Successfully', {
            url: socketUrl,
            namespace: namespace,
            transport: socket.io.engine.transport.name,
            timestamp: new Date().toISOString()
          });
        }
        this.socket = socket;
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        // Defensive error logging with comprehensive fallback
        const errorLog = {
          timestamp: new Date().toISOString(),
          connectionURL: socketUrl,
          namespace: namespace,
          transport: socket.io.engine.transport.name,
          fullError: error ? JSON.stringify(error) : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'UnknownErrorType',
          errorMessage: error instanceof Error 
            ? error.message 
            : typeof error === 'string' 
              ? error 
              : 'No error details available',
          errorType: error ? typeof error : 'undefined',
          stackTrace: error instanceof Error ? error.stack : undefined
        };

        // Log the error with multiple methods to ensure visibility
        console.group('[GameStats Socket] Precise Connection Error');
        console.error('Detailed Error Log:', errorLog);
        
        // Additional logging for different error scenarios
        if (error instanceof Error) {
          console.error('Error Instance:', error);
        } else if (typeof error === 'object' && error !== null) {
          console.error('Error Object:', JSON.stringify(error, null, 2));
        } else {
          console.error('Error Value:', error);
        }
        console.groupEnd();

        // Reject with error
        reject(error instanceof Error 
          ? error 
          : new Error(errorLog.errorMessage));
      });

      // Network-related error handling
      socket.io.on('reconnect_attempt', (attemptNumber) => {
        console.warn('[GameStats Socket] Reconnection Attempt', {
          attemptNumber,
          url: socketUrl,
          transport: socket.io?.engine?.transport?.name || 'unknown',
          timestamp: new Date().toISOString()
        });
      });

      socket.io.on('reconnect_error', (err) => {
        // Defensive logging with fallback for empty error objects
        const errorDetails = err instanceof Error 
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack
            }
          : typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err);

        console.error('[GameStats Socket] Reconnection Error', {
          error: errorDetails,
          url: socketUrl,
          transport: socket.io?.engine?.transport?.name || 'unknown',
          context: 'Reconnection failed',
          timestamp: new Date().toISOString()
        });
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[GameStats Socket] Reconnection Failed', {
          url: socketUrl,
          transport: socket.io?.engine?.transport?.name || 'unknown',
          context: 'Maximum reconnection attempts exhausted',
          timestamp: new Date().toISOString()
        });
      });
    });

    return this.socketInitPromise;
  }

  // Method to manually add an online user
  public addOnlineUser(userId: string): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.');
      return;
    }
    this.socket.emit('gameStats:addOnlineUser', { userId });
  }

  // Method to manually remove an online user
  public removeOnlineUser(userId: string): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.');
      return;
    }
    this.socket.emit('gameStats:removeOnlineUser', { userId });
  }

  // Method to increment total bets
  public incrementTotalBetsByAmount(betAmount: number): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.');
      return;
    }
    this.socket.emit('gameStats:incrementTotalBetsByAmount', { betAmount });
  }

  // Method to reset total bets
  public resetTotalBets(): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.');
      return;
    }
    this.socket.emit('gameStats:resetTotalBets');
  }

  // Method to manually broadcast current stats
  public broadcastStats(): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.');
      return;
    }
    this.socket.emit('gameStats:broadcastStats');
  }

  connect(): void {
    this.disconnect(); // Ensure previous connection is closed

    this.initializeSocket().then(socket => {
      // Event listeners can be added here if needed
      socket.on('game_stats', (stats: GameStatsUpdateEvent) => {
        if (this.config.debug) {
          console.log('Game Stats Update:', stats);
        }
      });
    }).catch(error => {
      console.error('Failed to connect to Game Stats socket:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Optional method to manually listen for stats
  onStatsUpdate(callback: (stats: GameStatsUpdateEvent) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected. Call connect() first.');
    }
    this.socket.on('game_stats', callback);
  }
}
