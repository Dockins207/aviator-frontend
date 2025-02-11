"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGameSocket } from '../../hooks/useGameSocket';

// Dynamic rendering to prevent hydration issues
const GameBoard: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const { gameState, isConnected, error } = useGameSocket();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent rendering on server
  if (!isClient) {
    return null;
  }

  // Format multiplier safely with more robust parsing
  const formatMultiplier = () => {
    if (!gameState?.multiplier) return '1.00';
    
    const multiplier = parseFloat(gameState.multiplier);
    return isNaN(multiplier) ? '1.00' : multiplier.toFixed(2);
  };

  // Determine display color based on game status
  const getStatusColor = () => {
    switch (gameState?.status) {
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
    if (error) {
      return (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      );
    }

    if (!isConnected) {
      return (
        <div className="text-gray-500">
          Connecting to game...
        </div>
      );
    }

    // Betting state with countdown
    if (gameState?.status === 'betting' && gameState.countdown !== undefined) {
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
    if (gameState?.status === 'flying') {
      return (
        <div className={`text-6xl font-bold ${getStatusColor()}`}>
          <span className="text-white">{formatMultiplier()}x</span>
        </div>
      );
    }

    // Crashed state
    if (gameState?.status === 'crashed') {
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

// Dynamically import to prevent SSR
export default dynamic(() => Promise.resolve(GameBoard), {
  ssr: false
});
