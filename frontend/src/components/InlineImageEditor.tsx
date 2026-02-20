'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Spinner } from 'flowbite-react';
import { HiRefresh, HiSave, HiX } from 'react-icons/hi';

interface InlineImageEditorProps {
  imageUrl: string;
  onSave: (payload: {
    blob?: Blob;
    position: { x: number; y: number };
    scale: number;
    sourceUrl: string;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export default function InlineImageEditor({
  imageUrl,
  onSave,
  onCancel,
  loading = false,
  className = '',
}: InlineImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(true);
  const [canSave, setCanSave] = useState(true);

  // Canvas dimensions (circular crop area)
  const CANVAS_SIZE = 300;
  const CROP_RADIUS = CANVAS_SIZE / 2;

  // Load image when component mounts or imageUrl changes
  useEffect(() => {
    if (!imageUrl) return;

    setImageLoading(true);
    console.log('[InlineImageEditor] Loading image:', imageUrl);

    const loadImage = () => {
      const img = new Image();

      // Handle different image types
      if (/^(data:|blob:)/i.test(imageUrl)) {
        img.src = imageUrl;
      } else {
        // For static images, load directly
        img.src = imageUrl;
      }

      img.onload = () => {
        console.log(`[InlineImageEditor] Image loaded: ${img.width}x${img.height}`);
        setImage(img);
        setCanSave(true);

        // Center image initially
        const centerX = (CANVAS_SIZE - img.width * scale) / 2;
        const centerY = (CANVAS_SIZE - img.height * scale) / 2;
        setPosition({ x: centerX, y: centerY });
        setImageLoading(false);

        // Draw initial image
        drawCanvas(img, { x: centerX, y: centerY }, scale);
      };

      img.onerror = () => {
        console.warn('[InlineImageEditor] Failed to load image:', imageUrl);
        setImageLoading(false);
        setCanSave(false);
      };
    };

    loadImage();
  }, [imageUrl, scale]);

  // Draw image on canvas with circular crop
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
    if (!image || loading) return;
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
    if (!isDragging || !image || loading) return;

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
    if (!image || loading) return;
    setScale(newScale);
    drawCanvas(image, position, newScale);
  };

  // Center image helper
  const centerImage = () => {
    if (!image || loading) return;
    const centerX = (CANVAS_SIZE - image.width * scale) / 2;
    const centerY = (CANVAS_SIZE - image.height * scale) / 2;
    const newPos = { x: centerX, y: centerY };
    setPosition(newPos);
    drawCanvas(image, newPos, scale);
  };

  // Save cropped image
  const handleSave = async () => {
    if (!image || !canvasRef.current || !canSave || loading) return;

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
            console.log('[InlineImageEditor] Client-side crop successful, blob size:', blob.size);
            onSave({ blob, position, scale, sourceUrl: imageUrl });
          } else {
            console.log('[InlineImageEditor] toBlob failed, falling back to server-side crop');
            // Fallback to server-side crop if client-side fails
            onSave({ position, scale, sourceUrl: imageUrl });
          }
        },
        'image/jpeg',
        0.9,
      );
    } catch (error) {
      console.log('[InlineImageEditor] Client-side crop error:', error);
      // Fallback to server-side crop instead of showing error
      console.log('[InlineImageEditor] Falling back to server-side crop');
      onSave({ position, scale, sourceUrl: imageUrl });
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Loading state */}
      {imageLoading && (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
          <span className="ml-2">Loading image...</span>
        </div>
      )}

      {/* Image Editor */}
      {!imageLoading && image && (
        <>
          {/* Canvas for image editing */}
          <div className="flex flex-col items-center space-y-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`border-2 border-gray-200 rounded-full cursor-move bg-gray-50 ${
                loading ? 'pointer-events-none opacity-50' : ''
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">
              Drag the image to position it within the circle
            </p>
          </div>

          {/* Zoom Controls */}
          <div className="w-full max-w-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Zoom:</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {Math.round(scale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              disabled={loading}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>50%</span>
              <span>300%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button size="sm" color="gray" onClick={centerImage} disabled={loading}>
              <HiRefresh className="mr-2 h-4 w-4" />
              Center Image
            </Button>

            <Button color="blue" onClick={handleSave} disabled={loading || !canSave}>
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>

            <Button color="gray" onClick={onCancel} disabled={loading}>
              <HiX className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </>
      )}

      {/* Error state */}
      {!imageLoading && !image && (
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">Failed to load image for editing.</p>
        </div>
      )}
    </div>
  );
}
