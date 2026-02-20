'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Modal, Spinner } from 'flowbite-react';
import { HiCheck, HiX, HiRefresh } from 'react-icons/hi';

interface ProfilePictureEditorProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (payload: {
    blob?: Blob;
    position: { x: number; y: number };
    scale: number;
    sourceUrl: string;
  }) => void;
  onError?: (error: string) => void;
}

export default function ProfilePictureEditor({
  isOpen,
  imageUrl,
  onClose,
  onSave,
  onError,
}: ProfilePictureEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canSave, setCanSave] = useState(true);

  // Canvas dimensions (circular crop area)
  const CANVAS_SIZE = 300;
  const CROP_RADIUS = CANVAS_SIZE / 2;

  // Load image when modal opens
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setLoading(true);
    console.log('[ProfilePictureEditor] Loading image:', imageUrl);

    const loadImage = () => {
      // If it's a data or blob URL, load directly without proxy/CORS tricks
      if (/^(data:|blob:)/i.test(imageUrl)) {
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
          setImage(img);
          setCanSave(true);
          const centerX = (CANVAS_SIZE - img.width * scale) / 2;
          const centerY = (CANVAS_SIZE - img.height * scale) / 2;
          setPosition({ x: centerX, y: centerY });
          setLoading(false);
          drawCanvas(img, { x: centerX, y: centerY }, scale);
        };
        img.onerror = () => {
          console.warn('[ProfilePictureEditor] Failed to load data/blob URL');
          onError?.('Failed to load selected image.');
          setLoading(false);
        };
        return;
      }

      // No need for presigned URL detection with local storage

      // Build attempts list - for frontend static images
      const attempts: Array<() => HTMLImageElement> = [];

      // Frontend static image - direct loading
      attempts.push(() => {
        console.log('[ProfilePictureEditor] Loading frontend static image:', imageUrl);
        const img = new Image();
        // Static images from frontend public directory load directly
        img.src = imageUrl;
        (img as any)._canSave = true;
        return img;
      });

      // Fallback with cache busting if first attempt fails
      attempts.push(() => {
        console.log('[ProfilePictureEditor] Trying with cache busting:', imageUrl);
        const img = new Image();
        const imageUrlWithCache = imageUrl.includes('?')
          ? `${imageUrl}&t=${Date.now()}`
          : `${imageUrl}?t=${Date.now()}`;
        img.src = imageUrlWithCache;
        (img as any)._canSave = true;
        return img;
      });

      let currentAttempt = 0;

      const tryNextAttempt = () => {
        if (currentAttempt >= attempts.length) {
          console.warn('[ProfilePictureEditor] All attempts failed');
          setLoading(false);
          onError?.('Failed to load image for editing.');
          return;
        }

        const img = attempts[currentAttempt]!();
        if (!img) {
          // Defensive: skip if an attempt returned a falsy value
          currentAttempt++;
          tryNextAttempt();
          return;
        }
        currentAttempt++;

        img.onload = () => {
          console.log(
            `[ProfilePictureEditor] Attempt ${currentAttempt} succeeded:`,
            img.width,
            'x',
            img.height,
          );
          setImage(img);
          setCanSave((img as any)._canSave !== false);
          const centerX = (CANVAS_SIZE - img.width * scale) / 2;
          const centerY = (CANVAS_SIZE - img.height * scale) / 2;
          setPosition({ x: centerX, y: centerY });
          setLoading(false);
          drawCanvas(img, { x: centerX, y: centerY }, scale);
        };

        img.onerror = () => {
          console.warn(`[ProfilePictureEditor] Attempt ${currentAttempt} failed`);
          tryNextAttempt();
        };
      };

      // Start with first attempt
      tryNextAttempt();
    };

    loadImage();
  }, [isOpen, imageUrl]);

  // Draw image on canvas
  const drawCanvas = useCallback(
    (img: HTMLImageElement, pos: { x: number; y: number }, currentScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Save context
      ctx.save();

      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(CROP_RADIUS, CROP_RADIUS, CROP_RADIUS, 0, 2 * Math.PI);
      ctx.clip();

      // Draw image
      ctx.drawImage(img, pos.x, pos.y, img.width * currentScale, img.height * currentScale);

      // Restore context
      ctx.restore();

      // Draw circular border
      ctx.beginPath();
      ctx.arc(CROP_RADIUS, CROP_RADIUS, CROP_RADIUS, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [],
  );

  // Handle mouse/touch events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left - position.x,
        y: e.clientY - rect.top - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !image) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const newPos = {
        x: e.clientX - rect.left - dragStart.x,
        y: e.clientY - rect.top - dragStart.y,
      };
      setPosition(newPos);
      drawCanvas(image, newPos, scale);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle scale changes
  const handleScaleChange = (newScale: number) => {
    if (!image) return;
    setScale(newScale);
    drawCanvas(image, position, newScale);
  };

  // Center image helper
  const centerImage = () => {
    if (!image) return;
    const centerX = (CANVAS_SIZE - image.width * scale) / 2;
    const centerY = (CANVAS_SIZE - image.height * scale) / 2;
    const newPos = { x: centerX, y: centerY };
    setPosition(newPos);
    drawCanvas(image, newPos, scale);
  };

  // Save cropped image
  const handleSave = async () => {
    if (!image || !canvasRef.current) return;
    if (!canSave) {
      // Fallback to server-side crop by sending transform params
      onSave({ position, scale, sourceUrl: imageUrl });
      return;
    }

    setSaving(true);
    try {
      // Create a new canvas for the final cropped image
      const outputCanvas = document.createElement('canvas');
      const outputSize = 300; // Final output size
      outputCanvas.width = outputSize;
      outputCanvas.height = outputSize;

      const ctx = outputCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
      ctx.clip();

      // Draw the positioned and scaled image
      ctx.drawImage(image, position.x, position.y, image.width * scale, image.height * scale);

      // Convert to blob
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(
              '[ProfilePictureEditor] Client-side crop successful, blob size:',
              blob.size,
            );
            onSave({ blob, position, scale, sourceUrl: imageUrl });
          } else {
            console.log('[ProfilePictureEditor] toBlob failed, falling back to server-side crop');
            // Fallback to server-side crop if client-side fails
            onSave({ position, scale, sourceUrl: imageUrl });
          }
          setSaving(false);
        },
        'image/jpeg',
        0.9,
      );
    } catch (error) {
      console.log('[ProfilePictureEditor] Client-side crop error:', error);
      setSaving(false);
      // Fallback to server-side crop instead of showing error
      console.log('[ProfilePictureEditor] Falling back to server-side crop');
      onSave({ position, scale, sourceUrl: imageUrl });
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center space-x-2">
          <span>Position Your Profile Picture</span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-4">
          {/* Loading state */}
          {loading && (
            <div className="flex justify-center items-center h-64">
              <Spinner size="xl" />
              <span className="ml-2">Loading image...</span>
            </div>
          )}

          {/* Canvas for image editing */}
          {!loading && (
            <div className="flex flex-col items-center space-y-4">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="border-2 border-gray-200 rounded-full cursor-move bg-gray-50"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Drag the image to position your face in the center of the circle
              </p>
            </div>
          )}

          {/* Controls */}
          {!loading && (
            <div className="space-y-4">
              {/* Zoom controls */}
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[50px]">
                  Zoom:
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={scale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[40px]">
                  {Math.round(scale * 100)}%
                </span>
              </div>

              {/* Helper buttons */}
              <div className="flex justify-center">
                <Button size="sm" color="gray" onClick={centerImage}>
                  <HiRefresh className="mr-2 h-4 w-4" />
                  Center Image
                </Button>
              </div>
              {/* No CORS notice removed per request */}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-end space-x-2 w-full">
          <Button color="gray" onClick={onClose}>
            <HiX className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button color="blue" onClick={centerImage} disabled={loading}>
            <HiRefresh className="mr-2 h-4 w-4" />
            Center
          </Button>
          <Button color="success" onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <HiCheck className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
