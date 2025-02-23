'use client';

import React from 'react';
import { WalletProvider } from '@/contexts/WalletContext';
import { Toaster, DefaultToastOptions } from 'react-hot-toast';

interface ProvidersProps {
  children: React.ReactNode;
}

const customToastOptions: DefaultToastOptions = {
  duration: 3000,
  style: {
    background: '#333',
    color: '#fff',
    borderRadius: '8px',
    padding: '12px 20px',
    maxWidth: '400px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '14px',
    fontWeight: 500,
  },
  success: {
    style: {
      background: '#4CAF50',
      color: 'white',
    },
    icon: '✅',
  },
  error: {
    style: {
      background: '#F44336',
      color: 'white',
    },
    icon: '❌',
  },
  blank: {
    style: {
      background: '#333',
      color: 'white',
    },
  },
  loading: {
    style: {
      background: '#2196F3',
      color: 'white',
    },
    icon: '🔄',
  },
};

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      <Toaster position="top-right" toastOptions={customToastOptions} />
      {children}
    </WalletProvider>
  );
}
