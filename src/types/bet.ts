export interface BetDetails {
  amount: number;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier?: number;
}

export interface BetResponse {
  id: string;
  userId: string;
  username: string;
  role: string;
  amount: number;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number | null;
  gameSessionId: string;
  status: string;
  createdAt: string;
}
