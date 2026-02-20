'use client';

import React from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  animated?: boolean;
  onClick?: () => void;
}

/**
 * CircularProgress - A circular progress ring component
 *
 * Displays a circular progress indicator with dynamic colors based on completion percentage.
 * Used for showing profile completion, form progress, etc.
 *
 * @example
 * ```tsx
 * <CircularProgress percentage={67} size={44} strokeWidth={3} showPercentage={true} />
 * ```
 */
export default function CircularProgress({
  percentage,
  size = 48,
  strokeWidth = 4,
  showPercentage = true,
  animated = true,
  onClick,
}: CircularProgressProps) {
  // Ensure percentage is between 0 and 100
  const normalizedPercentage = Math.min(100, Math.max(0, percentage));

  // Calculate color based on percentage thresholds
  const getColor = () => {
    if (normalizedPercentage < 30) return '#EF4444'; // red-500
    if (normalizedPercentage < 70) return '#F59E0B'; // amber-500
    return '#236bb4'; // primary-500 (teal)
  };

  // SVG circle calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedPercentage / 100) * circumference;

  const color = getColor();

  return (
    <div
      className={`relative inline-flex items-center justify-center ${onClick ? 'cursor-pointer hover:scale-105' : ''} transition-transform duration-200`}
      onClick={onClick}
      title={`${normalizedPercentage}% complete`}
      role="progressbar"
      aria-label={`Form completion: ${normalizedPercentage}%`}
      aria-valuenow={normalizedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-600 opacity-30"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animated ? 'transition-all duration-300 ease-out' : ''}
          style={{
            transitionProperty: 'stroke-dashoffset, stroke',
          }}
        />
      </svg>

      {/* Percentage text overlay */}
      {showPercentage && (
        <div
          className="absolute text-[11px] font-semibold"
          style={{
            color,
            fontFamily: 'Outfit, system-ui, sans-serif',
          }}
        >
          {normalizedPercentage}%
        </div>
      )}
    </div>
  );
}
