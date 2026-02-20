'use client';

import React from 'react';

interface InitialsAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  userId?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Material Design color palette for avatars
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-violet-500',
];

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-32 h-32 text-4xl',
  xl: 'w-40 h-40 text-5xl',
};

export default function InitialsAvatar({
  firstName,
  lastName,
  fullName,
  username,
  email,
  userId = 0,
  size = 'lg',
  className = '',
}: InitialsAvatarProps) {
  // Generate initials with fallback logic
  const generateInitials = (): string => {
    // Try firstName + lastName first
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }

    // Try fullName
    if (fullName) {
      const names = fullName.trim().split(' ');
      if (names.length >= 2) {
        return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
      }
      if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
      }
    }

    // Try username
    if (username) {
      return username.length >= 2
        ? username.substring(0, 2).toUpperCase()
        : username.charAt(0).toUpperCase();
    }

    // Try email
    if (email) {
      const emailName = email.split('@')[0];
      return emailName.length >= 2
        ? emailName.substring(0, 2).toUpperCase()
        : emailName.charAt(0).toUpperCase();
    }

    // Ultimate fallback
    return 'U';
  };

  // Generate consistent color based on user ID
  const getAvatarColor = (): string => {
    return AVATAR_COLORS[userId % AVATAR_COLORS.length];
  };

  const initials = generateInitials();
  const colorClass = getAvatarColor();
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={`
        ${sizeClass} 
        ${colorClass} 
        rounded-full 
        flex 
        items-center 
        justify-center 
        text-white 
        font-semibold 
        select-none
        ${className}
      `}
      role="img"
      aria-label={`Avatar for ${fullName || firstName || username || email || 'user'}`}
    >
      {initials}
    </div>
  );
}
