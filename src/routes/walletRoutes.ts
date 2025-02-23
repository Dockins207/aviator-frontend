
export interface WalletBalance {
  balance: number;
}

export interface WalletError {
  message: string;
}

export interface WalletRoutes {
  // GET /api/wallet/balance
  getBalance: {
    response: WalletBalance;
    error: WalletError;
  };
}

// API endpoints
export const WALLET_ENDPOINTS = {
  BALANCE: '/api/wallet/balance',
} as const;
