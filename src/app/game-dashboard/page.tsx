import React from 'react';
import GameDashboardHeader from '@/components/Game/GameDashboardHeader';
import GameBoard from '@/components/Game/GameBoard';
import BettingPanel from '@/components/Game/BettingPanel';
import GameData from '@/components/Game/GameData';

export default function GameDashboard() {
  return (
    <div className="min-h-screen bg-slate-900">
      <GameDashboardHeader />
      <div className="p-1">
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-1">
          <div className="sm:order-1 md:order-2 md:col-span-2 flex flex-col space-y-1">
            <GameBoard />
            <BettingPanel />
          </div>
          <div className="sm:order-3 md:order-1 md:col-span-1 space-y-1">
            <GameData />
          </div>
        </div>
      </div>
    </div>
  );
}
