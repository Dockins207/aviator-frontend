"use client";

import React, { useState, useEffect } from 'react';
import { useGameStats } from '../../hooks/useGameStats';
import wagerSocketService, { WagerData } from '../../services/wagerSocketService';
import { formatCurrency } from '../../utils/displayUtils';
import UserAvatar from '../common/UserAvatar';

const Section1: React.FC<{ 
  additionalTabs?: { 
    id: string; 
    label: string; 
    content: React.ReactNode 
  }[] 
}> = ({ additionalTabs = [] }) => {
  const defaultTabs = [
    { id: 'liveBets', label: 'Live Bets' },
    { id: 'myBets', label: 'My Bets' },
    { id: 'top', label: 'Top' }
  ];

  const combinedTabs = [...defaultTabs, ...additionalTabs];

  const [activeTab, setActiveTab] = useState<string>(combinedTabs[0].id);
  const [liveBets, setLiveBets] = useState<WagerData[]>([]);

  // Use the game stats hook
  const { gameStats } = useGameStats(
    process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'localhost:8000'
  );

  useEffect(() => {
    // Retrieve token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found');
      return;
    }

    // Observer for live bets updates
    const handleLiveBetsUpdate = (updatedBets: WagerData[]) => {
      setLiveBets(updatedBets);
    };

    // Connect to wager socket service
    const connectSocket = async () => {
      try {
        await wagerSocketService.connect(token);
        
        // Register live bets observer
        wagerSocketService.registerLiveBetsObserver(handleLiveBetsUpdate);
        
        // Fetch initial live bets
        await wagerSocketService.fetchLiveBets();

        // Set up periodic refresh (optional, as the observer will handle updates)
        const intervalId = setInterval(async () => {
          try {
            await wagerSocketService.fetchLiveBets();
          } catch (error) {
            console.error('Error refreshing live bets:', error);
          }
        }, 5000);

        // Cleanup function
        return () => {
          clearInterval(intervalId);
          wagerSocketService.unregisterLiveBetsObserver(handleLiveBetsUpdate);
          wagerSocketService.disconnect();
        };
      } catch (error) {
        console.error('Socket connection failed:', error);
      }
    };

    const cleanupFunction = connectSocket();

    // Cleanup on component unmount
    return () => {
      cleanupFunction.then(cleanup => cleanup && cleanup());
    };
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'liveBets':
        return (
          <div className="p-2">
            <div className="text-[10px] text-center mb-2 text-white font-bold">
              Online Players: {gameStats.onlineUsers} | Total bets: {gameStats.totalBetsCount}
            </div>
            
            <div className="text-[10px] text-center mb-2 text-white font-bold">
              Total Bet Amount: KSH {gameStats.totalBetAmount.toLocaleString()}
            </div>

            {/* Header Row */}
            <div className="grid grid-cols-4 text-[10px] font-semibold text-white/70 mb-2 px-2">
              <span>User</span>
              <span>Bet Ksh</span>
              <span>X</span>
              <span>Cash Out</span>
            </div>

            {/* Bets List */}
            <div className="space-y-1">
              {liveBets.map((bet, index) => (
                <div 
                  key={index} 
                  className="grid grid-cols-4 text-[10px] text-white/80 px-2 py-1 
                    hover:bg-white/10 transition-colors duration-200 
                    rounded-lg items-center"
                >
                  <div className="flex items-center space-x-2">
                    <UserAvatar 
                      username={bet.username || bet.userId} 
                      size="xs" 
                      hideIfEmpty={false}
                    />
                  </div>
                  <span>{formatCurrency(bet.betAmount)}</span>
                  <span>{bet.cashoutPoint || '-'}x</span>
                  <span>
                    {bet.status === 'completed' 
                      ? formatCurrency(Number(bet.cashoutAmount || 0))
                      : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'myBets':
        return (
          <div className="p-2 min-h-[400px] flex items-center justify-center">
            <div className="text-[10px] text-center text-white/70">
              No bets yet
            </div>
          </div>
        );
      case 'top':
        return (
          <div className="p-2 min-h-[400px] flex items-center justify-center">
            <div className="text-[10px] text-center text-white/70">
              Top players coming soon
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg p-2 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900">
      <div className="flex flex-col">
        {/* Tabs Container */}
        <div className="flex mb-2">
          {combinedTabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-2 text-[10px] transition-colors duration-200 ${
                activeTab === tab.id 
                  ? 'font-bold rounded-full bg-gradient-to-r from-blue-900 from-10% via-purple-900 via-30% to-red-700 to-70% text-white' 
                  : 'hover:bg-secondary/20 rounded-full bg-gradient-to-r from-blue-900/30 from-10% via-purple-900/30 via-30% to-red-700/30 to-70%'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Section1;