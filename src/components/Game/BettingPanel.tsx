import React, { useState, useEffect, useCallback } from 'react';
import betService from '@/services/betService';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';

// Types for bet response
interface BetResponse {
  success: boolean;
  message?: string;
  data?: {
    betId?: number;
    [key: string]: any;
  };
}

interface BettingControlsProps {
  balance?: number | null;
}

const useNumericInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setValue(inputValue);
  };

  return { value, setValue, handleChange };
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Regex to allow only numbers and up to 2 decimal places
    const numericRegex = /^\d*\.?\d{0,2}$/;
    
    if (inputValue === '' || numericRegex.test(inputValue)) {
      // Prevent leading zeros
      const sanitizedValue = inputValue.replace(/^0+/, '') || '0';
      
      onChange(sanitizedValue);
    }
  };

  const handleBlur = () => {
    let numValue = parseFloat(value);
    
    // Ensure value is within min and max
    numValue = Math.max(min, Math.min(max, numValue));
    
    // Format to 2 decimal places
    onChange(numValue.toFixed(2));
  };

  return (
    <div className="flex flex-col">
      {label && <label className="text-gray-400 text-[10px] mb-1">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full bg-white text-black text-center py-2 text-[10px] rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
    </div>
  );
};

const BettingPanel: React.FC<BettingControlsProps> = ({ 
  balance: initialBalance 
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Robust type conversion and default value
  const safeBalance = Number(initialBalance || 0);

  const BetSection: React.FC<{
    section: 'first' | 'second';
    balance: number;
    isPlaying: boolean;
    onPlaceBet: (amount: number, section: 'first' | 'second', autoMode: boolean, autoMultiplier: string) => void;
  }> = ({
    section,
    balance,
    isPlaying,
    onPlaceBet
  }) => {
    // Independent state for each section
    const { value, setValue } = useNumericInput();
    const [isCashout, setIsCashout] = useState(false);
    const [betAmount, setBetAmount] = useState(0);
    const [autoMode, setAutoMode] = useState(false);
    const [autoMultiplier, setAutoMultiplier] = useState('');
    const [currentBetId, setCurrentBetId] = useState<number | null>(null);
    const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
    const [hasActiveBet, setHasActiveBet] = useState(false);
    const [autoCashoutSet, setAutoCashoutSet] = useState(false);
    const [isProcessingBet, setIsProcessingBet] = useState(false);
    const [gameState, setGameState] = useState<'waiting' | 'inProgress' | 'crashed'>('waiting');
    const [cashoutToken, setCashoutToken] = useState<string | null>(null);

    // Local reset function for this specific section
    const localResetBettingState = useCallback(() => {
      setIsCashout(false);
      setBetAmount(0);
      setValue('');
      setCurrentBetId(null);
      setCurrentMultiplier(1);
      setHasActiveBet(false);
      setIsProcessingBet(false);
      setGameState('waiting');
      setCashoutToken(null);
      // Don't reset autoMode and autoMultiplier as they are user preferences
    }, [setValue]);

    // Socket event handlers specific to this section
    useEffect(() => {
      const handleGameStateChange = (state: string) => {
        setGameState(state as 'waiting' | 'inProgress' | 'crashed');
        if (state === 'crashed' || state === 'waiting') {
          localResetBettingState();
        }
      };

      const handleBetSuccess = (data: any) => {
        // Only handle events for this section's bet
        if (data.betDetails?.section === section) {
          if (data.betDetails?.bet_id) {
            setCurrentBetId(data.betDetails.bet_id);
            setHasActiveBet(true);
            setIsProcessingBet(true);
            
            if (autoMode && autoMultiplier) {
              setAutoCashoutSet(true);
            }
          }
        }
      };

      const handleBetError = (error: { message: string }) => {
        // Only reset this section if it's processing a bet
        if (isProcessingBet) {
          console.error('Bet Error:', error);
          toast.error(error.message || 'Bet placement failed');
          setIsProcessingBet(false);
        }
      };

      const handleMultiplierUpdate = (multiplier: number) => {
        if (hasActiveBet) {
          setCurrentMultiplier(multiplier);
        }
      };

      const handleActivateCashout = (data: { token: string; betId: number }) => {
        // Only handle events for this section's bet
        if (data.betId === currentBetId) {
          setCashoutToken(data.token);
          setIsCashout(true);
          toast.success('Cashout is now available!');
        }
      };

      const socketInstance = betService.getSocketInstance();
      
      socketInstance.on('gameStateChange', handleGameStateChange);
      socketInstance.on('betPlaced', handleBetSuccess);
      socketInstance.on('betError', handleBetError);
      socketInstance.on('multiplierUpdate', handleMultiplierUpdate);
      socketInstance.on('activateCashout', handleActivateCashout);

      return () => {
        socketInstance.off('gameStateChange', handleGameStateChange);
        socketInstance.off('betPlaced', handleBetSuccess);
        socketInstance.off('betError', handleBetError);
        socketInstance.off('multiplierUpdate', handleMultiplierUpdate);
        socketInstance.off('activateCashout', handleActivateCashout);
      };
    }, [section, autoMode, autoMultiplier, currentBetId, autoCashoutSet, isProcessingBet, hasActiveBet, localResetBettingState]);

    const handleAutoMultiplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (/^\d*\.?\d*$/.test(inputValue)) {
        setAutoMultiplier(inputValue);
      }
    };

    const handleAutoMultiplierBlur = () => {
      const multiplier = parseFloat(autoMultiplier);
      if (isNaN(multiplier) || multiplier <= 1) {
        setAutoMultiplier('');
      }
    };

    const toggleAutoMode = () => {
      const currentBetAmount = Number(value);
      
      if (currentBetAmount <= 0) {
        return;
      }

      setAutoMode(prev => !prev);
      
      if (autoMode) {
        setAutoMultiplier('');
      }
    };

    const handleBetOrCashout = async () => {
      const currentBetAmount = Number(value);

      if (currentBetAmount <= 0) {
        toast.error('Please enter a valid bet amount');
        return;
      }

      try {
        // Always allow bet placement
        onPlaceBet(currentBetAmount, section, autoMode, autoMultiplier);
        setBetAmount(currentBetAmount);
        setValue('');
      } catch (error: any) {
        toast.error(error.message || 'Failed to place bet');
      }
    };

    const handleAutoCashout = async (currentMultiplier: number) => {
      if (!currentBetId) return;

      try {
        const response = await betService.cashout(currentBetId, currentMultiplier);
        
        if (response.success) {
          toast.success(`Auto-cashout successful! Won ${Math.floor(betAmount * currentMultiplier).toLocaleString()} KSH`);
          
          // Update user's balance if provided in response
          if (response.data?.newWalletBalance) {
            // Update balance through your state management system
          }
        } else {
          toast.error(response.message || 'Auto-cashout failed');
        }
      } catch (error) {
        console.error('Auto-cashout error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to auto-cashout');
      } finally {
        setHasActiveBet(false);
        setAutoCashoutSet(false);
        localResetBettingState();
      }
    };

    const adjustBetAmount = (mode: 'half' | 'double') => {
      const currentValue = Number(value);
      
      if (mode === 'half') {
        // Halve the current value, round to 2 decimal places
        const halfValue = Math.max(0, currentValue / 2);
        setValue(halfValue.toString());
      } else {
        // Double the current value
        const doubledValue = currentValue * 2;
        setValue(doubledValue.toString());
      }
    };

    const getButtonText = () => {
      if (isCashout) {
        return 'CASHOUT';
      }
      
      if (autoMode) {
        return 'BET AUTOCASHOUT';
      }
      
      return Number(value) > 0 ? `BET KSH${Number(value).toLocaleString()}` : 'BET KSH';
    };

    const isButtonDisabled = () => {
      // Always return false to ensure the button is always clickable
      return false;
    };

    const getButtonTextLocal = () => {
      if (isCashout) {
        return 'CASHOUT';
      }
      
      if (autoMode) {
        return Number(value) > 0 ? `BET AUTOCASHOUT` : 'BET AUTOCASHOUT';
      }
      
      return Number(value) > 0 ? `BET KSH${Number(value).toLocaleString()}` : 'BET KSH';
    };

    const handlePlaceBet = async () => {
      const currentBetAmount = Number(value);
      
      // If in cashout state, handle cashout
      if (isCashout) {
        try {
          if (!currentBetId) {
            toast.error('Invalid bet ID');
            return;
          }
          
          let response;
          
          // Use cashout token if available, otherwise use regular cashout
          if (cashoutToken) {
            response = await betService.cashoutWithToken(cashoutToken, currentBetId);
          } else {
            response = await betService.cashout(currentBetId, currentMultiplier);
          }
          
          if (response.success) {
            toast.success('Cashout successful!');
            localResetBettingState();
          } else {
            toast.error(response.message || 'Failed to cashout');
          }
        } catch (error: any) {
          toast.error(error.message || 'Failed to cashout');
        }
        return;
      }

      // Validate bet amount
      if (currentBetAmount <= 0) {
        toast.error('Please enter a valid bet amount');
        return;
      }

      try {
        // Place bet with auto mode settings if needed
        const response = await betService.placeBet({
          amount: currentBetAmount,
          autoCashoutMultiplier: autoMode ? parseFloat(autoMultiplier) : undefined
        });
        
        if (response.success) {
          setBetAmount(currentBetAmount);
          setHasActiveBet(true);
          
          // Only set to cashout mode if not in auto mode
          if (!autoMode) {
            setIsCashout(true);
          }
          
          setCurrentBetId(response.data?.betId || null);
          toast.success('Bet placed successfully!');
        } else {
          toast.error(response.message || 'Failed to place bet');
          localResetBettingState();
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to place bet');
        localResetBettingState();
      }
    };

    return (
      <div className="bg-slate-800 p-4 rounded-lg space-y-0.5">
        <h2 className="text-gray-400 text-[10px] -mt-1 mb-1">{section === 'first' ? 'First Bet' : 'Second Bet'}</h2>
        
        <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 mb-1">
          <button
            onClick={() => adjustBetAmount('half')}
            className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
          >
            x½
          </button>
          
          <NumericInput
            label=""
            value={value}
            onChange={setValue}
            min={0}
            max={balance}
            placeholder="Enter amount"
            className="w-full"
          />
          
          <button
            onClick={() => adjustBetAmount('double')}
            className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
          >
            x2
          </button>
        </div>

        <div className="flex flex-row justify-between gap-1.5 mb-1">
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

        <div className="flex items-center gap-4 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Auto</span>
            <button
              onClick={toggleAutoMode}
              className={`px-2 h-8 rounded text-[10px] ${
                autoMode 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-purple-900/30 hover:bg-purple-800/30'
              }`}
            >
              {autoMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {autoMode && (
            <div className="flex items-center gap-2">
              <input 
                type="text"
                value={autoMultiplier}
                onChange={handleAutoMultiplierChange}
                onBlur={handleAutoMultiplierBlur}
                placeholder="Enter auto cashout multiplier"
                className="w-full bg-white text-black text-center text-[10px] focus:outline-none py-1 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <div 
                className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded"
                title="Multiplier must be greater than 1"
              >
                x
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handlePlaceBet}
          className={`w-full py-2 max-sm:py-6 sm:py-4 rounded-lg transition-colors duration-300 text-[20px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg ${
            isCashout
              ? 'bg-orange-500 hover:bg-orange-600' // Cashout state (orange)
              : autoMode
                ? 'bg-orange-500 hover:bg-orange-600' // Auto mode (orange)
                : 'bg-green-500 hover:bg-green-600' // Default bet state (green)
          } text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
        >
          {getButtonTextLocal()}
        </button>
      </div>
    );
  };

  const placeBet = (
    numericValue: number, 
    section: 'first' | 'second', 
    autoMode: boolean = false, 
    autoMultiplier: string = ''
  ) => {
    // handlePlaceBet(numericValue, autoMode, autoMultiplier);
  };

  const AutoBetTab: React.FC = () => {
    const [baseBet, setBaseBet] = useState('');
    const [maxStake, setMaxStake] = useState('');
    const [autoCashout, setAutoCashout] = useState('');
    const [winStrategy, setWinStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [loseStrategy, setLoseStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [winMultiplier, setWinMultiplier] = useState('');
    const [winMultiplierAction, setWinMultiplierAction] = useState<'increase' | 'decrease' | 'base'>('base');
    const [loseMultiplier, setLoseMultiplier] = useState('');
    const [loseMultiplierAction, setLoseMultiplierAction] = useState<'increase' | 'decrease' | 'base'>('base');

    const adjustBaseBet = (mode: 'half' | 'double') => {
      const currentValue = Number(baseBet);
      
      if (mode === 'half') {
        // Halve the current value, round to 2 decimal places
        const halfValue = Math.max(0, currentValue / 2);
        setBaseBet(halfValue.toString());
      } else {
        // Double the current value
        const doubledValue = currentValue * 2;
        setBaseBet(doubledValue.toString());
      }
    };

    const adjustMaxStake = (mode: 'half' | 'double') => {
      const currentValue = Number(maxStake);
      
      if (mode === 'half') {
        // Halve the current value, round to 2 decimal places
        const halfValue = Math.max(0, currentValue / 2);
        setMaxStake(halfValue.toString());
      } else {
        // Double the current value
        const doubledValue = currentValue * 2;
        setMaxStake(doubledValue.toString());
      }
    };

    const adjustAutoCashout = (mode: 'half' | 'double') => {
      const currentValue = Number(autoCashout);
      
      if (mode === 'half') {
        // Halve the current value, round to 2 decimal places
        const halfValue = Math.max(0, currentValue / 2);
        setAutoCashout(halfValue.toString());
      } else {
        // Double the current value
        const doubledValue = currentValue * 2;
        setAutoCashout(doubledValue.toString());
      }
    };

    const adjustWinMultiplier = (mode: 'half' | 'double') => {
      if (winStrategy === 'increase') {
        const currentValue = Number(winMultiplier);
        
        if (mode === 'half') {
          // Halve the current value, round to 2 decimal places
          const halfValue = Math.max(0, currentValue / 2);
          setWinMultiplier(halfValue.toString());
        } else {
          // Double the current value
          const doubledValue = currentValue * 2;
          setWinMultiplier(doubledValue.toString());
        }
      }
    };

    const adjustLoseMultiplier = (mode: 'half' | 'double') => {
      if (loseStrategy === 'increase') {
        const currentValue = Number(loseMultiplier);
        
        if (mode === 'half') {
          // Halve the current value, round to 2 decimal places
          const halfValue = Math.max(0, currentValue / 2);
          setLoseMultiplier(halfValue.toString());
        } else {
          // Double the current value
          const doubledValue = currentValue * 2;
          setLoseMultiplier(doubledValue.toString());
        }
      }
    };

    const resetAutoBetSettings = () => {
      setBaseBet('');
      setMaxStake('');
      setAutoCashout('');
      setWinStrategy('baseBet');
      setLoseStrategy('baseBet');
      setWinMultiplier('');
      setLoseMultiplier('');
      setWinMultiplierAction('base');
      setLoseMultiplierAction('base');
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
          <div className="flex gap-2 justify-between">
            <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 flex-grow">
              <button
                onClick={() => adjustBaseBet('half')}
                className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
              >
                x½
              </button>
              <NumericInput
                label="Base Bet"
                value={baseBet}
                onChange={(e) => setBaseBet(e)}
                className="w-full"
                placeholder="Enter base bet"
                min={0}
                max={Infinity}
              />
              <button
                onClick={() => adjustBaseBet('double')}
                className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
              >
                x2
              </button>
            </div>
            
            <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 flex-grow">
              <button
                onClick={() => adjustMaxStake('half')}
                className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
              >
                x½
              </button>
              <NumericInput
                label="Max Stake"
                value={maxStake}
                onChange={(e) => setMaxStake(e)}
                className="w-full"
                placeholder="Enter max stake limit"
                min={0}
                max={Infinity}
              />
              <button
                onClick={() => adjustMaxStake('double')}
                className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
              >
                x2
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 w-5/6 mx-auto">
            <button
              onClick={() => adjustAutoCashout('half')}
              className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
            >
              x½
            </button>
            <NumericInput
              label="Auto Cashout"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e)}
              className="w-full"
              placeholder="Enter auto cashout multiplier"
              min={0}
              max={Infinity}
            />
            <button
              onClick={() => adjustAutoCashout('double')}
              className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
            >
              x2
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-green-400 text-[10px] mb-1">If You Win</div>
              <div className="flex rounded-lg bg-purple-900/30">
                <button 
                  onClick={() => setWinStrategy('baseBet')}
                  className={`flex-1 py-1 text-[10px] first:rounded-l-lg last:rounded-r-lg ${
                    winStrategy === 'baseBet' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50 hover:bg-purple-800/50'
                  }`}
                >
                  Base Bet
                </button>
                <button 
                  onClick={() => setWinStrategy('increase')}
                  className={`flex-1 py-1 text-[10px] first:rounded-l-lg last:rounded-r-lg ${
                    winStrategy === 'increase' 
                      ? 'bg-green-600 text-white' 
                      : 'text-white/50 hover:bg-purple-800/50'
                  }`}
                >
                  Boost Bet
                </button>
              </div>
              {winStrategy === 'increase' && (
                <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 mt-1">
                  <button
                    onClick={() => adjustWinMultiplier('half')}
                    className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
                  >
                    x½
                  </button>
                  <div className="flex items-center space-x-2 w-full">
                    <select 
                      value={winMultiplierAction}
                      onChange={(e) => setWinMultiplierAction(e.target.value as 'increase' | 'decrease' | 'base')}
                      className="bg-purple-800 text-white text-[10px] rounded px-2 py-1"
                    >
                      <option value="increase">↑ Boost Bet</option>
                      <option value="decrease">↓ Reduce Bet</option>
                      <option value="base">= Base</option>
                    </select>
                    <NumericInput
                      label="Win Multiplier"
                      value={winMultiplier}
                      onChange={(e) => {
                        // If user is typing directly, just set the value
                        if (winMultiplierAction === 'base') {
                          setWinMultiplier(e);
                          return;
                        }
                        
                        // If a multiplier action is selected, adjust the value
                        const adjustedValue = (parseFloat(baseBet) * parseFloat(e) || 1).toFixed(2);
                        setWinMultiplier(adjustedValue);
                      }}
                      className="w-full"
                      placeholder="Enter win multiplier"
                      min={0}
                      max={Infinity}
                    />
                  </div>
                  <button
                    onClick={() => adjustWinMultiplier('double')}
                    className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
                  >
                    x2
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="text-red-400 text-[10px] mb-1">If You Lose</div>
              <div className="flex rounded-lg bg-purple-900/30">
                <button 
                  onClick={() => setLoseStrategy('baseBet')}
                  className={`flex-1 py-1 text-[10px] first:rounded-l-lg last:rounded-r-lg ${
                    loseStrategy === 'baseBet' 
                      ? 'bg-purple-800 text-white' 
                      : 'text-white/50 hover:bg-purple-800/50'
                  }`}
                >
                  Base Bet
                </button>
                <button 
                  onClick={() => setLoseStrategy('increase')}
                  className={`flex-1 py-1 text-[10px] first:rounded-l-lg last:rounded-r-lg ${
                    loseStrategy === 'increase' 
                      ? 'bg-green-600 text-white' 
                      : 'text-white/50 hover:bg-purple-800/50'
                  }`}
                >
                  Boost Bet
                </button>
              </div>
              {loseStrategy === 'increase' && (
                <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 mt-1">
                  <button
                    onClick={() => adjustLoseMultiplier('half')}
                    className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
                  >
                    x½
                  </button>
                  <div className="flex items-center space-x-2 w-full">
                    <select 
                      value={loseMultiplierAction}
                      onChange={(e) => setLoseMultiplierAction(e.target.value as 'increase' | 'decrease' | 'base')}
                      className="bg-purple-800 text-white text-[10px] rounded px-2 py-1"
                    >
                      <option value="increase">↑ Boost Bet</option>
                      <option value="decrease">↓ Reduce Bet</option>
                      <option value="base">= Base</option>
                    </select>
                    <NumericInput
                      label="Lose Multiplier"
                      value={loseMultiplier}
                      onChange={(e) => {
                        // If user is typing directly, just set the value
                        if (loseMultiplierAction === 'base') {
                          setLoseMultiplier(e);
                          return;
                        }
                        
                        // If a multiplier action is selected, adjust the value
                        const adjustedValue = (parseFloat(baseBet) * parseFloat(e) || 1).toFixed(2);
                        setLoseMultiplier(adjustedValue);
                      }}
                      className="w-full"
                      placeholder="Enter lose multiplier"
                      min={0}
                      max={Infinity}
                    />
                  </div>
                  <button
                    onClick={() => adjustLoseMultiplier('double')}
                    className="bg-purple-800 text-white px-3 py-2 rounded text-[10px] flex-shrink-0"
                  >
                    x2
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={startAutoplay}
              className="flex-grow py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all duration-300"
            >
              Start Autoplay
            </button>
            <button
              onClick={resetAutoBetSettings}
              className="py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all duration-300"
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
          balance={safeBalance}
          isPlaying={false}
          onPlaceBet={placeBet}
        />
        <BetSection 
          section="second"
          balance={safeBalance}
          isPlaying={false}
          onPlaceBet={placeBet}
        />
      </div>
    );
  };

  const handleTabChange = (tab: 'manual' | 'auto') => {
    setActiveTab(tab);
    localStorage.setItem('aviatorBetMode', tab);
  };

  return (
    <div>
      
      <div>
        <div className="w-full">
          <div className="flex mb-1 overflow-hidden rounded-lg">
            <button 
              onClick={() => handleTabChange('manual')}
              className={`flex-1 py-2 text-[10px] uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg ${
                activeTab === 'manual' 
                  ? 'bg-purple-700 text-white' 
                  : 'bg-purple-900/30 text-white/50 hover:bg-purple-800/50'
              }`}
            >
              Manual Bet
            </button>
            <button 
              onClick={() => handleTabChange('auto')}
              className={`flex-1 py-2 text-[10px] uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg ${
                activeTab === 'auto' 
                  ? 'bg-purple-700 text-white' 
                  : 'bg-purple-900/30 text-white/50 hover:bg-purple-800/50'
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
};

export default BettingPanel;