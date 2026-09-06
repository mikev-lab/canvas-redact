/**
 * High-resolution face avatar thumbnail crop extractor.
 * Crops a padded, square face region from video frames for gallery preview.
 */

import { NormalizedBBoxTuple } from '../types';

/**
 * Extracts a square, padded thumbnail crop from a canvas or video frame.
 *
 * @param source - Source canvas or video element.
 * @param bbox - Normalized bounding box [x, y, width, height] in [0.0 .. 1.0].
 * @param frameWidth - Video frame width in pixels.
 * @param frameHeight - Video frame height in pixels.
 * @param outputSize - Target square output size in pixels (default: 96).
 * @returns Base64 data URL string representing the cropped image.
 */
export function extractFaceThumbnail(
  source: CanvasImageSource,
  bbox: NormalizedBBoxTuple,
  frameWidth: number,
  frameHeight: number,
  outputSize: number = 96
): string {
  if (frameWidth <= 0 || frameHeight <= 0) {
    return createPlaceholderAvatar(outputSize);
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return createPlaceholderAvatar(outputSize);
    }

    // Convert normalized coordinates to source pixel dimensions
    const rawX = bbox[0] * frameWidth;
    const rawY = bbox[1] * frameHeight;
    const rawW = bbox[2] * frameWidth;
    const rawH = bbox[3] * frameHeight;

    // Pad by 25% around face to include chin and hair context for auditor recognition
    const padX = rawW * 0.25;
    const padY = rawH * 0.25;

    let srcX = Math.max(0, rawX - padX);
    let srcY = Math.max(0, rawY - padY);
    let srcW = Math.min(frameWidth - srcX, rawW + padX * 2);
    let srcH = Math.min(frameHeight - srcY, rawH + padY * 2);

    // Make crop region approximately square
    const maxDim = Math.max(srcW, srcH);
    srcW = Math.min(maxDim, frameWidth - srcX);
    srcH = Math.min(maxDim, frameHeight - srcY);

    if (srcW <= 0 || srcH <= 0) {
      return createPlaceholderAvatar(outputSize);
    }

    ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, outputSize, outputSize);

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    // Fallback if security origin or headless canvas context fails
    return createPlaceholderAvatar(outputSize);
  }
}

/**
 * Creates a clean SVG placeholder avatar for headless tests or unreadable canvases.
 *
 * @param size - Avatar size in pixels.
 * @returns SVG data URL.
 */
export function createPlaceholderAvatar(size: number = 96): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" fill="none">
    <rect width="96" height="96" rx="8" fill="#18181b"/>
    <circle cx="48" cy="38" r="18" fill="#3f3f46"/>
    <path d="M22 82C22 66 34 58 48 58C62 58 74 66 74 82" fill="#3f3f46"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
