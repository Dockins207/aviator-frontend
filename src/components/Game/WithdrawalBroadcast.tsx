import React, { useEffect, useState } from 'react';
import gameSocketService from '@/services/gameSocketService';

interface WithdrawalBroadcastProps {
  small?: boolean;
}

interface Withdrawal {
  username: string;
  amount: number;
  timestamp: Date;
}

export default function WithdrawalBroadcast({ small = false }: WithdrawalBroadcastProps) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    // Simulate initial top withdrawals
    const initialWithdrawals = Array(10).fill(null).map(() => ({
      username: '+254' + Math.floor(Math.random() * 900000000 + 100000000),
      amount: Math.floor(Math.random() * 10000) + 1000,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000))
    }));

    setWithdrawals(initialWithdrawals.sort((a, b) => b.amount - a.amount));

    // Update withdrawals periodically
    const interval = setInterval(() => {
      const newWithdrawal = {
        username: '+254' + Math.floor(Math.random() * 900000000 + 100000000),
        amount: Math.floor(Math.random() * 10000) + 1000,
        timestamp: new Date()
      };

      setWithdrawals(prev => {
        const updated = [...prev, newWithdrawal]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  return (
    <div className={`bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 rounded-lg p-2 mt-1 ${small ? 'h-[120px]' : 'h-[165px]'}`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-orange-400 font-semibold text-xs">Top Withdrawals</h2>
        <div className="flex items-center space-x-1">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-500 text-[10px]">Live</span>
        </div>
      </div>
      <div className={`h-[calc(100%-20px)] overflow-hidden relative`}>
        <div className="animate-scrollY">
          <div className="space-y-1">
            {withdrawals.map((withdrawal, index) => (
              <div key={index} className="bg-gradient-to-r from-blue-800/50 to-purple-800/50 py-1 px-2 rounded">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300">{withdrawal.username}</span>
                  <span className="text-green-400 font-medium">KES {withdrawal.amount.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatTimeAgo(withdrawal.timestamp)}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {withdrawals.map((withdrawal, index) => (
              <div key={`repeat-${index}`} className="bg-gradient-to-r from-blue-800/50 to-purple-800/50 py-1 px-2 rounded">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300">{withdrawal.username}</span>
                  <span className="text-green-400 font-medium">KES {withdrawal.amount.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatTimeAgo(withdrawal.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
