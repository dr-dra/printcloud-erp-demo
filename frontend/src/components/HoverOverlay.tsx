'use client';

import React from 'react';
import { HiPlus } from 'react-icons/hi';

interface HoverOverlayProps {
  type: 'add' | 'change';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40',
};

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

const TEXT_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export default function HoverOverlay({ type, size = 'lg', className = '' }: HoverOverlayProps) {
  const sizeClass = SIZE_CLASSES[size];
  const iconSize = ICON_SIZES[size];
  const textSize = TEXT_SIZES[size];

  return (
    <div
      className={`
        absolute 
        inset-0 
        ${sizeClass}
        rounded-full 
        bg-black 
        bg-opacity-50 
        flex 
        items-center 
        justify-center 
        text-white 
        font-medium
        opacity-0 
        group-hover:opacity-100 
        transition-opacity 
        duration-200 
        ease-in-out
        ${className}
      `}
      aria-hidden="true"
    >
      {type === 'add' ? <HiPlus className={iconSize} /> : <span className={textSize}>Change</span>}
    </div>
  );
}
