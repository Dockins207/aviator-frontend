import React, { useState, useEffect } from 'react';
import wagerSocketService, { WagerData } from '../../services/wagerSocketService';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/displayUtils';
import UserAvatar from '../common/UserAvatar';

const WagerComponent: React.FC = () => {
  const [liveBets, setLiveBets] = useState<WagerData[]>([]);
  const [activeWagers, setActiveWagers] = useState<WagerData[]>([]);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [currentGameId, setCurrentGameId] = useState<string>('');

  useEffect(() => {
    // Retrieve token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('No authentication token found');
      return;
    }

    // Handle game crash event
    const handleGameCrash = () => {
      console.log('Game Crashed - Clearing Active Wagers');
      setActiveWagers([]);
      setBetAmount(0);
      setCurrentGameId('');
    };

    const connectAndSetupListeners = async () => {
      try {
        // Connect to socket
        await wagerSocketService.connect(token);

        // Add event listener for game crash
        window.addEventListener('game_crashed', handleGameCrash);

        // Fetch initial live bets
        const initialBets = await wagerSocketService.getLiveBets();
        setLiveBets(initialBets);

      } catch (error) {
        toast.error('Failed to connect to wager socket');
        console.error('Socket connection failed:', error);
      }
    };

    connectAndSetupListeners();

    // Cleanup on unmount
    return () => {
      window.removeEventListener('game_crashed', handleGameCrash);
      wagerSocketService.disconnect();
    };
  }, []);

  const placeBet = async () => {
    if (betAmount <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    try {
      await wagerSocketService.placeBet(currentGameId, betAmount);
      toast.success('Bet placed successfully');
      setBetAmount(0);
      
      // Optionally update active wagers or live bets
    } catch (error) {
      toast.error('Bet placement failed');
      console.error('Bet placement error:', error);
    }
  };

  const cashoutWager = async (wager: WagerData) => {
    if (!wager.id || !wager.currentMultiplier) {
      toast.error('Invalid wager for cashout');
      return;
    }

    try {
      await wagerSocketService.cashoutBet(
        wager.id, 
        wager.currentMultiplier, 
        wager.currentMultiplier
      );
      toast.success('Wager cashed out successfully');
      
      // Remove wager from active wagers
      setActiveWagers(prev => 
        prev.filter(w => w.id !== wager.id)
      );
    } catch (error) {
      toast.error('Cashout failed');
      console.error('Cashout error:', error);
    }
  };

  return (
    <div className="wager-component bg-gray-800 text-white p-4 rounded-lg">
      {/* Live Bets Section */}
      <div className="live-bets mb-4">
        <h3 className="text-lg font-bold mb-2">Live Bets</h3>
        <ul className="space-y-2">
          {liveBets.map((bet, index) => {
            console.log('Bet Debug:', {
              username: bet.username,
              keys: Object.keys(bet)
            });
            return (
            <li 
              key={index} 
              className="flex justify-between bg-gray-700 p-2 rounded items-center"
            >
              <div className="flex items-center space-x-2">
                <UserAvatar 
                  username={bet.username} 
                  size="sm" 
                  hideIfEmpty={false}
                />
              </div>
              <span>{formatCurrency(bet.betAmount)}</span>
            </li>
          )})}
        </ul>
      </div>

      {/* Bet Placement Form */}
      <div className="place-bet-form mb-4">
        <input 
          type="number" 
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          placeholder="Bet Amount" 
          className="w-full p-2 bg-gray-700 rounded mb-2"
        />
        <button 
          onClick={placeBet}
          className="w-full bg-green-600 hover:bg-green-700 p-2 rounded"
        >
          Place Bet
        </button>
      </div>

      {/* Active Wagers Section */}
      <div className="active-wagers">
        <h3 className="text-lg font-bold mb-2">Your Active Wagers</h3>
        <ul className="space-y-2">
          {activeWagers.map((wager, index) => (
            <li 
              key={index} 
              className="flex justify-between bg-gray-700 p-2 rounded"
            >
              <span>Bet: KSH {wager.betAmount.toLocaleString()}</span>
              <button 
                onClick={() => cashoutWager(wager)}
                className="bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded text-sm"
              >
                Cashout
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WagerComponent;
