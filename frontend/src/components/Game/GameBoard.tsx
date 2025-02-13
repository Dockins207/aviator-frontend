"use client";

import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';

interface GameState {
  status: string;
  multiplier: number;
  players: any[];
  totalPlayers: number;
  totalBetAmount: number;
  countdown: number;
  gameId: string | undefined;
  crashPoint: number | undefined;
}

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    multiplier: 1,
    players: [],
    totalPlayers: 0,
    totalBetAmount: 0,
    countdown: 0,
    gameId: undefined,
    crashPoint: undefined
  });
  const [gameStateHistory, setGameStateHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Prevent running on server
    if (typeof window === 'undefined') return;

    // Get authentication details
    const token = AuthService.getToken();
    
    const initializeSocket = async () => {
      const profile = await AuthService.getProfile();

      if (!token || !profile) {
        setConnectionError('Authentication required');
        return;
      }

      // Socket connection
      const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const socket = io(backendUrl, {
        auth: {
          userId: profile.user_id,
          username: profile.username,
          token: token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Connection success
      socket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
        
        // Request initial game state
        socket.emit('requestGameState');
      });

      // Error handling
      socket.on('connect_error', (error) => {
        setConnectionError(error.message);
        setIsConnected(false);
      });

      // Game state update listener
      socket.on('gameStateUpdate', (newGameState) => {

        // More aggressive multiplier update logic
        const updatedMultiplier = 
          newGameState.multiplier !== undefined 
            ? Number(newGameState.multiplier) 
            : gameState.multiplier;

        const updatedState = {
          ...gameState,
          ...newGameState,
          multiplier: updatedMultiplier,
          // Ensure numeric conversion for critical fields
          countdown: Number(newGameState.countdown || gameState.countdown),
          crashPoint: newGameState.crashPoint ? Number(newGameState.crashPoint) : gameState.crashPoint
        };

        setGameState(prevState => {
          const finalState = {
            ...prevState,
            ...updatedState
          };

          return finalState;
        });
      });

      // Disconnection handling
      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        setConnectionError(`Disconnected: ${reason}`);
      });

      // Cleanup on unmount
      return () => {
        socket.disconnect();
      };
    };

    const socketCleanup = initializeSocket();
    
    // Cleanup function
    return () => {
      socketCleanup.then(cleanup => cleanup?.());
    };
  }, []); // Empty dependency array means run once

  useEffect(() => {
    if (gameStateHistory.length > 0) {
      if (gameStateHistory.length > 10) {
        setGameStateHistory(prev => prev.slice(-10));
      }
    }
  }, [gameStateHistory]);

  // Prevent rendering on server
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent rendering on server
  if (!isClient) {
    return null;
  }

  // Render connection status
  if (!isConnected) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-[330px] flex flex-col items-center justify-center">
        <div className="text-gray-500 text-center">
          {connectionError ? `Connection Error: ${connectionError}` : 'Connecting to game...'}
        </div>
      </div>
    );
  }

  // Format multiplier safely
  const formatMultiplier = () => {
    // If multiplier is not a number, return a default value
    if (typeof gameState.multiplier !== 'number') {
      return '1.00';
    }
    return gameState.multiplier.toFixed(2);
  };

  // Determine display color based on game status
  const getStatusColor = () => {
    switch (gameState.status) {
      case 'betting':
        return 'text-yellow-500';
      case 'flying':
        return 'text-green-500';
      case 'crashed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Render game content based on state
  const renderGameContent = () => {
    // Betting state with countdown
    if (gameState.status === 'betting' && gameState.countdown !== undefined) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold">
            Next round Starts In
          </div>
          <div className="text-white text-6xl font-bold mt-4">
            {gameState.countdown}
          </div>
        </div>
      );
    }

    // Flying state
    if (gameState.status === 'flying') {
      return (
        <div className={`text-6xl font-bold ${getStatusColor()}`}>
          <span className="text-white">{formatMultiplier()}x</span>
        </div>
      );
    }

    // Crashed state
    if (gameState.status === 'crashed') {
      return (
        <div className="text-red-500 text-4xl font-bold">
          Crashed @{formatMultiplier()}x
        </div>
      );
    }

    // Default state
    return (
      <div className="text-gray-500">
        Waiting for game...
      </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-[330px] flex flex-col items-center justify-center">
      {renderGameContent()}
    </div>
  );
};

export default GameBoard;
