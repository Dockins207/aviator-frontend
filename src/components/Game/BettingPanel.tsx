import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import gameSocketService from '@/services/gameSocketService';
import betService from '@/services/betService';  
import { BetDetails, BetResponse } from '@/types/bet';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';

interface BettingControlsProps {
  balance?: number;
  onPlaceBet?: (
    amount: number, 
    autoMode?: boolean, 
    autoMultiplier?: string
  ) => void;
  isPlaying?: boolean;
  socket?: Socket;
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
  balance: number;
  isPlaying: boolean;
  onPlaceBet: (amount: number, section: 'first' | 'second', autoMode: boolean, autoMultiplier: string) => void;
};

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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let numValue = parseFloat(value);
    
    // Ensure value is within min and max
    numValue = Math.max(min, Math.min(max, numValue));
    
    // Format to 2 decimal places
    onChange(numValue.toFixed(2));
  };

  return (
    <div className="flex flex-col">
      {label && <label className="text-[10px] text-gray-400 mb-1">{label}</label>}
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

const getStoredBetMode = (): 'manual' | 'auto' => {
  const storedMode = localStorage.getItem('aviatorBetMode');
  return storedMode === 'auto' ? 'auto' : 'manual';
};

export default function BettingPanel({
  balance,
  onPlaceBet: originalOnPlaceBet,
  isPlaying,
  socket
}: BettingControlsProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [userContext, setUserContext] = useState<{
    username?: string;
  }>({});

  // Comprehensive socket initialization
  useEffect(() => {
    let isMounted = true;
    let socketSubscription: any = null;

    const initializeSocket = async () => {
      try {
        // Verify authentication before socket initialization
        const accessToken = AuthService.getToken();
        if (!accessToken) {
          console.error('🚨 No valid authentication token');
          toast.error('Authentication required. Please log in.');
          return;
        }

        // Fetch user profile to ensure authentication context
        const userProfile = await AuthService.getProfile();
        if (!userProfile || !userProfile.username) {
          console.error('🚨 Invalid user profile', { profile: userProfile });
          toast.error('User authentication failed.');
          return;
        }

        // Update user context
        setUserContext({
          username: userProfile.username
        });

        // Prioritize provided socket, then try GameSocketService
        const socketToUse = socket || await gameSocketService.ensureConnection();
        
        if (!isMounted) return;

        // Extend socket with user context
        (socketToUse as any).user = {
          username: userProfile.username
        };

        // Set socket and mark as ready
        setCurrentSocket(socketToUse);
        
        // Initialize betting service with socket
        betService.initializeSocket(socketToUse);

        // Set up socket readiness and error handling
        socketSubscription = gameSocketService.addGameStateListener((state) => {
          setIsSocketReady(state.status !== 'waiting');
        });

        // Explicitly mark socket as ready
        setIsSocketReady(true);

        console.log('🔒 Socket Initialized with User Context', {
          socketReady: true
        });

      } catch (error) {
        console.error('🚨 Comprehensive Socket Initialization Error', {
          error,
          providedSocket: !!socket,
          timestamp: new Date().toISOString()
        });
        
        toast.error('Failed to establish authenticated socket connection.');
        setIsSocketReady(false);
        setUserContext({});
      }
    };

    initializeSocket();

    return () => {
      isMounted = false;
      if (socketSubscription) {
        gameSocketService.removeGameStateListener(socketSubscription);
      }
    };
  }, [socket]);

  const handlePlaceBet = useCallback(async (betAmount: number, autoMode: boolean = false, autoMultiplier: string = '') => {
    // Enhanced authentication and socket readiness check
    if (!userContext.username) {
      console.error('🚨 No authenticated user context', { 
        userContext,
        socketAvailable: !!currentSocket
      });
      toast.error('Authentication required. Please log in again.');
      return;
    }

    if (!currentSocket) {
      console.error('🚨 No socket available', { 
        socketAvailable: !!currentSocket,
        gameSocketStatus: gameSocketService.getGameState().status
      });
      toast.error('Socket connection lost. Reconnecting...');
      return;
    }

    if (!isSocketReady) {
      console.warn('🕒 Socket not fully initialized', {
        socketStatus: isSocketReady,
        gameState: gameSocketService.getGameState()
      });
      toast.error('Socket initializing. Please wait.');
      return;
    }

    try {
      // Validate bet amount
      if (betAmount <= 0) {
        toast.error('Invalid bet amount.');
        return;
      }

      // Create bet details with auto cashout settings
      const betDetails: BetDetails = {
        amount: betAmount,
        autoCashoutEnabled: autoMode,
        autoCashoutMultiplier: autoMode && autoMultiplier ? parseFloat(autoMultiplier) : undefined
      };

      console.log('📡 Bet Placement Attempt', {
        ...betDetails,
        socketReady: isSocketReady
      });

      const placedBet = await betService.placeBet(betDetails);
      
      // Show success message
      toast.success('Bet placed successfully!');
      
      // Call original callback if provided
      originalOnPlaceBet?.(betAmount, autoMode, autoMultiplier);

    } catch (error) {
      console.error('🚨 Bet Placement Error', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        betDetails: {
          betAmount,
          autoMode,
          autoMultiplier
        },
        socketStatus: {
          isSocketReady,
          socketAvailable: !!currentSocket
        },
        userContext: {
          username: userContext.username,
          authenticated: !!userContext.username
        },
        timestamp: new Date().toISOString()
      });
      
      toast.error(`${error instanceof Error ? error.message : 'Failed to place bet'}`);
      
      // Attempt to reconnect socket if needed
      if (!isSocketReady || !currentSocket) {
        try {
          await gameSocketService.reconnectSocket();
        } catch (reconnectionError) {
          console.error('Socket reconnection failed', reconnectionError);
          toast.error('Could not restore socket connection. Please refresh the page.');
        }
      }
    }
  }, [currentSocket, isSocketReady, originalOnPlaceBet, userContext]);

  const BetSection: React.FC<BetSectionProps> = ({
    section,
    balance,
    isPlaying,
    onPlaceBet,
  }) => {
    const { value, setValue } = useNumericInput();
    const [isCashout, setIsCashout] = useState(false);
    const [betAmount, setBetAmount] = useState(0);
    const [autoMode, setAutoMode] = useState(false);
    const [autoMultiplier, setAutoMultiplier] = useState('');

    useEffect(() => {
      setBetAmount(Number(value) || 0);
    }, [value]);

    const handleAutoMultiplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (/^\d*\.?\d*$/.test(inputValue)) {
        setAutoMultiplier(inputValue);
      }
    };

    const handleAutoMultiplierBlur = () => {
      const multiplier = parseFloat(autoMultiplier);
      if (isNaN(multiplier) || multiplier <= 1) {
        toast.error('Auto cashout multiplier must be greater than 1.0');
        setAutoMultiplier('');
      }
    };

    const toggleAutoMode = () => {
      const currentBetAmount = Number(value);
      
      if (currentBetAmount <= 0) {
        toast.error('Please enter a bet amount before turning on auto mode');
        return;
      }

      setAutoMode(prev => !prev);
      
      if (autoMode) {
        setAutoMultiplier('');
      }
    };

    const handleBetOrCashout = () => {
      console.log('Button State Debug:', JSON.stringify({
        value: value,
        betAmount: betAmount,
        isCashout: isCashout,
        autoMode: autoMode
      }));

      // Reset function to clear all betting states
      const resetBettingState = () => {
        setIsCashout(false);
        setBetAmount(0);
        setValue('');
      };

      // Cashout logic
      if (isCashout) {
        const cashoutAmount = betAmount;
        
        // Successful cashout
        toast.success(`Successfully cashed out KSH ${Math.floor(betAmount).toLocaleString()}`, {
          position: 'top-right',
          duration: 2000
        });

        // Reset states after cashout
        resetBettingState();
        return;
      }

      // Normal bet placement
      const currentBetAmount = Number(value);

      if (currentBetAmount <= 0) {
        toast.error('Please enter a valid bet amount');
        return;
      }

      if (autoMode && (!autoMultiplier || parseFloat(autoMultiplier) <= 1)) {
        toast.error('Please enter a valid auto cashout multiplier greater than 1.0');
        return;
      }

      // Place bet with auto mode settings
      onPlaceBet(currentBetAmount, section, autoMode, autoMultiplier);
      setBetAmount(currentBetAmount);
      setValue('');

      // Set cashout state if game is flying
      setIsCashout(true);
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
          type="button"
          onClick={handleBetOrCashout}
          disabled={isPlaying && Number(value) > balance}
          className={`w-full py-2 max-sm:py-6 sm:py-4 rounded-lg transition-colors duration-300 text-[20px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg ${
            isCashout 
              ? 'bg-orange-500 hover:bg-orange-600' 
              : (autoMode
                  ? 'bg-orange-500 hover:bg-orange-600'  
                  : (Number(value) > 0 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-green-600/50')
                )
          } text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
        >
          {isCashout 
            ? `Cashout KSH ${Math.floor(betAmount).toLocaleString()}` 
            : (autoMode
                ? 'BET AUTOCASHOUT'  
                : (Number(value) > 0 
                    ? `Bet KSH ${Number(value).toLocaleString()}` 
                    : 'Bet')
              )
          }
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
    // Ignore section parameter for now
    handlePlaceBet(numericValue, autoMode, autoMultiplier);
  };

  type MultiplierAction = 'increase' | 'decrease' | 'base';

  const adjustMultiplier = (
    baseValue: string,
    action: MultiplierAction,
    multiplier: number
  ): string => {
    const value = parseFloat(baseValue);
    if (isNaN(value) || isNaN(multiplier)) return baseValue;
    
    switch (action) {
      case 'increase':
        return (value * multiplier).toFixed(2);
      case 'decrease':
        return (value / multiplier).toFixed(2);
      case 'base':
      default:
        return baseValue;
    }
  };

  const AutoBetTab: React.FC = () => {
    const [baseBet, setBaseBet] = useState('');
    const [maxStake, setMaxStake] = useState('');
    const [autoCashout, setAutoCashout] = useState('');
    const [winStrategy, setWinStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [loseStrategy, setLoseStrategy] = useState<'baseBet' | 'increase'>('baseBet');
    const [winMultiplier, setWinMultiplier] = useState('');
    const [winMultiplierAction, setWinMultiplierAction] = useState<MultiplierAction>('base');
    const [loseMultiplier, setLoseMultiplier] = useState('');
    const [loseMultiplierAction, setLoseMultiplierAction] = useState<MultiplierAction>('base');

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
                      onChange={(e) => setWinMultiplierAction(e.target.value as MultiplierAction)}
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
                        const adjustedValue = adjustMultiplier(
                          baseBet, 
                          winMultiplierAction, 
                          parseFloat(e) || 1
                        );
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
                      onChange={(e) => setLoseMultiplierAction(e.target.value as MultiplierAction)}
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
                        const adjustedValue = adjustMultiplier(
                          baseBet, 
                          loseMultiplierAction, 
                          parseFloat(e) || 1
                        );
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
          balance={balance ?? 0}
          isPlaying={isPlaying ?? false}
          onPlaceBet={placeBet}
        />
        <BetSection 
          section="second"
          balance={balance ?? 0}
          isPlaying={isPlaying ?? false}
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
}