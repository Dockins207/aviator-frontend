"use client";

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Button from '@/components/Button/Button';
import BetService from '@/services/betService';
import { useGameSocket } from '@/hooks/useGameSocket';

const BettingPanel: React.FC = () => {
  const { gameState } = useGameSocket();
  const [betAmount, setBetAmount] = useState<string>('');
  const [isBetPlaced, setIsBetPlaced] = useState<boolean>(false);
  const [currentBetId, setCurrentBetId] = useState<string | null>(null);

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent changing bet amount after bet is placed
    if (!isBetPlaced) {
      const amount = Number(e.target.value);
      setBetAmount(amount.toString());
    }
  };

  const placeBet = async () => {
    // Prevent multiple bet placements
    if (isBetPlaced) {
      try {
        // Cashout logic
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
        toast.error('Failed to cashout');
        console.error(err);
      }
    } else {
      // Place bet logic
      try {
        // Validate bet amount
        if (betAmount === '') {
          toast.error('Please enter a valid bet amount');
          return;
        }

        const betResponse = await BetService.placeBet(
          Number(betAmount), 
          gameState?.gameId
        );
        
        if (betResponse.success) {
          setIsBetPlaced(true);
          setCurrentBetId(betResponse.betId || null);
          toast.success('Bet placed successfully');
        } else {
          toast.error(betResponse.message || 'Bet placement failed');
        }
      } catch (err: any) {
        // Handle specific error scenarios
        const errorMessage = err.message || 'Failed to place bet';
        toast.error(errorMessage);
        console.error('Bet Placement Error:', err);
      }
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4">
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
          placeholder="Enter bet amount"
          disabled={isBetPlaced}
          className={`w-full px-3 py-2 bg-slate-700 text-white rounded ${isBetPlaced ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <Button 
          onClick={placeBet}
          variant={isBetPlaced ? "orange" : "secondary"}
          size="md"
          fullWidth
        >
          {isBetPlaced ? 'Cashout' : 'Place Bet'}
        </Button>
      </div>
    </div>
  );
};

export default BettingPanel;
