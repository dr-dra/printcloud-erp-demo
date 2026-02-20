'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'flowbite-react';
import { HiUpload, HiTrash, HiX, HiRefresh } from 'react-icons/hi';
import { api } from '@/lib/api';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import InitialsAvatar from './InitialsAvatar';
import InlineImageEditor from './InlineImageEditor';

interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadStart: () => void;
  onUploadComplete: () => void;
  onError: (error: string) => void;
  currentExists: boolean;
  currentImageUrl: string | null;
  userNameData: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
    userId?: number;
  };
}

type ModalState = 'view' | 'upload' | 'edit';

export default function ProfilePictureModal({
  isOpen,
  onClose,
  onUploadStart,
  onUploadComplete,
  onError,
  currentExists,
  currentImageUrl,
  userNameData,
}: ProfilePictureModalProps) {
  const { originalImageUrl, updateProfilePicture, clearProfilePicture } = useProfilePicture();
  const [modalState, setModalState] = useState<ModalState>('view');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setModalState('view');
      setError(null);
      setPreviewUrl(null);
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    // Clear any existing errors
    setError(null);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please select a JPG, PNG, or GIF image.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Maximum 5MB allowed.');
      return;
    }

    // Create preview and automatically switch to edit mode
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      console.log('[ProfilePictureModal] File loaded, switching to edit mode');
      setPreviewUrl(dataUrl);
      setModalState('edit');
    };
    reader.onerror = () => {
      setError('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Upload blob (for cropped images)
  const uploadBlob = async (blob: Blob) => {
    try {
      setUploading(true);
      setError(null);
      onUploadStart();

      const formData = new FormData();
      formData.append('profile_picture', blob, 'profile_picture.jpg');

      await api.post('/users/profile/upload-picture/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      updateProfilePicture();
      onUploadComplete();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Upload failed. Please try again.';
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  // Handle editor save
  const handleEditorSave = async (payload: {
    blob?: Blob;
    position: { x: number; y: number };
    scale: number;
    sourceUrl: string;
  }) => {
    try {
      setUploading(true);
      setError(null);
      onUploadStart();

      if (payload.blob) {
        console.log('[ProfilePictureModal] Saving with client-side cropped blob');
        await uploadBlob(payload.blob);
      } else {
        console.log('[ProfilePictureModal] Saving with server-side crop');
        await api.post('/users/profile/crop-picture/', {
          source_url: payload.sourceUrl,
          position: payload.position,
          scale: payload.scale,
        });
      }

      // Update profile picture cache
      updateProfilePicture();

      // Reset modal state and close
      setModalState('view');
      setPreviewUrl(null);
      onUploadComplete();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Save failed. Please try again.';
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  // Handle remove
  const handleRemove = () => {
    clearProfilePicture();
    onUploadComplete();
  };

  // Handle file selection from button
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle edit existing picture
  const handleEditClick = () => {
    // Always prefer original image for editing if available
    const imageToEdit = originalImageUrl || currentImageUrl;
    if (imageToEdit) {
      console.log('[ProfilePictureModal] Edit Position clicked, loading image:', imageToEdit);
      setPreviewUrl(imageToEdit);
      setModalState('edit');
    } else {
      setError('No image available to edit');
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getModalTitle = () => {
    switch (modalState) {
      case 'upload':
        return 'Upload Profile Picture';
      case 'edit':
        return 'Edit Profile Picture';
      default:
        return 'Profile Picture';
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl">
      <Modal.Header>{getModalTitle()}</Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <Alert color="failure">
              <span className="text-sm">{error}</span>
            </Alert>
          )}

          {/* View State - Show current picture or initials */}
          {modalState === 'view' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Large Preview */}
              <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-gray-200 dark:border-gray-600 shadow-lg">
                {currentExists && currentImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </>
                ) : (
                  <InitialsAvatar {...userNameData} size="xl" className="w-48 h-48 text-6xl" />
                )}
              </div>

              {/* Upload Area for No Picture State */}
              {!currentExists && (
                <div
                  className={`
                    w-full 
                    h-32 
                    border-2 
                    border-dashed 
                    rounded-lg 
                    flex 
                    flex-col 
                    items-center 
                    justify-center 
                    cursor-pointer
                    transition-colors
                    ${
                      dragOver
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
                    }
                  `}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={handleUploadClick}
                >
                  <HiUpload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Drag & drop an image here, or click to select
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    JPG, PNG, GIF up to 5MB
                  </p>
                </div>
              )}

              {/* Helper Text */}
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {currentExists
                  ? 'Upload a new picture to replace your current one, or edit the position of your existing picture.'
                  : 'Upload a photo to personalize your profile and help others recognize you.'}
              </p>
            </div>
          )}

          {/* Edit State - Show inline image editor */}
          {modalState === 'edit' && previewUrl && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center">
                Position Your Profile Picture
              </h3>

              <InlineImageEditor
                imageUrl={previewUrl}
                onSave={handleEditorSave}
                onCancel={() => setModalState('view')}
                loading={uploading}
              />
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-between w-full">
          <div className="flex space-x-2">
            {modalState === 'view' && (
              <>
                <Button color="blue" onClick={handleUploadClick} disabled={uploading}>
                  <HiUpload className="mr-2 h-4 w-4" />
                  {currentExists ? 'Upload New' : 'Upload Photo'}
                </Button>

                {currentExists && (
                  <Button color="blue" onClick={handleEditClick} disabled={uploading}>
                    <HiRefresh className="mr-2 h-4 w-4" />
                    Edit Position
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex space-x-2">
            {modalState === 'view' && currentExists && (
              <Button color="failure" onClick={handleRemove} disabled={uploading}>
                <HiTrash className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}

            <Button color="gray" onClick={onClose} disabled={uploading}>
              <HiX className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Loading Overlay */}
      {uploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
            <Spinner size="md" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
