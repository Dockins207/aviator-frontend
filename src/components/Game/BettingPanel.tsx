"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import BettingService, { BetDetails, BetResponse } from '../../services/betService';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { AuthService } from '../../app/lib/auth';
import WalletService from '../../services/walletService'; // Import WalletService

interface BettingControlsProps {
  balance?: number;
  onPlaceBet?: (betAmount: number, section: string) => void;
  isPlaying?: boolean;
}

interface AutoBetSettings {
  baseBet: string;
  maxStakeAmount: string;
  autoCashout: string;
  onWin: {
    type: 'baseBet' | 'increase';
    multiplier: string;
  };
  onLose: {
    type: 'baseBet' | 'increase';
    multiplier: string;
  };
}

type BetSectionProps = {
  section: 'first' | 'second';
  state: { amount: string; autoMode: boolean };
  setState: React.Dispatch<React.SetStateAction<{ amount: string; autoMode: boolean }>>;
  balance: number;
  isPlaying: boolean;
  onPlaceBet: (amount: number, section: 'first' | 'second') => void;
  autoMultiplier: string;
  setAutoMultiplier: (value: string) => void;
};

const useNumericInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);

  return { value, setValue };
};

const NumericInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}> = ({ 
  label, 
  value, 
  onChange, 
  className = '', 
  min = 0, 
  max = Infinity,
  placeholder
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = inputValue.replace(/[^0-9.]/g, '');
    
    if (numericValue === '' || 
        (Number(numericValue) >= min && Number(numericValue) <= max)) {
      onChange(numericValue);
    }
  };

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      <label className="text-gray-400 text-[10px]">{label}</label>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          value={value}
          onChange={handleChange}
          onFocus={(e) => e.target.select()}
          className="w-full bg-white text-black text-center py-2 text-[10px] rounded-lg appearance-none 
            [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 
            [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 
            [&::-webkit-outer-spin-button]:appearance-none border border-gray-300 
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default function BettingPanel({
  balance,
  onPlaceBet: originalOnPlaceBet,
  isPlaying
}: BettingControlsProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  
  const handlePlaceBet = useCallback(async (amount: number, section: 'first' | 'second') => {
    console.log('🎲 Bet Placement Attempt', {
      section, 
      amount, 
      typeOfAmount: typeof amount,
      isNaN: isNaN(amount),
      parsedAmount: Number(amount),
      timestamp: new Date().toISOString()
    });

    if (amount <= 0) {
      toast.error('Invalid bet amount');
      return;
    }

    if (isPlaying) {
      toast.error('Cannot place bet while a game is in progress.');
      return;
    }

    try {
      // Get user ID from wallet service before placing bet
      const userId = await WalletService.getUserId();

      const betDetails: BetDetails = {
        amount,
        userId: userId, // Use retrieved user ID
        cashoutMultiplier: section === 'first' ? 1.5 : 2.0
      };

      console.log('📤 Sending Bet Details', { 
        betDetails, 
        timestamp: new Date().toISOString() 
      });

      const placedBet = await BettingService.placeBet(betDetails);
      
      console.log('📥 Bet Placement Response', { 
        placedBet, 
        timestamp: new Date().toISOString() 
      });

      if (placedBet.status === 'placed') {
        console.log('✅ Bet Placed Successfully', { 
          amount, 
          section, 
          timestamp: new Date().toISOString() 
        });
        
        toast.success(`Bet placed successfully`);
        
        originalOnPlaceBet?.(amount, section);
      } else {
        toast.error(placedBet.message || 'Failed to place bet');
      }
    } catch (error) {
      console.error('❌ Bet Placement Error', {
        error,
        timestamp: new Date().toISOString()
      });
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  }, [isPlaying, originalOnPlaceBet]);

  const BetSection: React.FC<BetSectionProps> = ({
    section,
    state,
    setState,
    balance,
    isPlaying,
    onPlaceBet,
    autoMultiplier,
    setAutoMultiplier
  }) => {
    const { value, setValue } = useNumericInput();

    return (
      <div className="bg-slate-800 p-4 rounded-lg space-y-1">
        <h2 className="text-gray-400 text-[10px] -mt-1">{section === 'first' ? 'First Bet' : 'Second Bet'}</h2>
        
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => setValue((prev) => (Number(prev) > 0 ? (Number(prev) - 1).toString() : prev))}
            className="bg-purple-800 text-white px-3 py-2 rounded text-[10px]"
          >
            -
          </button>
          
          <NumericInput
            label=""
            value={value}
            onChange={setValue}
            min={0}
            max={balance}
            placeholder="Enter amount"
            className="flex-grow"
          />
          
          <button
            onClick={() => setValue((prev) => (Number(prev) + 1).toString())}
            className="bg-purple-800 text-white px-3 py-2 rounded text-[10px]"
          >
            +
          </button>
        </div>

        <div className="flex flex-row justify-between gap-1.5 mb-2">
          {[
            { value: 10, label: '10' },
            { value: 100, label: '100' },
            { value: 200, label: '200' },
            { value: 500, label: '500' },
            { value: 1000, label: '1000' }
          ].map((btn) => (
            <button 
              key={btn.value}
              onClick={() => {
                // If current amount is the button's value, clear the input
                setValue(prev => prev === btn.value.toString() ? '' : btn.value.toString());
              }}
              className={`flex-1 ${
                value === btn.value.toString() 
                  ? 'bg-green-600 text-white' 
                  : 'bg-purple-800 text-white'
              } text-[10px] py-2 max-sm:py-4 rounded transition-colors duration-200`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Auto</span>
            <button
              onClick={() => setState(prev => ({ ...prev, autoMode: !prev.autoMode }))}
              className={`px-2 h-8 rounded text-[10px] ${
                state.autoMode 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-purple-900/30 hover:bg-purple-800/30'
              }`}
            >
              {state.autoMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {state.autoMode && (
            <div className="flex items-center gap-2">
              <input 
                type="text"
                value={autoMultiplier}
                onChange={(e) => setAutoMultiplier(e.target.value)}
                className="w-full bg-white text-black text-center text-[10px] focus:outline-none py-1 rounded-lg appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none border border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isPlaying && Number(value) > balance}
          onClick={() => {
            console.log(`🎲 Bet Button Clicked`, { 
              section, 
              value: Number(value), 
              balance,
              isPlaying,
              timestamp: new Date().toISOString()
            });

            const numericValue = Number(value);

            if (numericValue <= 0) {
              toast.error('Please enter a valid bet amount', {
                position: 'top-right',
                duration: 2000
              });
              return;
            }

            console.log(`✅ Proceeding with bet placement`, {
              amount: numericValue,
              section,
              timestamp: new Date().toISOString()
            });
            onPlaceBet(numericValue, section);
            setValue('');
          }}
          className={`w-full py-2 max-sm:py-6 sm:py-4 rounded-lg transition-colors duration-300 text-[20px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg ${
            Number(value) > 0 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-green-600/50'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
        >
          {Number(value) > 0 
            ? `Bet KSH ${Number(value).toLocaleString()}` 
            : 'Bet'}
        </button>
      </div>
    );
  };

  const AutoBetTab: React.FC = () => {
    const [baseBet, setBaseBet] = useState('');
    const [maxStake, setMaxStake] = useState('');
    const [autoCashout, setAutoCashout] = useState('');
    const [winStrategy, setWinStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [loseStrategy, setLoseStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [winMultiplier, setWinMultiplier] = useState('');
    const [loseMultiplier, setLoseMultiplier] = useState('');

    const resetAutoBetSettings = () => {
      setBaseBet('');
      setMaxStake('');
      setAutoCashout('');
      setWinStrategy('baseBet');
      setLoseStrategy('baseBet');
      setWinMultiplier('');
      setLoseMultiplier('');
    };

    const startAutoplay = () => {
      console.log('Autoplay started with settings:', {
        baseBet,
        maxStake,
        autoCashout,
        winStrategy,
        loseStrategy,
        winMultiplier,
        loseMultiplier
      });
    };

    return (
      <div className="bg-slate-800 min-h-[220px] p-4 rounded-lg">
        <div className="space-y-2">
          <div className="flex gap-2">
            <NumericInput
              label="Base Bet"
              value={baseBet}
              onChange={(e) => setBaseBet(e)}
              className=""
              min={0}
              max={Infinity}
            />
            <NumericInput
              label="Max Stake"
              value={maxStake}
              onChange={(e) => setMaxStake(e)}
              className=""
              min={0}
              max={Infinity}
            />
          </div>

          <NumericInput
            label="Auto Cashout"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e)}
            className=""
            min={0}
            max={Infinity}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-green-400 text-[10px] mb-1">If You Win</div>
              <div className="flex rounded bg-purple-900/30">
                <button 
                  onClick={() => setWinStrategy('baseBet')}
                  className={`flex-1 py-1 text-[10px] ${
                    winStrategy === 'baseBet' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50'
                  }`}
                >
                  Base Bet
                </button>
                <button 
                  onClick={() => setWinStrategy('increase')}
                  className={`flex-1 py-1 text-[10px] ${
                    winStrategy === 'increase' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50'
                  }`}
                >
                  Increase
                </button>
              </div>
              {winStrategy === 'increase' && (
                <NumericInput
                  label="Win Multiplier"
                  value={winMultiplier}
                  onChange={(e) => setWinMultiplier(e)}
                  className=""
                  min={0}
                  max={Infinity}
                />
              )}
            </div>

            <div>
              <div className="text-red-400 text-[10px] mb-1">If You Lose</div>
              <div className="flex rounded bg-purple-900/30">
                <button 
                  onClick={() => setLoseStrategy('baseBet')}
                  className={`flex-1 py-1 text-[10px] ${
                    loseStrategy === 'baseBet' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50'
                  }`}
                >
                  Base Bet
                </button>
                <button 
                  onClick={() => setLoseStrategy('increase')}
                  className={`flex-1 py-1 text-[10px] ${
                    loseStrategy === 'increase' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50'
                  }`}
                >
                  Increase
                </button>
              </div>
              {loseStrategy === 'increase' && (
                <NumericInput
                  label="Lose Multiplier"
                  value={loseMultiplier}
                  onChange={(e) => setLoseMultiplier(e)}
                  className=""
                  min={0}
                  max={Infinity}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={startAutoplay}
              className="flex-grow py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider"
            >
              Start Autoplay
            </button>
            <button
              onClick={resetAutoBetSettings}
              className="py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[10px] font-bold uppercase tracking-wider"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ManualBetTab: React.FC = () => {
    return (
      <div className="grid grid-cols-2 gap-1 mt-1 sm:grid-cols-2 max-w-full">
        <BetSection 
          section="first"
          state={{ amount: '', autoMode: false }}
          setState={() => {}}
          balance={balance ?? 0}
          isPlaying={isPlaying ?? false}
          onPlaceBet={handlePlaceBet}
          autoMultiplier=""
          setAutoMultiplier={() => {}}
        />
        <BetSection 
          section="second"
          state={{ amount: '', autoMode: false }}
          setState={() => {}}
          balance={balance ?? 0}
          isPlaying={isPlaying ?? false}
          onPlaceBet={handlePlaceBet}
          autoMultiplier=""
          setAutoMultiplier={() => {}}
        />
      </div>
    );
  };

  return (
    <div>
      
      <div>
        <div className="w-full lg:w-3/4 lg:mr-auto">
          <div className="flex mb-1 overflow-hidden rounded-lg">
            <button 
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-[10px] uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg ${
                activeTab === 'manual' 
                  ? 'bg-purple-700 text-white' 
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              Manual Bet
            </button>
            <button 
              onClick={() => setActiveTab('auto')}
              className={`flex-1 py-2 text-[10px] uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg ${
                activeTab === 'auto' 
                  ? 'bg-purple-700 text-white' 
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              Auto Bet
            </button>
          </div>

          {activeTab === 'manual' ? <ManualBetTab /> : <AutoBetTab />}
        </div>
      </div>
    </div>
  );
}