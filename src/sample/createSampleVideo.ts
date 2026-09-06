/**
 * Procedural Synthetic Video Generator for Forensic Demonstration.
 * Generates an offline 30 FPS evidence clip with burnt-in timecode, moving targets,
 * and high-contrast calibration patterns using native HTML5 Canvas and MediaRecorder.
 */

import { VideoMetadata } from '../types';
import { msToTimecode } from '../utils/timecode';

export interface SampleVideoResult {
  blob: Blob;
  url: string;
  metadata: VideoMetadata;
  revoke: () => void;
}

export interface SampleVideoOptions {
  durationMs?: number;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Draws a single forensic video frame onto a 2D rendering context.
 *
 * @param ctx - Target 2D canvas context.
 * @param frameIndex - Current zero-indexed frame count.
 * @param totalFrames - Total frames in sequence.
 * @param width - Canvas pixel width.
 * @param height - Canvas pixel height.
 * @param fps - Target playback frames per second.
 */
export function drawForensicFrame(
  ctx: CanvasRenderingContext2D,
  frameIndex: number,
  totalFrames: number,
  width: number,
  height: number,
  fps: number
): void {
  const currentMs = Math.round((frameIndex / fps) * 1000);
  const timecode = msToTimecode(currentMs, fps).formatted;
  const progress = frameIndex / Math.max(1, totalFrames);

  // 1. Dark forensic background with subtle grid lines
  ctx.fillStyle = '#09090b'; // Tailwind zinc-950
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#27272a'; // Tailwind zinc-800
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Camera branding and stream HUD in top header
  ctx.fillStyle = '#ef4444'; // Recording red dot
  ctx.beginPath();
  ctx.arc(36, 36, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 16px "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText('REC', 52, 42);

  ctx.fillStyle = '#a1a1aa'; // Zinc-400
  ctx.font = '14px "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText('CAM-04 (NORTH CONCOURSE)', 100, 42);
  ctx.fillText(`FPS: ${fps} | RES: ${width}x${height}`, width - 240, 42);

  // 3. High-visibility burnt-in timecode and millisecond display
  ctx.fillStyle = '#09090b';
  ctx.fillRect(28, 64, 380, 52);
  ctx.strokeStyle = '#3f3f46';
  ctx.strokeRect(28, 64, 380, 52);

  ctx.fillStyle = '#22c55e'; // Forensic phosphor green
  ctx.font = 'bold 26px "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText(`TC: ${timecode}`, 40, 100);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '14px "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText(`FRAME: ${frameIndex.toString().padStart(4, '0')} | ${currentMs}ms`, 240, 100);

  // 4. Target 1: Simulated Suspect Face (Oscillating circular target)
  // Moves horizontally back and forth with vertical sine oscillation
  const faceX = 160 + (width - 360) * (0.5 + 0.45 * Math.sin(progress * Math.PI * 2));
  const faceY = height * 0.35 + 40 * Math.cos(progress * Math.PI * 4);
  const faceRadius = 46;

  // Outer target circle
  ctx.fillStyle = '#eab308'; // Amber-500
  ctx.beginPath();
  ctx.arc(faceX, faceY, faceRadius, 0, Math.PI * 2);
  ctx.fill();

  // Face features for blur/pixelate verification
  ctx.fillStyle = '#713f12';
  ctx.beginPath();
  ctx.arc(faceX - 16, faceY - 12, 6, 0, Math.PI * 2); // Left eye
  ctx.arc(faceX + 16, faceY - 12, 6, 0, Math.PI * 2); // Right eye
  ctx.fill();

  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(faceX, faceY + 12, 18, 0.2 * Math.PI, 0.8 * Math.PI, false); // Smile
  ctx.stroke();

  // Target 1 forensic label tag
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('TARGET: SUSPECT FACE', faceX - 60, faceY - faceRadius - 8);

  // 5. Target 2: Simulated License Plate (Translating vehicle plate)
  const plateWidth = 140;
  const plateHeight = 50;
  const plateX = 80 + (width - 300) * progress;
  const plateY = height * 0.72;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(plateX, plateY, plateWidth, plateHeight);
  ctx.strokeStyle = '#1e3a8a'; // Blue border
  ctx.lineWidth = 2;
  ctx.strokeRect(plateX, plateY, plateWidth, plateHeight);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('CALIFORNIA', plateX + 38, plateY + 14);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "SF Mono", monospace';
  ctx.fillText('9XYZ410', plateX + 18, plateY + 38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('TARGET: VEHICLE PLATE', plateX, plateY - 8);

  // 6. Forensic Color Calibration Bar (Bottom-right corner)
  const barWidth = 24;
  const barHeight = 20;
  const barColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ffffff'];
  const startX = width - barColors.length * barWidth - 28;
  const startY = height - barHeight - 20;

  for (let i = 0; i < barColors.length; i++) {
    ctx.fillStyle = barColors[i] || '#ffffff';
    ctx.fillRect(startX + i * barWidth, startY, barWidth, barHeight);
  }
}

/**
 * Creates a synthetic mock evidence video file in memory using HTML5 Canvas
 * and MediaRecorder.
 *
 * @param options - Video generation settings (duration, dimensions, fps).
 * @returns Promise resolving to the created blob, Object URL, and metadata.
 */
export async function createSampleVideo(
  options: SampleVideoOptions = {}
): Promise<SampleVideoResult> {
  const {
    durationMs = 5000,
    fps = 30,
    width = 1280,
    height = 720,
    onProgress
  } = options;

  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const frameDurationMs = 1000 / fps;

  const metadata: VideoMetadata = {
    name: 'synthetic_cctv_evidence.mp4',
    durationMs,
    dimensions: { width, height },
    fps,
    mimeType: 'video/mp4'
  };

  // Support environments without DOM canvas (e.g. Node.js unit tests without JSDOM canvas support)
  if (typeof document === 'undefined') {
    const mockBlob = new Blob(['mock-video-bytes'], { type: 'video/mp4' });
    return {
      blob: mockBlob,
      url: 'blob:mock-video-url',
      metadata,
      revoke: () => {}
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to acquire 2D graphics context for synthetic video generator.');
  }

  // If captureStream or MediaRecorder is unsupported in this environment (e.g. JSDOM),
  // return a mock blob with canvas snapshot fallback.
  const hasCaptureStream = typeof canvas.captureStream === 'function';
  const hasMediaRecorder = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  if (!hasCaptureStream || !hasMediaRecorder) {
    // Render the initial frame so the canvas is populated
    drawForensicFrame(ctx, 0, totalFrames, width, height, fps);
    const mockBlob = new Blob(['mock-video-stream-fallback'], { type: 'video/mp4' });
    const url = URL.createObjectURL(mockBlob);
    return {
      blob: mockBlob,
      url,
      metadata,
      revoke: () => {
        URL.revokeObjectURL(url);
      }
    };
  }

  // In supported browser environments: use captureStream and MediaRecorder
  return new Promise<SampleVideoResult>((resolve, reject) => {
    try {
      const stream = canvas.captureStream(fps);
      const mimeTypes = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const selectedMime = mimeTypes.find(m => window.MediaRecorder.isTypeSupported(m)) || '';

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onerror = (err) => {
        reject(err);
      };

      recorder.onstop = () => {
        const outputBlob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
        const url = URL.createObjectURL(outputBlob);
        resolve({
          blob: outputBlob,
          url,
          metadata: {
            ...metadata,
            mimeType: selectedMime || 'video/mp4',
            sizeBytes: outputBlob.size
          },
          revoke: () => {
            URL.revokeObjectURL(url);
          }
        });
      };

      recorder.start();

      let currentFrame = 0;
      const intervalId = setInterval(() => {
        if (currentFrame >= totalFrames) {
          clearInterval(intervalId);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          return;
        }

        drawForensicFrame(ctx, currentFrame, totalFrames, width, height, fps);
        currentFrame++;

        if (onProgress) {
          onProgress(currentFrame / totalFrames);
        }
      }, frameDurationMs);
    } catch (err) {
      reject(err);
    }
  });
}
