import React, { useState, useEffect } from 'react';

interface BalanceDisplayProps {
  balance?: number;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ balance: propBalance }) => {
  const [formattedBalance, setFormattedBalance] = useState<string>('Loading...');
  const [currency] = useState<string>('KSH');

  useEffect(() => {
    if (propBalance !== undefined) {
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
