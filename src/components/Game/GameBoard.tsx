"use client";

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import io from 'socket.io-client';
import { AuthService } from '@/app/lib/auth';
import styles from './GameBoard.module.css';
import CrashHistory from './CrashHistory';

interface GameState {
  status: 'idle' | 'betting' | 'flying' | 'crashed';
  multiplier: number;
  players: any[];
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
  const [crashHistory, setCrashHistory] = useState<number[]>([
    4.66, 40.72, 2.04, 4.82, 2.20, 1.52, 1.27, 1.81, 1.00, 4.31,
    11.14, 1.07, 2.98, 1.30, 1.29, 1.50, 9.80, 2.15, 3.45, 1.92,
    5.67, 8.23, 1.45, 2.78, 15.90, 1.23, 3.89, 2.56, 1.78, 6.34,
    12.45, 3.67, 1.89, 7.23, 2.34, 4.56, 1.67, 8.90, 3.21, 5.78,
    1.34, 6.78, 2.45, 9.12, 1.56, 4.23, 7.89, 2.67, 5.34, 1.78,
    13.45, 2.23, 6.78, 1.45, 8.90, 3.34, 5.67, 2.12, 4.56, 1.89,
    10.23, 3.45, 7.89, 2.56, 4.78, 1.67, 6.34, 2.89, 5.12, 1.45,
    15.67, 2.34, 8.90, 1.78, 4.56, 3.23, 7.89, 2.45, 6.12, 1.89
  ]);

  // 2. All useRef hooks
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

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

    // Check authentication first
    const token = AuthService.getToken();
    if (!token) {
      setConnectionError('Please login to continue');
      return;
    }

    // Get authentication details
    const initializeSocket = async () => {
      try {
        const profile = await AuthService.getProfile();
        
        if (!profile) {
          setConnectionError('Authentication required');
          return;
        }

        // Socket connection
        const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const socket = io(backendUrl, {
          auth: {
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
          const updatedState = {
            ...gameState,
            ...newGameState,
            multiplier: Number(newGameState.multiplier || gameState.multiplier),
            countdown: Number(newGameState.countdown || gameState.countdown),
            crashPoint: newGameState.crashPoint ? Number(newGameState.crashPoint) : gameState.crashPoint
          };

          setGameState(prevState => ({
            ...prevState,
            ...updatedState
          }));
          setGameStateHistory(prev => [...prev, updatedState]);
        });

        // Disconnection handling
        socket.on('disconnect', (reason) => {
          setIsConnected(false);
          setConnectionError(`Disconnected: ${reason}`);
        });

        return () => {
          socket.disconnect();
        };
      } catch (error) {
        setConnectionError('Failed to initialize socket');
      }
    };

    const socketCleanup = initializeSocket();
    return () => {
      socketCleanup.then(cleanup => cleanup?.());
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
  }, [gameState, isConnected, connectionError, isClient]);

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

  // Get the current point on the path
  const getCurrentPoint = (multiplier: number, offset: number = 0) => {
    const height = 330;
    const width = 800;
    const progress = getProgress(multiplier);
    
    if (!isMounted || progress === 0) {
      return { x: 0, y: height };
    }

    const endX = width * 0.85;
    const endY = height * 0.2;
    
    // Calculate current point based on progress, with optional offset
    const adjustedProgress = Math.min(progress + offset, 1);
    const x = adjustedProgress * endX;
    const y = height - (adjustedProgress * (height - endY));
    
    return { x, y };
  };

  // Calculate the visible portion of the path based on multiplier
  const calculateVisiblePath = (multiplier: number): CSSProperties => {
    const totalLength = 1000;
    const progress = getProgress(multiplier);
    
    // Complete invisibility at start or when not mounted
    if (!isMounted || progress === 0) {
      return {
        strokeDasharray: '0',
        strokeDashoffset: '0',
        opacity: 0,
        visibility: 'hidden' as const,
        pointerEvents: 'none' as const
      };
    }
    
    return {
      strokeDasharray: totalLength,
      strokeDashoffset: totalLength * (1 - progress),
      opacity: 1,
      visibility: 'visible' as const,
      pointerEvents: 'auto' as const
    };
  };

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
        <CrashHistory history={crashHistory} />
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
