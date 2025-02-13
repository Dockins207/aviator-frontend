import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import gameSocketService, { GameState, Player } from '../services/gameSocketService';
import { AuthService } from '@/app/lib/auth';

export const useGameSocket = () => {
  // Use state with initial values to prevent hydration issues
  const [gameState, setGameState] = useState<GameState>({
    status: 'betting',
    players: [],
    totalPlayers: 0,
    totalBetAmount: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize socket setup to prevent unnecessary re-renders
  const setupSocketListeners = useCallback((socket: any) => {
    if (!socket) {
      console.warn('Attempted to setup listeners on null socket');
      return () => {};
    }

    // Comprehensive game state events
    const gameStateEvents = [
      'gameStateUpdate', 
      'gameState'
    ];

    // Connection handler
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);

      // Request initial game state after connection
      socket.emit('requestGameState');

      // Clear any existing reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    // Disconnection handler
    const handleDisconnect = (reason: string) => {
      setIsConnected(false);
      setGameState(prev => ({
        ...prev,
        status: 'betting',
        players: [],
        totalPlayers: 0
      }));
      setError(`Disconnected: ${reason}`);

      // Attempt to reconnect after a delay
      reconnectTimerRef.current = setTimeout(() => {
        reconnect();
      }, 3000);
    };

    // Game state update handler
    const handleGameStateUpdate = (newGameState: Partial<GameState>) => {
      if (newGameState) {
        setGameState(prev => {
          const updatedState = {
            ...prev,
            ...newGameState,
            players: newGameState.players || prev.players,
            totalPlayers: newGameState.totalPlayers ?? prev.totalPlayers,
            totalBetAmount: newGameState.totalBetAmount ?? prev.totalBetAmount
          };
          return updatedState;
        });
      }
    };

    // Error handler
    const handleError = (errorMessage: string) => {
      console.error('Socket error:', errorMessage);
      setError(errorMessage);
    };

    // Attach event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);

    // Add multiple event listeners for game state
    gameStateEvents.forEach(event => {
      socket.on(event, handleGameStateUpdate);
    });

    // Return cleanup function
    return () => {
      gameStateEvents.forEach(event => {
        socket.off(event, handleGameStateUpdate);
      });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, []);

  // Connection method with enhanced error handling
  const connect = useCallback(() => {
    // Prevent running on server
    if (typeof window === 'undefined') return () => {};

    // Prevent multiple socket connections
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (disconnectError) {
        console.warn('[HOOK] Error during socket disconnect:', disconnectError);
      }
    }

    // Verify authentication before connecting
    const token = AuthService.getToken();
    if (!token) {
      console.error('[HOOK] No authentication token found');
      setError('Not authenticated');
      return () => {};
    }

    // Connect to socket with error handling
    try {
      const socketPromise = gameSocketService.connect();
      
      // Handle promise resolution
      socketPromise
        .then((socket) => {
          socketRef.current = socket;

          // Debugging socket events
          socket.on('connect', () => {
            setIsConnected(true);
            setError(null);
          });

          socket.on('connect_error', (error) => {
            console.error('[HOOK] Socket connection error:', error);
            setIsConnected(false);
            setError(`Connection failed: ${error.message}`);
          });

          socket.on('disconnect', (reason) => {
            console.warn('[HOOK] Socket disconnected:', reason);
            setIsConnected(false);
            setError(`Disconnected: ${reason}`);
          });

          // Setup listeners and get cleanup function
          const cleanup = setupSocketListeners(socket);

          // Return cleanup for useEffect
          return cleanup;
        })
        .catch((connectionError) => {
          console.error('[HOOK] Failed to establish socket connection:', connectionError);
          setIsConnected(false);
          setError(connectionError instanceof Error ? connectionError.message : 'Connection failed');
          return () => {};
        });

      // Return a no-op cleanup function
      return () => {};
    } catch (connectionError) {
      console.error('[HOOK] Unexpected connection error:', connectionError);
      setIsConnected(false);
      setError(connectionError instanceof Error ? connectionError.message : 'Connection failed');
      return () => {};
    }
  }, [setupSocketListeners]);

  // Reconnection method
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (disconnectError) {
        console.warn('Error during socket disconnect:', disconnectError);
      }
    }
    return connect();
  }, [connect]);

  // Effect for initial connection and cleanup
  useEffect(() => {
    // Prevent running on server
    if (typeof window === 'undefined') return;

    // Explicit connection attempt
    const connectSocket = async () => {
      try {
        const socket = await gameSocketService.connect();
        
        // Setup listeners
        const cleanup = setupSocketListeners(socket);

        // Store socket reference
        socketRef.current = socket;

        // Return cleanup function
        return cleanup;
      } catch (connectionError) {
        console.error('[HOOK] Socket connection failed:', connectionError);
        setIsConnected(false);
        setError(connectionError instanceof Error ? connectionError.message : 'Connection failed');
        return () => {};
      }
    };

    // Call connection method
    const cleanupPromise = connectSocket();

    // Cleanup function
    return () => {
      // Disconnect socket on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Call cleanup from socket listeners
      cleanupPromise.then(cleanup => cleanup());
    };
  }, [setupSocketListeners]);

  return { 
    gameState, 
    isConnected, 
    error,
    reconnect  // Expose reconnect method
  };
};
