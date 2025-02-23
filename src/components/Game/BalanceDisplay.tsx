import React, { useState, useEffect } from 'react';
import { AuthService } from '@/app/lib/auth';
import WalletService from '@/services/walletService';
import toast from 'react-hot-toast';

interface BalanceDisplayProps {
  balance?: number;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ balance: propBalance }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [formattedBalance, setFormattedBalance] = useState<string>('Loading...');
  const [currency] = useState<string>('KSH');

  useEffect(() => {
    if (propBalance !== undefined) {
      setBalance(propBalance);
      setFormattedBalance(propBalance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));
    }
  }, [propBalance]);

  return (
    <div className="balance-display text-xs font-bold">
      <span>{currency} {formattedBalance}</span>
    </div>
  );
};

export default BalanceDisplay;
