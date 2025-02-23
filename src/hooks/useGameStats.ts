import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameSessionStats } from '../types/GameStats';
import { AuthService } from '@/app/lib/auth';

export const useGameStats = (socketUrl: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameStats, setGameStats] = useState<GameSessionStats>({
    onlineUsers: 0,
    totalBetsCount: 0,
    totalBetAmount: 0,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    // Get the JWT token from AuthService
    const token = AuthService.getToken();

    // Create socket connection
    const newSocket = io(socketUrl, {
      withCredentials: true,
      auth: {
        token: token
      }
    });

    // Listen for game session stats
    newSocket.on('game_session_stats', (stats: GameSessionStats) => {
      setGameStats(stats);
    });

    // Set socket state
    setSocket(newSocket);

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, [socketUrl]);

  return {
    gameStats,
    socket
  };
};
