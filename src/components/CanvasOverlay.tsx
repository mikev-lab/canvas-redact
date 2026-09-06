/**
 * High-performance 2D Canvas overlay for real-time video redaction rendering.
 * Executes synchronized 60 FPS RAF loop applying Gaussian blur, pixelation,
 * and blackout censorship with interactive 8-point resize handles.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { RedactionBox, NormalizedBBoxTuple, ResizeHandle } from '../types';
import {
  getHandlePositions
} from '../utils/coordinates';
import {
  applyBlur,
  applyPixelate,
  applyBlackout,
  drawBoundingBoxOutline,
  drawResizeHandles
} from '../utils/filters';

export interface CanvasOverlayProps {
  /** Target canvas DOM reference */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Underlying video DOM reference */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Active redaction bounding boxes visible at current timestamp */
  activeRedactions: RedactionBox[];
  /** Currently selected redaction ID or null */
  selectedId: string | null;
  /** Active real-time drag/resize bounding box preview */
  currentDragRect: NormalizedBBoxTuple | null;
  /** Currently active resize handle during dragging */
  activeHandle: ResizeHandle | null;
  /** Active CSS cursor string */
  cursorStyle: string;
  /** Whether the video is actively playing forward */
  isPlaying: boolean;
  /** Current continuous timestamp in milliseconds */
  currentTimeMs: number;
  /** Intrinsic video frame dimensions */
  videoDimensions: { width: number; height: number };
  /** Pointer down interaction handler */
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  /** Pointer move interaction handler */
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/**
 * 60 FPS Canvas Redaction Rendering Layer.
 */
export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  canvasRef,
  videoRef,
  activeRedactions,
  selectedId,
  currentDragRect,
  activeHandle,
  cursorStyle,
  isPlaying,
  currentTimeMs,
  videoDimensions,
  onPointerDown,
  onPointerMove
}) => {
  // Static scratch canvas reused across frames for pixelation (zero allocation)
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  if (!scratchCanvasRef.current && typeof document !== 'undefined') {
    scratchCanvasRef.current = document.createElement('canvas');
  }

  // Master render frame routine
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const scratch = scratchCanvasRef.current;
    if (!canvas || !video || !scratch) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    if (displayWidth <= 0 || displayHeight <= 0) return;

    // Synchronize canvas backing buffer dimensions to physical device pixels
    const targetBufferWidth = Math.round(displayWidth * dpr);
    const targetBufferHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== targetBufferWidth || canvas.height !== targetBufferHeight) {
      canvas.width = targetBufferWidth;
      canvas.height = targetBufferHeight;
    }

    ctx.save();
    // Scale coordinate system to match CSS screen units
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // 1. Render all active redactions valid for current timestamp
    for (const redaction of activeRedactions) {
      const isSelected = redaction.id === selectedId;

      // If this box is actively being translated/resized, skip drawing its base state
      if (isSelected && currentDragRect) {
        continue;
      }

      const [normX, normY, normW, normH] = redaction.bbox;
      const renderRect = {
        x: normX * displayWidth,
        y: normY * displayHeight,
        width: normW * displayWidth,
        height: normH * displayHeight
      };

      // Apply selected redaction visual treatment
      if (redaction.type === 'blur') {
        applyBlur(ctx, video, renderRect, displayWidth, displayHeight, 14);
      } else if (redaction.type === 'pixelate') {
        applyPixelate(ctx, video, scratch, renderRect, videoDimensions, redaction.bbox, 10);
      } else if (redaction.type === 'blackout') {
        applyBlackout(ctx, renderRect, redaction.label);
      }

      // Draw bounding box outlines with category-specific colors
      drawBoundingBoxOutline(ctx, renderRect, isSelected, redaction.label, redaction.type);

      // Draw 8 interactive handles if selected
      if (isSelected) {
        const handlePositions = getHandlePositions(redaction.bbox, rect);
        drawResizeHandles(ctx, handlePositions, activeHandle, rect, 8);
      }
    }

    // 2. Render real-time active gesture preview (drawing / moving / resizing)
    if (currentDragRect) {
      const [dragX, dragY, dragW, dragH] = currentDragRect;
      const previewRect = {
        x: dragX * displayWidth,
        y: dragY * displayHeight,
        width: dragW * displayWidth,
        height: dragH * displayHeight
      };

      // Semi-transparent high-contrast preview treatment
      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Blue-500 with 20% opacity
      ctx.fillRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);

      ctx.strokeStyle = '#38bdf8'; // Sky-400
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
      ctx.restore();

      // Render handles around active preview rect
      const previewHandles = getHandlePositions(currentDragRect, rect);
      drawResizeHandles(ctx, previewHandles, activeHandle, rect, 8);
    }

    ctx.restore();
  }, [
    canvasRef,
    videoRef,
    activeRedactions,
    selectedId,
    currentDragRect,
    activeHandle,
    videoDimensions
  ]);

  // Active render loop synchronized to playback state or interaction
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      renderFrame();

      if (isPlaying) {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      rafIdRef.current = requestAnimationFrame(loop);
    } else {
      // Redraw once on paused interaction
      renderFrame();
    }

    return () => {
      active = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, currentTimeMs, renderFrame]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={{ cursor: cursorStyle }}
      className="absolute inset-0 w-full h-full z-10 touch-none"
      role="region"
      aria-label="Forensic video redaction interactive canvas overlay"
      tabIndex={0}
    />
  );
};
