"use client";

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import io from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import styles from './GameBoard.module.css';
import CrashHistory from './CrashHistory';

interface GameState {
  status: 'idle' | 'betting' | 'flying' | 'crashed';
  multiplier: number;
  players: { id: string; username: string; betAmount: number }[];
  totalPlayers: number;
  totalBetAmount: number;
  countdown: number;
  gameId: string | undefined;
  crashPoint: number | undefined;
}

const GameBoard: React.FC = () => {
  // 1. All useState hooks
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
  const [gameStateHistory, setGameStateHistory] = useState<GameState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 2. All useRef hooks
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 3. All useEffect hooks
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Prevent running on server
    if (typeof window === 'undefined') return;

    let socket: any = null;

    // Check authentication first
    const initializeSocket = async () => {
      try {
        setIsLoading(true);
        const profile = await AuthService.getProfile();
        const token = await AuthService.getToken();
        
        if (!profile || !token) {
          setConnectionError('Authentication required');
          setIsLoading(false);
          return;
        }

        // Socket connection
        const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://2d19-41-212-94-41.ngrok-free.app';
        console.log('Connecting to:', backendUrl);
        
        socket = io(backendUrl, {
          auth: {
            username: profile.username,
            token: token
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          timeout: 20000
        });

        // Connection success
        socket.on('connect', () => {
          console.log('Socket connected successfully');
          setIsConnected(true);
          setConnectionError(null);
          setIsLoading(false);
          
          // Request initial game state
          socket.emit('requestGameState');
        });

        // Error handling
        socket.on('connect_error', (error: any) => {
          console.error('Connection error:', error);
          setConnectionError('Failed to connect to game server. Retrying...');
          setIsConnected(false);
        });

        // Game state update listener
        socket.on('gameStateUpdate', (newGameState: GameState) => {
          console.log('Received game state update:', newGameState);
          setGameState(prevState => ({
            ...prevState,
            ...newGameState,
            multiplier: Number(newGameState.multiplier || prevState.multiplier),
            countdown: Number(newGameState.countdown || prevState.countdown),
            crashPoint: newGameState.crashPoint ? Number(newGameState.crashPoint) : prevState.crashPoint
          }));
        });

        // Disconnection handling
        socket.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect
            socket.connect();
          }
        });

        // Reconnection attempt
        socket.on('reconnecting', (attemptNumber: number) => {
          console.log('Attempting to reconnect:', attemptNumber);
          setConnectionError(`Reconnecting to game server (attempt ${attemptNumber})...`);
        });

        // Reconnection success
        socket.on('reconnect', () => {
          console.log('Reconnected successfully');
          setIsConnected(true);
          setConnectionError(null);
          socket.emit('requestGameState');
        });

      } catch (error) {
        console.error('Socket initialization error:', error);
        setConnectionError('Failed to initialize game connection. Please refresh the page.');
        setIsLoading(false);
      }
    };

    initializeSocket();

    // Cleanup function
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (gameStateHistory.length > 0) {
      if (gameStateHistory.length > 10) {
        setGameStateHistory(prev => prev.slice(-10));
      }
    }
  }, [gameStateHistory]);

  useEffect(() => {
    if (!canvasRef.current || !isClient) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [isClient, canvasRef, isConnected, connectionError]);

  useEffect(() => {
    const rays = document.querySelector(`.${styles.rays}`) as HTMLElement;
    if (!rays) return;

    if (gameState.status === 'crashed') {
      const computedStyle = window.getComputedStyle(rays);
      const transform = computedStyle.transform;
      const matrix = new DOMMatrix(transform);
      const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
      rays.style.setProperty('--current-rotation', `${angle}deg`);
    }
  }, [gameState.status]);

  // Prevent rendering on server
  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full h-[400px] bg-slate-800 rounded-lg flex flex-col items-center justify-center space-y-4">
        <div className="text-white text-lg">Loading game board...</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="w-full h-[400px] bg-slate-800 rounded-lg flex flex-col items-center justify-center space-y-4">
        <div className="text-red-500 text-lg text-center px-4">{connectionError}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const getRayClass = () => {
    switch (gameState.status) {
      case 'flying':
        return styles.raysAnimating;
      case 'crashed':
        return styles.raysCrashed;
      default:
        return styles.raysStopped;
    }
  };

  // Get current progress based on multiplier
  const getProgress = (multiplier: number) => {
    // Much higher threshold before showing anything
    if (!isMounted || multiplier < 1.0) return 0;
    return Math.min((multiplier - 1.0) / 3, 1);
  };

  // Calculate initial path that's completely invisible
  const getInitialPath = () => {
    const height = 330;
    return `M 0 ${height} L 0 ${height}`;
  };

  // Calculate the curve path based on multiplier
  const calculatePath = (multiplier: number, forShadow: boolean = false) => {
    const height = 330;
    const width = 800;
    const progress = getProgress(multiplier);
    
    // When not started or not mounted, stay at origin
    if (!isMounted || progress === 0) {
      return getInitialPath();
    }

    const startX = 0;
    const startY = height;
    const endX = width * 0.85;
    const endY = height * 0.2;
    
    // For shadow, we calculate a bit ahead
    const adjustedProgress = forShadow ? Math.min(progress + 0.01, 1) : progress;
    
    // Keep first control point at bottom longer
    const control1X = width * 0.35 * adjustedProgress;
    const control1Y = height;
    const control2X = width * 0.6;
    const control2Y = height * 0.85;
    
    // For shadow, adjust the end point
    const currentEndX = endX * adjustedProgress;
    const currentEndY = height - ((height - endY) * adjustedProgress);
    
    return `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${currentEndX} ${currentEndY}`;
  };

  // Calculate the shadow area
  const calculateShadowArea = (multiplier: number) => {
    const height = 330;
    const width = 800;
    const progress = getProgress(multiplier);
    
    // No shadow at start or when not mounted
    if (!isMounted || progress === 0) {
      return getInitialPath();
    }
    
    // Calculate shadow path with adjusted progress
    const shadowPath = calculatePath(multiplier, true);
    const adjustedProgress = Math.min(progress + 0.01, 1);
    const currentX = width * 0.85 * adjustedProgress;
    
    return `${shadowPath} L ${currentX} ${height} L 0 ${height} Z`;
  };

  // Calculate the shadow box
  const calculateShadowBox = (multiplier: number) => {
    const height = 330;
    const width = 800;
    const progress = getProgress(multiplier);
    
    // No shadow box at start or when not mounted
    if (!isMounted || progress === 0) {
      return getInitialPath();
    }
    
    // Use same adjusted progress as shadow area
    const adjustedProgress = Math.min(progress + 0.01, 1);
    const currentX = width * 0.85 * adjustedProgress;
    
    return `M 0 ${height}
            L ${currentX} ${height}
            L ${currentX} 0
            L 0 0
            Z`;
  };

  // Format multiplier safely
  const formatMultiplier = () => {
    // If multiplier is not a number, return a default value
    if (typeof gameState.multiplier !== 'number') {
      return '1.00';
    }
    return gameState.multiplier.toFixed(2);
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
        <div className={styles.multiplierContainer}>
          <div className={`text-6xl font-bold ${styles.multiplierText}`}>
            {formatMultiplier()}x
          </div>
        </div>
      );
    }

    // Crashed state
    if (gameState.status === 'crashed') {
      return (
        <div className="flex flex-col items-center justify-center">
          <div className="text-white text-4xl font-medium mb-1">
            FLEW AWAY!
          </div>
          <div className="text-red-500 text-6xl font-bold">
            {formatMultiplier()}x
          </div>
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
    <div className={`rounded-lg p-4 h-[330px] flex flex-col items-center justify-center relative overflow-hidden ${styles.gameBoard}`}>
      <div className={styles.raysContainer}>
        <div className={`${styles.rays} ${getRayClass()}`}></div>
      </div>
      
      <div className="absolute top-0.5 left-2 right-2 z-10">
        <CrashHistory history={[4.66, 40.72, 2.04, 4.82, 2.20, 1.52, 1.27, 1.81, 1.00, 4.31]} />
      </div>

      {gameState.status === 'flying' && isMounted && (
        <svg 
          className={`${styles.flightPath} ${getProgress(gameState.multiplier) > 0 ? styles.visible : ''}`}
          viewBox="0 0 800 330" 
          preserveAspectRatio="none"
        >
          {/* Define clip path using the curve */}
          <defs>
            <clipPath id="shadowClip">
              <path d={calculateShadowBox(gameState.multiplier)} />
            </clipPath>
          </defs>
          
          {/* Shadow area with clip path */}
          <path
            d={calculateShadowArea(gameState.multiplier)}
            className={`${styles.flightLineShadowArea} ${getProgress(gameState.multiplier) > 0 ? styles.visible : ''}`}
            clipPath="url(#shadowClip)"
            pathLength={getProgress(gameState.multiplier) === 0 ? 0 : 1000}
          />
          
          {/* Main line */}
          <path
            d={calculatePath(gameState.multiplier)}
            className={`${styles.flightLine} ${getProgress(gameState.multiplier) > 0 ? styles.visible : ''}`}
            pathLength={getProgress(gameState.multiplier) === 0 ? 0 : 1000}
            style={{
              strokeDasharray: getProgress(gameState.multiplier) === 0 ? '0' : '1000',
              strokeDashoffset: getProgress(gameState.multiplier) === 0 ? '0' : `${1000 * (1 - getProgress(gameState.multiplier))}`
            } as CSSProperties}
          />
        </svg>
      )}

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-20"
      />
      <div className="relative z-30">
        {renderGameContent()}
      </div>
    </div>
  );
};

export default GameBoard;
