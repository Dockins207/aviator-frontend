import { useState, useEffect, useRef } from 'react';
import gameSocketService, { GameState, Player } from '../services/gameSocketService';

export const useGameSocket = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Prevent running on server
    if (typeof window === 'undefined') return;

    // Prevent multiple socket connections
    if (socketRef.current) return;

    // Connect to socket
    const socket = gameSocketService.connect();
    socketRef.current = socket;

    // Connection status tracking
    const handleConnect = () => {
      setIsConnected(true);

      // Request initial game state after connection
      socket.emit('requestInitialGameState');
    };

    const handleDisconnect = (reason: string) => {
      setIsConnected(false);
      setGameState(null);
    };

    // Comprehensive game state listeners
    const gameStateEvents = [
      'gameStateUpdate', 
      'game_state', 
      'gameState', 
      'state',
      'GameState',
      'initialGameState'
    ];

    const handleGameStateUpdate = (newGameState: GameState) => {
      if (newGameState) {
        setGameState(newGameState);
      }
    };

    // Error handling
    const handleError = (errorMessage: string) => {
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

    // Cleanup
    return () => {
      gameStateEvents.forEach(event => {
        socket.off(event, handleGameStateUpdate);
      });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socketRef.current = null;
    };
  }, []); // Empty dependency array ensures this runs only once

  return { 
    gameState, 
    isConnected, 
    error 
  };
};
