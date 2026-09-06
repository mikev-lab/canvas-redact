import { TimecodeParts } from '../types';

/**
 * Decomposes a continuous millisecond timestamp into hours, minutes, seconds, frames,
 * and a standard SMPTE timecode string in the format HH:MM:SS:FF.
 *
 * @param ms - Continuous time in milliseconds.
 * @param fps - Target video frame rate in frames per second (default: 30).
 * @returns TimecodeParts object containing decomposed time elements and formatted string.
 *
 * @remarks
 * Clamps negative millisecond values to 0. Employs Math.floor on frame calculations
 * to match standard non-drop-frame video editing timecode conventions.
 */
export function msToTimecode(ms: number, fps: number = 30): TimecodeParts {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const remainderMs = safeMs % 1000;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((remainderMs / 1000) * fps);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;

  return { hours, minutes, seconds, frames, formatted };
}

/**
 * Parses a standard SMPTE timecode string (HH:MM:SS:FF) into continuous milliseconds.
 *
 * @param timecode - Timecode string in HH:MM:SS:FF format.
 * @param fps - Target video frame rate in frames per second (default: 30).
 * @returns Timestamp in milliseconds.
 *
 * @throws Error if the provided timecode string does not match the HH:MM:SS:FF format.
 */
export function timecodeToMs(timecode: string, fps: number = 30): number {
  const parts = timecode.trim().split(':');
  if (parts.length !== 4) {
    throw new Error(`Invalid timecode format: "${timecode}". Expected HH:MM:SS:FF`);
  }

  const [hStr, mStr, sStr, fStr] = parts;
  const hours = parseInt(hStr || '0', 10);
  const minutes = parseInt(mStr || '0', 10);
  const seconds = parseInt(sStr || '0', 10);
  const frames = parseInt(fStr || '0', 10);

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(frames)) {
    throw new Error(`Invalid numeric values in timecode: "${timecode}"`);
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const frameMs = (frames / fps) * 1000;

  return totalSeconds * 1000 + Math.round(frameMs);
}

/**
 * Calculates a new timestamp by stepping forward or backward by an exact integer number of frames.
 *
 * @param currentMs - Current playback timestamp in milliseconds.
 * @param deltaFrames - Number of frames to step (e.g. +1, -1, +30, -30).
 * @param durationMs - Total video duration in milliseconds for clamping boundaries.
 * @param fps - Video frame rate (default: 30).
 * @returns New timestamp in milliseconds clamped strictly to [0, durationMs].
 *
 * @remarks
 * Operates on discrete integer frame indices:
 * targetFrame = round(currentMs / frameDuration) + deltaFrames
 * This eliminates accumulated floating-point rounding drift (e.g. 0.03333333333333333... accumulation).
 */
export function stepFrameTime(
  currentMs: number,
  deltaFrames: number,
  durationMs: number,
  fps: number = 30
): number {
  if (durationMs <= 0) {
    return 0;
  }

  const frameDurationMs = 1000 / fps;
  const currentFrame = Math.round(currentMs / frameDurationMs);
  const targetFrame = currentFrame + deltaFrames;

  const rawTargetMs = targetFrame * frameDurationMs;
  return Math.max(0, Math.min(durationMs, rawTargetMs));
}

/**
 * Formats a duration in milliseconds into a compact display string: MM:SS.s.
 *
 * @param ms - Duration in milliseconds.
 * @returns Formatted duration string: e.g. "02:14.5".
 */
export function formatCompactDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeMs % 1000) / 100);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
}
