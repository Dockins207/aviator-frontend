import React, { useMemo } from 'react';

// Color palette for generating consistent colors
const COLOR_PALETTE = [
  'bg-gray-500',  // Neutral color for anonymous/empty usernames
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 
  'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 
  'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'
];

interface UserAvatarProps {
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  hideIfEmpty?: boolean;  // New prop to optionally hide avatar for empty usernames
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  username = '', 
  size = 'sm',
  className = '',
  hideIfEmpty = false  // Changed default to false
}) => {
  // Generate a consistent color based on username
  const avatarColor = useMemo(() => {
    // Use first color (gray) for empty or generic usernames
    if (!username || 
        ['unknown player', 'anonymous', 'user', 'guest'].includes(username.trim().toLowerCase())) {
      return COLOR_PALETTE[0];
    }
    
    // Use a simple hash to generate a consistent color index
    const hash = username.split('').reduce((acc, char) => 
      char.charCodeAt(0) + ((acc << 5) - acc), 0
    );
    const colorIndex = Math.abs(hash) % (COLOR_PALETTE.length - 1) + 1;  // Skip first (gray) color
    
    return COLOR_PALETTE[colorIndex];
  }, [username]);

  // Get the first letter of the username or use a default
  const firstLetter = username 
    ? username[0].toUpperCase() 
    : '?';  // Default to question mark for empty usernames

  // Size variations
  const sizeClasses = {
    'xs': 'w-6 h-6 text-xs',
    'sm': 'w-8 h-8 text-sm',
    'md': 'w-10 h-10 text-base',
    'lg': 'w-12 h-12 text-lg'
  };

  // If username is empty and hideIfEmpty is true, return null
  if (hideIfEmpty && (!username || ['unknown player', 'anonymous', 'user', 'guest'].includes(username.trim().toLowerCase()))) {
    return null;
  }

  return (
    <div 
      className={`
        ${avatarColor} 
        ${sizeClasses[size]} 
        ${className}
        rounded-full 
        flex 
        items-center 
        justify-center 
        text-white 
        font-bold 
        select-none
        border border-white/20  // Added subtle border
        shadow-sm  // Added subtle shadow
      `}
    >
      {firstLetter}
    </div>
  );
};

export default UserAvatar;
