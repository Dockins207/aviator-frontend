import React, { useState, useEffect } from 'react';

interface Withdrawal {
  phone: string;
  amount: number;
  message: string;
}

const GameStatsLarge: React.FC = () => {
  const [activeBar, setActiveBar] = useState<'top' | 'bottom'>('top');
  const [topWithdrawal, setTopWithdrawal] = useState<Withdrawal>({
    phone: '+254704*****85',
    amount: 1000,
    message: 'Congratulations! Quick withdrawal processed successfully!'
  });
  const [bottomWithdrawal, setBottomWithdrawal] = useState<Withdrawal>({
    phone: '+254712*****23',
    amount: 2000,
    message: 'Amazing win! Instant payout completed in seconds!'
  });

  useEffect(() => {
    const messages = [
      'Congratulations! Quick withdrawal processed successfully!',
      'Amazing win! Instant payout completed in seconds!',
      'Great game! Withdrawal sent to M-PESA instantly!',
      'Fantastic play! Your winnings have been processed!',
      'Excellent strategy! Withdrawal completed successfully!'
    ];

    const toggleBar = () => {
      setActiveBar(prev => prev === 'top' ? 'bottom' : 'top');
      // Simulate new withdrawals
      if (activeBar === 'top') {
        setBottomWithdrawal({
          phone: '+254712*****' + Math.floor(Math.random() * 100),
          amount: Math.floor(Math.random() * 5000) + 500,
          message: messages[Math.floor(Math.random() * messages.length)]
        });
      } else {
        setTopWithdrawal({
          phone: '+254704*****' + Math.floor(Math.random() * 100),
          amount: Math.floor(Math.random() * 5000) + 500,
          message: messages[Math.floor(Math.random() * messages.length)]
        });
      }
    };

    const interval = setInterval(toggleBar, 6000); // 3s display + 3s transition

    return () => clearInterval(interval);
  }, [activeBar]);

  const barStyle = "w-full py-2 text-[10px] uppercase tracking-wider text-white text-center shadow-lg bg-gradient-to-r from-pink-600 via-red-500 to-orange-500 whitespace-nowrap";

  const formatWithdrawal = (w: Withdrawal) => {
    return `${w.phone} withdrew KSH ${w.amount.toLocaleString()} - ${w.message}`;
  };

  return (
    <div className="flex flex-col space-y-2 relative z-50 overflow-x-hidden">
      {/* Top Stats Tab */}
      <div className="relative w-full h-8 overflow-hidden">
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <div className={`absolute inset-0 transition-transform duration-[3000ms] ease-in-out ${activeBar === 'top' ? 'translate-x-0' : 'translate-x-[120%]'}`}>
            <div className={`${barStyle} h-full w-full rounded-lg border-r border-orange-400 shadow-[0_0_15px_rgba(255,69,0,0.5)] flex items-center justify-start px-2 overflow-hidden`}>
              <div className="flex animate-slide whitespace-nowrap">
                <span className="inline-block px-3">{formatWithdrawal(topWithdrawal)}</span>
                <span className="inline-block px-3">{formatWithdrawal(topWithdrawal)}</span>
                <span className="inline-block px-3">{formatWithdrawal(topWithdrawal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats Tab */}
      <div className="relative w-full h-8 overflow-hidden">
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <div className={`absolute inset-0 transition-transform duration-[3000ms] ease-in-out ${activeBar === 'bottom' ? 'translate-x-0' : 'translate-x-[120%]'}`}>
            <div className={`${barStyle} h-full w-full rounded-lg border-l border-orange-400 shadow-[0_0_15px_rgba(255,69,0,0.5)] flex items-center justify-start px-2 overflow-hidden`}>
              <div className="flex animate-slide whitespace-nowrap">
                <span className="inline-block px-3">{formatWithdrawal(bottomWithdrawal)}</span>
                <span className="inline-block px-3">{formatWithdrawal(bottomWithdrawal)}</span>
                <span className="inline-block px-3">{formatWithdrawal(bottomWithdrawal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameStatsLarge;
