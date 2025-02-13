import React, { useState, useEffect } from 'react';
import { AuthService } from '@/app/lib/auth';

const BalanceDisplay: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('KSH');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBalance = async () => {
    try {
      const balanceData = await AuthService.getWalletBalance();
      if (balanceData) {
        setBalance(balanceData.balance);
        setCurrency(balanceData.currency);
      } else {
        // Reset balance if no data is returned
        setBalance(0);
        setCurrency('USD');
      }
    } catch (error) {
      console.error('Balance fetch failed:', error);
      // Reset balance on error
      setBalance(0);
      setCurrency('USD');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch balance if authenticated
    if (AuthService.isAuthenticated()) {
      fetchBalance();
    } else {
      setLoading(false);
    }
  }, []);

  // Render logic with comprehensive error and loading states
  if (loading) {
    return <div className="text-white text-sm">Loading balance...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-sm">Balance unavailable</div>;
  }

  if (balance === null) {
    return <div className="text-white text-sm">-</div>;
  }

  return (
    <div className="balance-display text-white text-sm">
      Balance: {currency} {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  );
};

export default BalanceDisplay;
