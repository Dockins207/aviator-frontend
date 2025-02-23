'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CrashHistoryProps {
  history: number[];
}

const CrashHistory: React.FC<CrashHistoryProps> = ({ history }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Function to determine color based on crash value
  const getColor = (value: number): string => {
    if (value >= 10) return 'bg-red-500/20 text-red-500';
    if (value >= 5) return 'bg-yellow-500/20 text-yellow-500';
    if (value >= 2) return 'bg-green-500/20 text-green-500';
    return 'bg-blue-500/20 text-blue-500';
  };

  // Split history into recent and older
  const recentHistory = history.slice(0, 10);
  const olderHistory = history.slice(10);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-start gap-[2px] p-0.5 overflow-x-auto scrollbar-hide">
        {recentHistory.map((crash, index) => (
          <div
            key={index}
            className={`flex-shrink-0 min-w-[45px] px-1 py-0.5 text-[10px] font-medium text-center rounded ${getColor(crash)}`}
          >
            {crash.toFixed(2)}x
          </div>
        ))}
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className={`
            flex-shrink-0 px-1.5 py-1 ml-0.5 rounded
            ${showDropdown 
              ? 'text-white bg-zinc-700/50 hover:bg-zinc-600/50' 
              : 'text-zinc-400 bg-zinc-800/30 hover:bg-zinc-700/30'
            }
            transition-all duration-200 cursor-pointer
            active:scale-95
          `}
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown for older history */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 rounded-lg border border-zinc-800 z-50 max-h-[240px] overflow-hidden shadow-xl">
          <div className="p-2 border-b border-zinc-800/50">
            <div className="text-[10px] font-medium text-zinc-400">Recent Crash History</div>
            <div className="text-[9px] text-zinc-500">Last updated: {new Date().toLocaleTimeString()}</div>
          </div>
          <div className="p-2 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-6 gap-1">
              {olderHistory.map((crash, index) => (
                <div
                  key={index}
                  className={`px-1 py-0.5 text-[10px] font-medium text-center rounded ${getColor(crash)}`}
                >
                  {crash.toFixed(2)}x
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrashHistory;
