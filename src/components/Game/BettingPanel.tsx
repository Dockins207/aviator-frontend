import React, { useState, useEffect } from 'react';
import betService, { BetRecord } from '@/services/betService';
import { toast } from 'react-hot-toast';
import { 
  BetDetails, 
  BetPlacementResponse, 
} from '@/services/betService';
import { getToken } from '@/utils/authUtils';

interface BettingControlsProps {
  balance?: number | null;
}

const useNumericInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Regex to allow only numbers and up to 2 decimal places
    const numericRegex = /^\d*\.?\d{0,2}$/;
    
    if (inputValue === '' || numericRegex.test(inputValue)) {
      // Prevent leading zeros
      const sanitizedValue = inputValue.replace(/^0+/, '') || '0';
      
      setValue(sanitizedValue);
    }
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
  const [currentBets, setCurrentBets] = useState<BetRecord[]>([]);

  // Fetch current bets when component mounts - with safety mechanism
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    
    const fetchCurrentBets = async () => {
      try {
        // Use a flag to detect recursion
        if ((window as any).fetchingBets) {
          console.warn('Already fetching bets, aborting duplicate call');
          return;
        }
        
        (window as any).fetchingBets = true;
        console.log('Fetching current bets...');
        
        // Add timeout to prevent hanging requests
        const timeoutPromise = new Promise<[]>((_, reject) => {
          setTimeout(() => reject(new Error('Fetch bets timed out')), 5000);
        });
        
        // Race the actual request against the timeout
        const bets = await Promise.race([
          betService.getCurrentBets(),
          timeoutPromise
        ]);
        
        if (isMounted) {
          console.log('Current bets loaded:', bets);
          setCurrentBets(bets || []);
        }
      } catch (error) {
        console.error('Failed to fetch current bets:', error);
        if (isMounted) {
          // Silently fail - don't show error toast to avoid UI disruption
          setCurrentBets([]);
        }
      } finally {
        (window as any).fetchingBets = false;
      }
    };

    fetchCurrentBets();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []); // Empty dependency array - only run once on mount

  // Robust type conversion and default value
  const safeBalance = Number(initialBalance || 0);

  const BetSection: React.FC<{
    section: 'first' | 'second';
    balance: number;
    onPlaceBet: (amount: number, section: 'first' | 'second', autoMode: boolean, autoMultiplier: string) => void;
  }> = ({
    section,
    balance,
  }) => {
    // Independent state for each section
    const { value, setValue, handleChange } = useNumericInput('0');
    const [isCashoutAvailable, setIsCashoutAvailable] = useState(false);
    const [betAmount, setBetAmount] = useState(0);
    const [autoMode, setAutoMode] = useState(false);
    const [autoMultiplier, setAutoMultiplier] = useState('');
    const [currentBetId, setCurrentBetId] = useState<string | null>(null);
    const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
    const [hasActiveBet, setHasActiveBet] = useState(false);
    const [autoCashoutSet, setAutoCashoutSet] = useState(false);
    const [isProcessingBet, setIsProcessingBet] = useState(false);
    const [gameState, setGameState] = useState<'waiting' | 'inProgress' | 'crashed'>('waiting');
    const [cashoutToken, setCashoutToken] = useState<string | null>(null);

    // Add debug state to track the bet flow
    const [debugInfo, setDebugInfo] = useState<{
      lastBetTime?: number,
      lastBetAmount?: number,
      betResponseReceived?: boolean,
      errors?: string[]
    }>({});

    // Local reset function defined first to avoid initialization issues
    const localResetBettingState = () => {
      setIsCashoutAvailable(false);
      setBetAmount(0);
      setValue('');
      setCurrentBetId(null);
      setCurrentMultiplier(1);
      setHasActiveBet(false);
      setIsProcessingBet(false);
      setCashoutToken(null); 
      // Don't reset game state here as it should come from the server
    };

    // Enhance the handleCashout function with more robust error handling and debug info
    const handleCashout = async () => {
      console.log(`⚡ Cashout attempt with betId: ${currentBetId || 'NONE'}`);
      
      // Track when the last cashout attempt was made
      const attemptTime = Date.now();
      setDebugInfo(prev => ({
        ...prev,
        lastCashoutAttempt: attemptTime
      }));
      
      // If no currentBetId, try to get the most recent bet from bet service
      if (!currentBetId) {
        const mostRecentBet = betService.getCurrentBet();
        if (mostRecentBet?.betId) {
          console.log(`Found most recent bet ID: ${mostRecentBet.betId}`);
          setCurrentBetId(mostRecentBet.betId);
          setHasActiveBet(true);
          
          // Try cashout with this bet
          try {
            const response = await betService.unifiedCashout(mostRecentBet.betId, currentMultiplier);
            
            if (response.success) {
              toast.success(`Cashed out successfully!`);
              localResetBettingState();
            } else {
              toast.error(response.message || 'Cashout failed');
            }
          } catch (error) {
            console.error('Cashout error with recovered betId:', error);
            toast.error(error instanceof Error ? error.message : 'Error during cashout');
          }
          return;
        }
        
        console.error("⚠️ CASHOUT ATTEMPTED - NO BET REFERENCE ID AVAILABLE");
        toast.error('No active bet found. Please place a bet first.');
        return;
      }
      
      try {
        console.log(`Attempting to cashout bet with ID: ${currentBetId}`);
        
        // Let the backend handle validation - simplified approach
        const response = await betService.unifiedCashout(currentBetId, currentMultiplier);
        
        if (response.success) {
          toast.success(`Cashed out successfully!`);
          localResetBettingState();
        } else {
          // Check for specific reference ID errors
          if (response.error?.includes('reference') || response.message?.includes('reference')) {
            console.error(`⚠️ CASHOUT FAILED - REFERENCE ID NOT AVAILABLE: ${currentBetId}`);
            toast.error(`Invalid bet reference ID: ${currentBetId}`);
          } else {
            toast.error(response.message || 'Cashout failed');
          }
        }
      } catch (error) {
        console.error('Cashout error:', error);
        
        // Log specifically for reference ID issues
        if (error instanceof Error && 
            (error.message.includes('reference') || error.message.includes('Invalid bet'))) {
          console.error(`⚠️ CASHOUT FAILED - REFERENCE ID NOT AVAILABLE: ${currentBetId}`);
          toast.error(`Invalid bet reference ID: ${currentBetId}`);
        } else {
          toast.error(error instanceof Error ? error.message : 'Error during cashout');
        }
      }
    };

    // Modify handlePlaceBet for better bet tracking
    const handlePlaceBet = async () => {
      // If in cashout state, handle cashout
      if (hasActiveBet && (isCashoutAvailable || gameState === 'inProgress')) {
        handleCashout();
        return;
      }
    
      const currentBetAmount = Number(value);
      
      // Validate bet amount
      if (currentBetAmount <= 0) {
        toast.error('Please enter a valid bet amount');
        return;
      }
    
      // IMMEDIATELY update UI state for instant feedback
      setIsProcessingBet(true);
      
      // Track the bet attempt in debug state
      setDebugInfo({
        lastBetTime: Date.now(),
        lastBetAmount: currentBetAmount,
        betResponseReceived: false,
        errors: []
      });
      
      try {
        // Place bet with auto mode settings if needed
        const betOptions: BetDetails = {
          amount: currentBetAmount,
          autoCashoutMultiplier: autoMode ? parseFloat(autoMultiplier) : undefined
        };
    
        // Initiate bet placement with improved callback handling
        betService.placeBet(betOptions)
          .then(response => {
            // Update debug info about response
            setDebugInfo(prev => ({
              ...prev,
              betResponseReceived: true,
              betResponseSuccess: response.success,
              betResponseTime: Date.now()
            }));
            
            if (response.success) {
              const betId = response.data?.betId;
              if (betId) {
                console.log(`✅ Bet placed successfully: ${betId}`);
                // Update all relevant state variables
                setCurrentBetId(betId);
                setHasActiveBet(true);
                setBetAmount(currentBetAmount);
                setIsProcessingBet(false);
                
                // Notify user
                toast.success('Bet placed successfully');
                
                // IMPORTANT: Since we're enabling cashout right away for testing
                // This would normally be controlled by the game state/server
                setIsCashoutAvailable(true);
              } else {
                console.error("⚠️ Bet response success but no betId returned");
                toast.error('Server error: No bet ID returned');
                localResetBettingState();
              }
            } else {
              console.error("❌ Bet placement failed:", response.message);
              toast.error(response.message || 'Failed to place bet');
              localResetBettingState();
            }
          })
          .catch(error => {
            console.error('❌ Bet placement error:', error);
            
            // Update debug info
            setDebugInfo(prev => ({
              ...prev,
              betResponseReceived: true,
              errors: [...(prev.errors || []), error.message || 'Unknown error']
            }));
            
            toast.error(error.message || 'Failed to place bet');
            localResetBettingState();
          });
      } catch (error) {
        console.error('❌ Immediate bet error:', error);
        localResetBettingState();
      }
    };

    // Force enable cashout for debugging - uncomment to test cashout functionality
    useEffect(() => {
      if (hasActiveBet) {
        console.log(`DEBUG: Force-checking cashout availability for bet ${currentBetId}`);
        // Force cashout to be available after 5 seconds for testing
        const debugTimer = setTimeout(() => {
          console.log(`DEBUG: Force-enabling cashout for active bet ${currentBetId}`);
          setIsCashoutAvailable(true);
        }, 5000);
        
        return () => clearTimeout(debugTimer);
      }
    }, [hasActiveBet, currentBetId]);

    // Socket event handlers specific to this section
    useEffect(() => {
      console.log(`Setting up socket event handlers for section ${section}, currentBetId: ${currentBetId}`);

      const socketInstance = betService.getSocketInstance();
      
      const handleGameStateChange = (state: string) => {
        console.log(`🎮 Game state changed to ${state} for section ${section}`);
        setGameState(state as 'waiting' | 'inProgress' | 'crashed');
        
        // Enable cashout during in-progress state
        if (state === 'inProgress' && hasActiveBet) {
          console.log(`✅ Auto-enabling cashout for bet ${currentBetId} because game is in progress`);
          setIsCashoutAvailable(true);
          
          toast.success('Cashout available (game in progress)', {
            position: 'bottom-right',
            duration: 2000
          });
        }
        
        // Reset betting state when game ends or returns to waiting
        if (state === 'crashed' || state === 'waiting') {
          console.log(`🔄 Resetting betting state for section ${section} because game ${state}`);
          localResetBettingState();
        }
      };

      // Direct cashout activation handler with enhanced debugging
      const handleActivateCashout = (data: { token: string; betId: string }) => {
        console.log(`🔔 Socket CASHOUT ACTIVATION received:`, data);
        
        // Check if this activation is for our current bet
        if (currentBetId === data.betId) {
          console.log(`✅ ACTIVATING CASHOUT for bet ${data.betId}`);
          setCashoutToken(data.token);
          setIsCashoutAvailable(true);
          
          toast.success('Cashout available!', {
            position: 'top-right',
            duration: 3000,
            style: { background: 'orange', color: 'white' }
          });
          
          // Debug: Try to trigger button highlight with CSS animation
          try {
            const cashoutBtn = document.querySelector(`[data-section="${section}"] .cashout-btn`);
            if (cashoutBtn) {
              cashoutBtn.classList.add('pulse-animation');
            }
          } catch (e) {
            console.error('Failed to add animation class:', e);
          }
        } else {
          console.log(`❌ Cashout activation received for bet ${data.betId} but current bet is ${currentBetId}`);
        }
      };

      // Listen for custom event from window
      const handleCustomCashoutActivation = (event: any) => {
        console.log(`🔔 Custom CASHOUT ACTIVATION event received:`, event.detail);
        const { token, betId } = event.detail;
        
        // Check if this activation is for our current bet
        if (currentBetId === betId) {
          console.log(`✅ ACTIVATING CASHOUT via custom event for bet ${betId}`);
          setCashoutToken(token);
          setIsCashoutAvailable(true);
          
          toast.success('Cashout available (custom event)!', {
            position: 'top-right',
            duration: 3000,
            style: { background: 'orange', color: 'white' }
          });
        }
      };

      // Set up all socket event listeners with more explicit logging
      console.log(`📌 Adding socket event listeners for section ${section}`);
      socketInstance.on('gameStateChange', handleGameStateChange);
      socketInstance.on('activateCashout', handleActivateCashout);
      
      // Also listen for the custom event
      if (typeof window !== 'undefined') {
        window.addEventListener('cashoutActivated', handleCustomCashoutActivation);
      }
      
      // Log socket connection status every 5 seconds
      const connectionChecker = setInterval(() => {
        const isConnected = socketInstance.connected;
        console.log(`Socket connection status: ${isConnected ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}`);
        
        // If we have an active bet but socket isn't connected, try to reconnect
        if (!isConnected && hasActiveBet) {
          console.log('Socket disconnected but we have active bets - attempting to reconnect');
          betService.connectSocketAfterLogin();
        }
      }, 5000);

      // Cleanup function
      return () => {
        console.log(`📌 Removing socket event listeners for section ${section}`);
        socketInstance.off('gameStateChange', handleGameStateChange);
        socketInstance.off('activateCashout', handleActivateCashout);
        
        if (typeof window !== 'undefined') {
          window.removeEventListener('cashoutActivated', handleCustomCashoutActivation);
        }
        
        clearInterval(connectionChecker);
      };
    }, [section, currentBetId, hasActiveBet]); // Only important dependencies

    // Add clear debugging for button states
    useEffect(() => {
      if (hasActiveBet) {
        console.log(`🎮 Current game state: ${gameState}`);
        console.log(`💰 Current bet status:`, {
          id: currentBetId,
          amount: betAmount,
          canCashout: isCashoutAvailable,
          gameInProgress: gameState === 'inProgress',
          buttonEnabled: hasActiveBet && (isCashoutAvailable || gameState === 'inProgress')
        });
      }
    }, [hasActiveBet, isCashoutAvailable, gameState, currentBetId, betAmount]);

    // Safely check for existing bets when component mounts
    useEffect(() => {
      let isMounted = true;
      
      const checkForExistingBets = async () => {
        try {
          // Instead of making an API call, use the already fetched bets
          const existingBet = currentBets[section === 'first' ? 0 : 1];
          
          if (existingBet && isMounted) {
            console.log(`Found existing bet for ${section}:`, existingBet);
            setCurrentBetId(existingBet.id);
            setBetAmount(existingBet.amount);
            setHasActiveBet(true);
            
            // If auto cashout was set
            if (existingBet.auto_cashout_multiplier) {
              setAutoMode(true);
              setAutoMultiplier(existingBet.auto_cashout_multiplier.toString());
              setAutoCashoutSet(true);
            }
          }
        } catch (error) {
          console.error('Error processing existing bets:', error);
        }
      };
      
      // Only run if we have current bets data
      if (currentBets && currentBets.length > 0) {
        checkForExistingBets();
      }
      
      return () => {
        isMounted = false;
      };
    }, [currentBets, section]); // Only depend on currentBets and section

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

    return (
      <div className="flex flex-col space-y-2" data-section={section}>
        <h2 className="text-gray-400 text-[10px] -mt-1 mb-1">{section === 'first' ? 'First Bet' : 'Second Bet'}</h2>
        
        <div className="grid grid-cols-[auto_1fr_auto] items-center space-x-2 mb-1">
          <button
            onClick={() => {
              const currentValue = Number(value);
              const halfValue = Math.max(0, currentValue / 2);
              setValue(halfValue.toString());
            }}
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
            onClick={() => {
              const currentValue = Number(value);
              const doubledValue = currentValue * 2;
              setValue(doubledValue.toString());
            }}
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

        <div className="flex space-x-2">
          {/* Cashout Button - add classname for targeting and always make clickable */}
          <button
            onClick={handleCashout}
            className={`cashout-btn w-1/2 py-2 max-sm:py-6 sm:py-4 rounded-lg transition-colors duration-300 text-[20px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg
              ${hasActiveBet 
                ? 'bg-orange-500 hover:bg-orange-600' 
                : 'bg-yellow-600 hover:bg-yellow-700'} 
              text-white flex items-center justify-center`}
          >
            <span className="flex items-center">
              CASHOUT {currentMultiplier.toFixed(2)}x
              {hasActiveBet && 
                <span className="ml-1 h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
              }
            </span>
          </button>
          
          {/* Bet Button */}
          <button
            onClick={handlePlaceBet}
            disabled={hasActiveBet && gameState !== 'inProgress'}
            className={`w-1/2 py-2 max-sm:py-6 sm:py-4 rounded-lg transition-colors duration-300 text-[20px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg ${
              hasActiveBet
                ? 'bg-gray-500 cursor-not-allowed opacity-50'
                : autoMode
                  ? 'bg-orange-500 hover:bg-orange-600' // Auto mode (orange)
                  : 'bg-green-500 hover:bg-green-600' // Default bet state (green)
            } text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
          >
            {autoMode
              ? 'BET AUTO'
              : `BET ${Number(value) > 0 ? Number(value).toLocaleString() : ''}`
            }
          </button>
        </div>
      </div>
    );
  };

  const placeBet = (
    numericValue: number, 
    section: 'first' | 'second', 
    autoMode: boolean = false, 
    autoMultiplier: string = ''
  ) => {
    // Placeholder for future implementation if needed
  };

  const handleTabChange = (tab: 'manual' | 'auto') => {
    setActiveTab(tab);
    localStorage.setItem('aviatorBetMode', tab);
  };

  const ManualBetTab: React.FC = () => {
    return (
      <div className="grid grid-cols-2 gap-1 mt-1 sm:grid-cols-2 max-w-full">
        <BetSection 
          section="first"
          balance={safeBalance}
          onPlaceBet={placeBet}
        />
        <BetSection 
          section="second"
          balance={safeBalance}
          onPlaceBet={placeBet}
        />
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
                        
                        // If a multiplier action is selected, calculate the adjusted value
                        const multiplier = parseFloat(e) || 0;
                        const baseValue = parseFloat(baseBet) || 0;
                        const adjustedValue = (baseValue * multiplier).toFixed(2);
                        setWinMultiplier(e); // Store the multiplier input as-is
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
                        
                        // If a multiplier action is selected, store the value directly
                        setLoseMultiplier(e);
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