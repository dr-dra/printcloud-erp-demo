'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Spinner } from 'flowbite-react';
import { useAuth } from '@/context/AuthContext';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import HoverOverlay from './HoverOverlay';
import ProfilePictureModal from './ProfilePictureModal';

interface ProfilePictureCircleProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onUploadSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ProfilePictureCircle({
  size = 'lg',
  className = '',
  onUploadSuccess,
  onError,
}: ProfilePictureCircleProps) {
  const { user } = useAuth();
  const { profilePictureUrl, exists, loading, handleImageError, getProfilePictureUrlForEdit } =
    useProfilePicture();
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Get user's name data for initials
  const getNameData = () => {
    if (!user) return {};

    // Try to get names from various sources
    return {
      firstName: (user as any)?.first_name,
      lastName: (user as any)?.last_name,
      fullName: user.display_name,
      username: user.username,
      email: user.email,
      userId: user.id,
    };
  };

  const handleClick = () => {
    setShowModal(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowModal(true);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleUploadStart = () => {
    setIsUploading(true);
  };

  const handleUploadComplete = () => {
    setIsUploading(false);
    setShowModal(false);
    onUploadSuccess?.();
  };

  const handleError = (error: string) => {
    setIsUploading(false);
    onError?.(error);
  };

  const nameData = getNameData();

  return (
    <>
      {/* Main Profile Circle */}
      <div className={`relative ${className}`}>
        <button
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className={`
            group
            relative
            rounded-full
            cursor-pointer
            focus:outline-none
            focus:ring-4
            focus:ring-blue-300
            dark:focus:ring-blue-800
            transition-all
            duration-200
            ease-in-out
            hover:scale-105
            ${loading ? 'pointer-events-none' : ''}
          `}
          disabled={loading}
          aria-label={exists ? 'Change profile picture' : 'Add profile picture'}
          role="button"
        >
          {/* Profile Picture with Fallback */}
          <div
            className={`
            rounded-full
            overflow-hidden
            border-4
            border-white
            dark:border-gray-600
            shadow-lg
            ${size === 'sm' ? 'w-8 h-8' : ''}
            ${size === 'md' ? 'w-12 h-12' : ''}
            ${size === 'lg' ? 'w-32 h-32' : ''}
            ${size === 'xl' ? 'w-40 h-40' : ''}
          `}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getProfilePictureUrlForEdit()}
              alt={profilePictureUrl ? 'Profile picture' : 'Add profile picture'}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>

          {/* Hover Overlay */}
          <HoverOverlay type={exists ? 'change' : 'add'} size={size} />

          {/* Loading Overlay */}
          {(loading || isUploading) && (
            <div
              className={`
              absolute 
              inset-0 
              rounded-full 
              bg-black 
              bg-opacity-50 
              flex 
              items-center 
              justify-center
              ${size === 'sm' ? 'w-8 h-8' : ''}
              ${size === 'md' ? 'w-12 h-12' : ''}
              ${size === 'lg' ? 'w-32 h-32' : ''}
              ${size === 'xl' ? 'w-40 h-40' : ''}
            `}
            >
              <Spinner size={size === 'sm' ? 'sm' : 'md'} color="white" />
            </div>
          )}
        </button>
      </div>

      {/* Profile Picture Management Modal */}
      <ProfilePictureModal
        isOpen={showModal}
        onClose={handleModalClose}
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onError={handleError}
        currentExists={exists}
        currentImageUrl={profilePictureUrl}
        userNameData={nameData}
      />
    </>
  );
}
