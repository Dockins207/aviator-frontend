import React, { useState, useEffect } from 'react';
import betServiceInstance, { BetServiceError } from '@/services/betService';
import { getToken } from '@/utils/authUtils';

interface BettingButtonsProps {
  className?: string;
  onBetPlaced?: (success: boolean, betId?: string) => void;
  onCashout?: (success: boolean, multiplier?: number) => void;
  disabled?: boolean;
}

const BettingButtons: React.FC<BettingButtonsProps> = ({
  className,
  onBetPlaced,
  onCashout,
  disabled = false
}) => {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [autoCashoutMultiplier, setAutoCashoutMultiplier] = useState<number | undefined>(undefined);
  const [isPlacingBet, setIsPlacingBet] = useState<boolean>(false);
  const [isCashingOut, setIsCashingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  const [hasActiveBet, setHasActiveBet] = useState<boolean>(false);
  
  // Listen for multiplier updates
  useEffect(() => {
    const handleMultiplierUpdate = (multiplier: number) => {
      setCurrentMultiplier(multiplier);
    };
    
    betServiceInstance.on('multiplierUpdate', handleMultiplierUpdate);
    
    // Check if there's already an active bet
    setHasActiveBet(betServiceInstance.hasActiveBet());
    
    return () => {
      betServiceInstance.off('multiplierUpdate', handleMultiplierUpdate);
    };
  }, []);
  
  // Handle bet placement
  const handlePlaceBet = async () => {
    setError(null);
    
    // Immediately update UI state
    setIsPlacingBet(true);
    setHasActiveBet(true);
    
    // Fire and forget approach for instant action
    betServiceInstance.placeBet({
      amount: betAmount,
      autoCashoutMultiplier
    }).then(response => {
      if (response.success) {
        console.log('Bet placed successfully', response);
        if (onBetPlaced) {
          onBetPlaced(true, response.data?.betId);
        }
      } else {
        setError('Failed to place bet: ' + (response.message || 'Unknown error'));
        setHasActiveBet(false); // Reset UI state on error
        if (onBetPlaced) {
          onBetPlaced(false);
        }
      }
    }).catch(error => {
      console.error('Error placing bet:', error);
      setError(error instanceof Error ? error.message : 'Failed to place bet');
      setHasActiveBet(false); // Reset UI state on error
      if (onBetPlaced) {
        onBetPlaced(false);
      }
    }).finally(() => {
      setIsPlacingBet(false);
    });
  };
  
  // Handle cash out
  const handleCashout = async () => {
    setError(null);
    
    // Immediately update UI state
    setIsCashingOut(true);
    
    const token = getToken();
    const currentBet = betServiceInstance.getCurrentBet();
    
    if (!token) {
      setError('Authentication token not found');
      setIsCashingOut(false);
      return;
    }
    
    if (!currentBet || !currentBet.betId) {
      setError('No active bet to cash out');
      setIsCashingOut(false);
      return;
    }
    
    // Instant action - fire and forget
    betServiceInstance.cashoutBet({
      token,
      betId: currentBet.betId,
      currentMultiplier
    }).then(response => {
      if (response.success) {
        console.log('Cashed out successfully', response);
        if (onCashout) {
          onCashout(true, currentMultiplier);
        }
      } else {
        setError('Failed to cash out: ' + (response.message || 'Unknown error'));
        if (onCashout) {
          onCashout(false);
        }
      }
    }).catch(error => {
      // Try direct cashout as fallback
      console.log('Trying direct cashout as fallback');
      betServiceInstance.directCashout(currentBet.betId).then(response => {
        if (response.success) {
          console.log('Direct cashout succeeded', response);
          if (onCashout) {
            onCashout(true, currentMultiplier);
          }
        } else {
          setError('Failed to cash out: ' + (response.message || 'Unknown error'));
          if (onCashout) {
            onCashout(false);
          }
        }
      }).catch(fallbackError => {
        console.error('Error cashing out:', fallbackError);
        setError(fallbackError instanceof Error ? fallbackError.message : 'Failed to cash out');
        if (onCashout) {
          onCashout(false);
        }
      });
    }).finally(() => {
      // Always reset cashout state
      setHasActiveBet(false);
      setIsCashingOut(false);
    });
  };
  
  return (
    <div className={`betting-controls ${className || ''}`}>
      {error && (
        <div className="error-message text-red-500 mb-2">
          {error}
        </div>
      )}
      
      <div className="bet-amount-control mb-4">
        <label htmlFor="bet-amount" className="block mb-1">Bet Amount:</label>
        <input
          id="bet-amount"
          type="number"
          className="w-full p-2 border rounded"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          min={10}
          max={50000}
          disabled={isPlacingBet || hasActiveBet || disabled}
        />
      </div>
      
      <div className="auto-cashout-control mb-4">
        <label htmlFor="auto-cashout" className="block mb-1">
          Auto Cashout at (optional):
        </label>
        <input
          id="auto-cashout"
          type="number"
          className="w-full p-2 border rounded"
          value={autoCashoutMultiplier || ''}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : undefined;
            setAutoCashoutMultiplier(value);
          }}
          placeholder="Auto cashout multiplier"
          min={1.01}
          step={0.01}
          disabled={isPlacingBet || hasActiveBet || disabled}
        />
      </div>
      
      <div className="betting-buttons flex space-x-4">
        <button
          className="place-bet-button bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
          onClick={handlePlaceBet}
          disabled={isPlacingBet || hasActiveBet || !betServiceInstance.isConnected() || disabled}
        >
          {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
        </button>
        
        <button
          className="cashout-button bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
          onClick={handleCashout}
        >
          {isCashingOut ? 'Cashing Out...' : `Cash Out (${currentMultiplier.toFixed(2)}x)`}
        </button>
      </div>
    </div>
  );
};

export default BettingButtons;
