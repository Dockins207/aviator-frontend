"use client";

import React, { useState } from 'react';
import { useGameStats } from '../../services/gameStatsService';

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

  // Use the game stats hook
  const { stats } = useGameStats({
    url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'localhost:8000',
    debug: true
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'liveBets':
        return (
          <div className="p-2">
            <div className="text-[10px] text-center mb-2 text-white/70">
              Online Players: {stats.onlineUsers} | Total bets: {stats.totalBets > 0 ? stats.onlineUsers : 0}
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
              {/* No dummy data */}
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