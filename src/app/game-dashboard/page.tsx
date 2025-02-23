"use client";

import React from 'react';
import GameDashboardHeader from '@/components/Game/GameDashboardHeader';
import GameBoard from '@/components/Game/GameBoard';
import BettingPanel from '@/components/Game/BettingPanel';
import GameData from '@/components/Game/GameData';
import AdvertisementCarousel from '@/components/Advertisement';
import WithdrawalBroadcast from '@/components/Game/WithdrawalBroadcast';
import GameStats from '@/components/Game/GameStats';
import GameStatsLarge from '@/components/Game/GameStatsLarge';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import GroupChat from '@/components/GroupChat/GroupChat';
import { useWallet } from '@/contexts/WalletContext';

export function GameDashboardContent() {
  const { isChatOpen } = useChat();
  const { balance } = useWallet();

  return (
    <div className="min-h-screen bg-slate-900">
      <GameDashboardHeader balance={balance} />
      <div className={`p-1 transition-all duration-300 ease-in-out ${isChatOpen ? 'mr-[280px]' : ''}`}> 
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-1">
          <div className="sm:order-1 md:order-1 md:col-span-2 flex flex-col space-y-1">
            <GameBoard />
            <div className="md:hidden">
              <GameStats />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
              <div className="col-span-1 md:col-span-3">
                <BettingPanel />
                <div className="md:hidden mt-1">
                  <WithdrawalBroadcast small={true} />
                </div>
              </div>
              <div className="hidden md:flex md:col-span-1 pl-1 flex-col h-full">
                <div className="mb-1">
                  <GameStatsLarge />
                </div>
                <div className="flex-1">
                  <WithdrawalBroadcast />
                </div>
              </div>
            </div>
            <AdvertisementCarousel />
          </div>
          <div className="sm:order-3 md:order-3 md:col-span-1 space-y-1">
            <GameData />
          </div>
        </div>
      </div>
      {isChatOpen && <GroupChat isOpen={true} onClose={() => {}} />}
    </div>
  );
}

export default function GameDashboard() {
  return (
    <ChatProvider>
      <GameDashboardContent />
    </ChatProvider>
  );
}
