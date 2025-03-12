import React, { useEffect, useState } from 'react';
import BettingButtons from '@/components/BettingButtons';
import betServiceInstance from '@/services/betService';
import { getToken } from '@/utils/authUtils';
import { toast } from 'react-hot-toast';

const GamePage: React.FC = () => {
  const [gameState, setGameState] = useState<string>('waiting');
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  
  useEffect(() => {
    if (isAuthenticated && !betServiceInstance.isConnected()) {
      betServiceInstance.connectSocketAfterLogin();
    }
    
    const handleGameStateChange = (state: string) => {
      setGameState(state);
    };
    
    const handleMultiplierUpdate = (multiplierValue: number) => {
      setMultiplier(multiplierValue);
    };
    
    betServiceInstance.on('gameStateChange', handleGameStateChange);
    betServiceInstance.on('multiplierUpdate', handleMultiplierUpdate);
    
    if (betServiceInstance.hasActiveBet()) {
      const bet = betServiceInstance.getCurrentBet();
      if (bet?.betId) {
        setActiveBetId(bet.betId);
      }
    }
    
    const handleBetPlaced = (event: CustomEvent) => {
      if (event.detail?.betId) {
        setActiveBetId(event.detail.betId);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('betPlacedSuccessfully', handleBetPlaced as EventListener);
    }
    
    return () => {
      betServiceInstance.off('gameStateChange', handleGameStateChange);
      betServiceInstance.off('multiplierUpdate', handleMultiplierUpdate);
      if (typeof window !== 'undefined') {
        window.removeEventListener('betPlacedSuccessfully', handleBetPlaced as EventListener);
      }
    };
  }, [isAuthenticated]);
  
  const handleBetPlacedCallback = (success: boolean, betId?: string) => {
    if (success) {
      console.log(`Bet placed successfully with ID: ${betId}`);
    }
  };
  
  const handleCashout = (success: boolean, multiplier?: number) => {
    if (success) {
      console.log(`Cashed out successfully at ${multiplier}x`);
    }
  };
  
  const handleDirectCashout = async () => {
    const betId = activeBetId || betServiceInstance.getCurrentBet()?.betId;
    
    if (!betId) {
      toast.error('No active bet found for direct cashout');
      return;
    }
    
    try {
      toast.loading('Processing direct emergency cashout...');
      const response = await betServiceInstance.directCashout(betId);
      
      if (response.success) {
        setActiveBetId(null);
        toast.success('Direct cashout successful!');
      } else {
        toast.error('Direct cashout failed: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Direct cashout error:', error);
      toast.error(error.message || 'Failed to process direct cashout');
    }
  };
  
  return (
    <div className="game-container p-4">
      <div className="game-state-display mb-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Game Status: {gameState}</h2>
        <div className="multiplier text-4xl font-bold text-purple-600">
          {multiplier.toFixed(2)}x
        </div>
      </div>
      
      <div className="betting-section max-w-md mx-auto">
        <h3 className="text-xl font-semibold mb-4">Place Your Bets</h3>
        
        {!isAuthenticated ? (
          <div className="auth-warning bg-yellow-100 border border-yellow-400 p-4 text-yellow-700 rounded">
            Please login to place bets
          </div>
        ) : (
          <BettingButtons 
            onBetPlaced={handleBetPlacedCallback}
            onCashout={handleCashout}
            disabled={gameState === 'in_progress' && !betServiceInstance.hasActiveBet()}
          />
        )}
        
        {isAuthenticated && activeBetId && (
          <div className="mt-4">
            <button 
              onClick={handleDirectCashout}
              className="w-full py-2 bg-red-700 hover:bg-red-800 text-white font-bold uppercase tracking-wider rounded-md"
            >
              EMERGENCY DIRECT CASHOUT
            </button>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Bet ID: {activeBetId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;
