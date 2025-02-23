/**
 * Truncates a username for display purposes with improved handling
 * @param username The original username
 * @param maxLength Maximum length before truncation (default: 10)
 * @param showEllipsis Whether to show ellipsis after truncation (default: true)
 * @returns Truncated username
 */
export function truncateUsername(
  username?: string, 
  maxLength: number = 10, 
  showEllipsis: boolean = true
): string {
  // Handle null or undefined
  if (!username) return '';
  
  // Remove 'Unknown Player' and similar generic names
  const genericNames = [
    'unknown player', 
    'anonymous', 
    'user', 
    'guest'
  ];

  const normalizedUsername = username.trim().toLowerCase();
  
  // If username is a generic name or empty, return empty string
  if (genericNames.includes(normalizedUsername)) return '';
  
  // If username is shorter than max length, return as is
  if (username.length <= maxLength) return username;
  
  // Truncate and optionally add ellipsis
  return showEllipsis 
    ? `${username.slice(0, maxLength)}...`
    : username.slice(0, maxLength);
}

/**
 * Formats a number to a localized currency string
 * @param amount The amount to format
 * @param currency Currency code (default: 'KSH')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'KSH'
): string {
  return `${currency} ${amount.toLocaleString()}`;
}
