'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { debugWarn } from '@/utils/logger';

interface ProfilePictureCache {
  userId: number;
  profilePictureUrl: string;
  originalImageUrl: string | null;
  timestamp: number;
}

const CACHE_KEY = 'profilePictureCache_v2';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const PROFILE_PICTURE_EVENT = 'profilePictureUpdated';

export const useProfilePicture = () => {
  const { user } = useAuth();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Get the final profile picture URL with fallback (for dashboard use)
  const getProfilePictureUrlWithFallback = () => {
    if (profilePictureUrl && !imageLoadError) {
      return profilePictureUrl;
    }
    return '/images/profile-pictures/new_user_photo.svg';
  };

  // Get profile picture URL with add_profile_pic fallback (for profile edit page)
  const getProfilePictureUrlForEdit = () => {
    if (profilePictureUrl && !imageLoadError) {
      return profilePictureUrl;
    }
    return '/images/profile-pictures/add_profile_pic.svg';
  };

  // Load from cache
  const loadFromCache = useCallback((): ProfilePictureCache | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: ProfilePictureCache = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - data.timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      // Check if user has changed
      if (user && data.userId !== user.id) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [user]);

  // Save to cache
  const saveToCache = useCallback((data: Omit<ProfilePictureCache, 'timestamp'>) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheData: ProfilePictureCache = {
        ...data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      debugWarn('Failed to save profile picture cache:', error);
    }
  }, []);

  // Get profile picture URLs from API without checking file existence
  const getProfilePictureFromAPI = useCallback(async (): Promise<{
    profilePictureUrl: string | null;
    originalImageUrl: string | null;
  }> => {
    try {
      const response = await api.get('/users/profile/summary/');
      const data = response.data;

      return {
        profilePictureUrl: data.profile_picture,
        originalImageUrl: data.original_image_url,
      };
    } catch (error) {
      debugWarn('Failed to fetch profile picture info:', error);
      return {
        profilePictureUrl: null,
        originalImageUrl: null,
      };
    }
  }, []);

  // Load profile picture
  const loadProfilePicture = useCallback(
    async (force = false) => {
      if (!user?.id) {
        setProfilePictureUrl(null);
        setOriginalImageUrl(null);
        setExists(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Try cache first (unless forced refresh)
      if (!force) {
        const cached = loadFromCache();
        if (cached) {
          setProfilePictureUrl(cached.profilePictureUrl);
          setOriginalImageUrl(cached.originalImageUrl);
          setExists(!!cached.profilePictureUrl);
          setImageLoadError(false);
          setLoading(false);
          return;
        }
      }

      // Get profile picture URLs from API
      const profileInfo = await getProfilePictureFromAPI();

      setProfilePictureUrl(profileInfo.profilePictureUrl);
      setOriginalImageUrl(profileInfo.originalImageUrl);
      setImageLoadError(false);

      // Only set exists to true if we have a URL
      // If no URL, immediately set to false to avoid flash
      setExists(!!profileInfo.profilePictureUrl);

      // Save to cache if we have URLs
      if (profileInfo.profilePictureUrl) {
        saveToCache({
          userId: user.id,
          profilePictureUrl: profileInfo.profilePictureUrl,
          originalImageUrl: profileInfo.originalImageUrl,
        });
      }

      setLoading(false);
    },
    [user, loadFromCache, saveToCache, getProfilePictureFromAPI],
  );

  const clearLocalState = useCallback(() => {
    setProfilePictureUrl(null);
    setOriginalImageUrl(null);
    setExists(false);
    setImageLoadError(false);
    setLoading(false);
  }, []);

  // Update profile picture (called after upload/crop)
  const updateProfilePicture = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Clear cache and notify all hook instances to refresh
    localStorage.removeItem(CACHE_KEY);
    window.dispatchEvent(
      new CustomEvent(PROFILE_PICTURE_EVENT, { detail: { action: 'updated', userId: user?.id } }),
    );
  }, [user?.id]);

  // Clear profile picture (called after deletion)
  const clearProfilePicture = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    clearLocalState();
    window.dispatchEvent(
      new CustomEvent(PROFILE_PICTURE_EVENT, { detail: { action: 'cleared', userId: user?.id } }),
    );
  }, [clearLocalState, user?.id]);

  // Handle image load error - called when image fails to load
  const handleImageError = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
    setProfilePictureUrl(null);
    setOriginalImageUrl(null);
    setExists(false);
    setImageLoadError(true);
  }, []);

  // Load profile picture when user changes
  useEffect(() => {
    loadProfilePicture();
  }, [user?.id, loadProfilePicture]);

  // Keep avatar in sync across components
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfilePictureEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; userId?: number }>).detail;
      if (detail?.userId && user?.id && detail.userId !== user.id) {
        return;
      }
      if (detail?.action === 'cleared') {
        clearLocalState();
        return;
      }
      loadProfilePicture(true);
    };

    window.addEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
    return () => {
      window.removeEventListener(PROFILE_PICTURE_EVENT, handleProfilePictureEvent);
    };
  }, [clearLocalState, loadProfilePicture, user?.id]);

  return {
    profilePictureUrl,
    originalImageUrl,
    loading,
    exists,
    imageLoadError,
    updateProfilePicture,
    clearProfilePicture,
    handleImageError,
    refresh: () => loadProfilePicture(true),
    getProfilePictureUrlWithFallback,
    getProfilePictureUrlForEdit,
  };
};
