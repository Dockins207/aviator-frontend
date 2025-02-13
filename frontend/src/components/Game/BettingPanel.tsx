"use client";

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Button from '@/components/Button/Button';
import BetService from '@/services/betService';
import { useGameSocket } from '@/hooks/useGameSocket';
import { AuthService } from '@/app/lib/auth';

const BettingPanel: React.FC = () => {
  const { gameState } = useGameSocket();
  const [betAmount, setBetAmount] = useState<string>('');
  const [isBetPlaced, setIsBetPlaced] = useState<boolean>(false);
  const [currentBetId, setCurrentBetId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check authentication status
  useEffect(() => {
    const checkAuthStatus = () => {
      const authenticated = AuthService.isAuthenticated();
      setIsAuthenticated(authenticated);
    };

    checkAuthStatus();
  }, []);

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isBetPlaced) {
      const amount = Number(e.target.value);
      // Validate bet amount range (10-1000)
      if (amount >= 10 && amount <= 1000) {
        setBetAmount(amount.toString());
      } else if (amount > 1000) {
        setBetAmount('1000');
        toast.error('Maximum bet amount is 1000');
      } else {
        setBetAmount(amount.toString());
      }
    }
  };

  const placeBet = async () => {
    // Check authentication first
    if (!isAuthenticated) {
      toast.error('Please log in to place a bet');
      return;
    }

    if (isBetPlaced) {
      // Cashout logic
      try {
        if (currentBetId) {
          const cashoutResponse = await BetService.cashOutBet(currentBetId);
          
          if (cashoutResponse.success) {
            setIsBetPlaced(false);
            setCurrentBetId(null);
            setBetAmount('');
            toast.success('Bet cashed out successfully');
          } else {
            toast.error(cashoutResponse.message || 'Cashout failed');
          }
        }
      } catch (err) {
        console.error('Cashout Error:', err);
        toast.error('Failed to cashout');
      }
    } else {
      // Place bet logic
      try {
        // Validate bet amount
        const amount = Number(betAmount);
        if (isNaN(amount) || amount < 10 || amount > 1000) {
          toast.error('Bet amount must be between 10 and 1000');
          return;
        }

        console.log('Attempting to place bet:', { amount });

        const betResponse = await BetService.placeBet(amount);
        
        if (betResponse.success) {
          setIsBetPlaced(true);
          setCurrentBetId(betResponse.betId || null);
          toast.success('Bet placed successfully');
        } else {
          toast.error(betResponse.message || 'Bet placement failed');
        }
      } catch (err: any) {
        // Comprehensive error logging
        console.error('Detailed Bet Placement Error:', {
          error: err,
          name: err.name,
          message: err.message,
          response: err.response,
          config: err.config
        });

        // Determine the most informative error message
        let errorMessage = 'Failed to place bet';
        
        if (err.response) {
          // Server responded with an error
          switch (err.response.status) {
            case 400:
              errorMessage = 'Invalid bet request. Please check your input.';
              break;
            case 401:
              errorMessage = 'Unauthorized. Please log in again.';
              break;
            case 403:
              errorMessage = 'You are not allowed to place this bet.';
              break;
            case 500:
              errorMessage = 'Server error. Please try again later.';
              break;
            default:
              errorMessage = err.response.data?.message 
                || err.response.statusText 
                || 'An unexpected server error occurred';
          }
        } else if (err.request) {
          // Request was made but no response received
          errorMessage = 'No response from server. Please check your internet connection.';
        } else {
          // Something happened in setting up the request
          errorMessage = err.message || 'Error setting up the bet request';
        }
        
        // Display the most specific error message
        toast.error(errorMessage);
      }
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 h-80 flex flex-col justify-between w-full md:w-96 mx-auto">
      <Toaster 
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: '#4CAF50',
              color: 'white',
            },
          },
          error: {
            style: {
              background: '#F44336',
              color: 'white',
            },
          },
        }}
      />
      <div className="flex flex-col space-y-4">
        <input 
          type="number" 
          value={betAmount}
          onChange={handleBetChange}
          placeholder="Enter bet amount (10-1000)"
          disabled={isBetPlaced || !isAuthenticated}
          className={`w-full px-3 py-3 bg-slate-700 text-white rounded text-lg 
            ${(isBetPlaced || !isAuthenticated) ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <Button 
          onClick={placeBet}
          variant={isBetPlaced ? "orange" : "secondary"}
          size="md"
          fullWidth
          disabled={!isAuthenticated}
        >
          {!isAuthenticated 
            ? 'Login to Bet' 
            : (isBetPlaced ? 'Cashout' : 'Place Bet')
          }
        </Button>
      </div>
    </div>
  );
};

export default BettingPanel;
