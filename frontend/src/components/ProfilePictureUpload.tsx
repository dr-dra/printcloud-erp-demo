'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef } from 'react';
import { Button, Spinner, Alert } from 'flowbite-react';
import { HiUpload, HiTrash, HiPencil } from 'react-icons/hi';
import { api } from '@/lib/api';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import ProfilePictureEditor from './ProfilePictureEditor';
type EditorSavePayload = {
  blob?: Blob;
  position: { x: number; y: number };
  scale: number;
  sourceUrl: string;
};

interface ProfilePictureUploadProps {
  onUploadSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function ProfilePictureUpload({
  onUploadSuccess,
  onError,
  className = '',
}: ProfilePictureUploadProps) {
  const {
    profilePictureUrl,
    originalImageUrl,
    exists,
    updateProfilePicture,
    clearProfilePicture,
    handleImageError,
    getProfilePictureUrlForEdit,
  } = useProfilePicture();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'Invalid file type. Please select a JPG, PNG, or GIF image.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      const errorMsg = 'File size too large. Maximum 5MB allowed.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // File will be uploaded directly, no need to create preview
    // The useProfilePicture hook will handle the display

    // Upload file
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('profile_picture', file);

      await api.post('/users/profile/upload-picture/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update profile picture cache and trigger refresh
      updateProfilePicture();
      onUploadSuccess?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Upload failed. Please try again.';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const uploadBlob = async (blob: Blob, filename: string = 'cropped_profile.jpg') => {
    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('profile_picture', blob, filename);

      await api.post('/users/profile/upload-picture/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update profile picture cache and trigger refresh
      updateProfilePicture();
      onUploadSuccess?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Upload failed. Please try again.';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setError(null);
    clearProfilePicture();
    // TODO: Implement API call to remove profile picture files from filesystem
    onUploadSuccess?.();
  };

  const handleEditClick = () => {
    // Use original image for editing if available, otherwise use display image
    const imageToEdit = originalImageUrl || profilePictureUrl;
    if (imageToEdit) {
      setShowEditor(true);
    }
  };

  const handleEditorSave = async (payload: EditorSavePayload) => {
    setShowEditor(false);
    try {
      if (payload.blob) {
        await uploadBlob(payload.blob);
        return;
      }
      // Server-side crop
      setUploading(true);
      setError(null);
      await api.post('/users/profile/crop-picture/', {
        source_url: payload.sourceUrl,
        position: payload.position,
        scale: payload.scale,
      });

      // Update profile picture cache and trigger refresh
      updateProfilePicture();
      onUploadSuccess?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Crop failed. Please try again.';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Profile Picture Display */}
      <div className="relative">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getProfilePictureUrlForEdit()}
            alt={profilePictureUrl ? 'Profile picture' : 'Add profile picture'}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        </div>

        {/* Upload overlay when uploading */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
            <Spinner size="lg" color="white" />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert color="failure" className="w-full max-w-sm">
          <span className="text-sm">{error}</span>
        </Alert>
      )}

      {/* Upload Controls */}
      <div className="flex space-x-2">
        <Button size="xs" color="blue" onClick={handleButtonClick} disabled={uploading}>
          {uploading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <HiUpload className="mr-2 h-4 w-4" />
              {exists ? 'Change Photo' : 'Upload Photo'}
            </>
          )}
        </Button>

        {exists && (
          <>
            <Button size="xs" color="blue" onClick={handleEditClick} disabled={uploading}>
              <HiPencil className="mr-2 h-4 w-4" />
              Edit Position
            </Button>

            <Button size="xs" color="gray" onClick={handleRemove} disabled={uploading}>
              <HiTrash className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Helper Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Recommended: Square image, max 5MB. Supports JPG, PNG, and GIF formats.
      </p>

      {/* Profile Picture Editor Modal */}
      {showEditor && (originalImageUrl || profilePictureUrl) && (
        <ProfilePictureEditor
          isOpen={showEditor}
          imageUrl={originalImageUrl || profilePictureUrl!}
          onClose={handleEditorClose}
          onSave={handleEditorSave as any}
          onError={(error) => {
            setError(error);
            onError?.(error);
          }}
        />
      )}
    </div>
  );
}
