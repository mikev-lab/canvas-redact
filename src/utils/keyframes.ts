/**
 * Pure mathematical utilities for trajectory keyframe interpolation,
 * chronological upserting, removal, and nearest-neighbor timecode queries.
 */

import { NormalizedBBoxTuple, RedactionKeyframe } from '../types';
import { clamp } from './coordinates';

/**
 * Rounds a floating point scalar to 6 decimal places to prevent IEEE 754 precision drift.
 *
 * @param val - Floating point number.
 * @returns Precision-clamped scalar.
 */
function round6(val: number): number {
  return Math.round(val * 1000000) / 1000000;
}

/**
 * Evaluates the interpolated bounding box at an arbitrary media timestamp
 * using continuous piecewise linear interpolation across keyframe snapshots.
 *
 * @param keyframes - Chronologically ordered sequence of keyframes, or undefined.
 * @param defaultBbox - Fallback bounding box tuple if keyframes array is empty.
 * @param timeMs - Target media timestamp in continuous milliseconds.
 * @returns NormalizedBBoxTuple [x, y, width, height] clamped strictly to [0.0, 1.0].
 *
 * @remarks
 * If keyframes is empty or undefined, returns defaultBbox.
 * If timeMs is before the first keyframe, clamps to the first keyframe.
 * If timeMs is after the last keyframe, clamps to the last keyframe.
 * Otherwise, performs element-wise linear interpolation between surrounding keyframes.
 */
export function interpolateBBox(
  keyframes: RedactionKeyframe[] | undefined,
  defaultBbox: NormalizedBBoxTuple,
  timeMs: number
): NormalizedBBoxTuple {
  if (!keyframes || keyframes.length === 0) {
    return defaultBbox;
  }

  const firstKeyframe = keyframes[0];
  if (!firstKeyframe) {
    return defaultBbox;
  }

  if (keyframes.length === 1) {
    return firstKeyframe.bbox;
  }

  // Boundary conditions: clamp to extremes
  if (timeMs <= firstKeyframe.timeMs) {
    return firstKeyframe.bbox;
  }

  const lastKeyframe = keyframes[keyframes.length - 1];
  if (!lastKeyframe || timeMs >= lastKeyframe.timeMs) {
    return lastKeyframe ? lastKeyframe.bbox : defaultBbox;
  }

  // Find bounding keyframe interval [k_i, k_{i+1}]
  let prevKeyframe: RedactionKeyframe = firstKeyframe;
  let nextKeyframe: RedactionKeyframe = keyframes[1] ?? firstKeyframe;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const curr = keyframes[i];
    const next = keyframes[i + 1];
    if (curr && next && timeMs >= curr.timeMs && timeMs <= next.timeMs) {
      prevKeyframe = curr;
      nextKeyframe = next;
      break;
    }
  }

  const deltaMs = nextKeyframe.timeMs - prevKeyframe.timeMs;
  if (deltaMs <= 0) {
    return prevKeyframe.bbox;
  }

  const alpha = (timeMs - prevKeyframe.timeMs) / deltaMs;
  const [x1, y1, w1, h1] = prevKeyframe.bbox;
  const [x2, y2, w2, h2] = nextKeyframe.bbox;

  const interpX = x1 + alpha * (x2 - x1);
  const interpY = y1 + alpha * (y2 - y1);
  const interpW = w1 + alpha * (w2 - w1);
  const interpH = h1 + alpha * (h2 - h1);

  const clampedX = round6(clamp(interpX, 0, 1));
  const clampedY = round6(clamp(interpY, 0, 1));
  const clampedW = round6(clamp(interpW, 0, 1 - clampedX));
  const clampedH = round6(clamp(interpH, 0, 1 - clampedY));

  return [clampedX, clampedY, clampedW, clampedH];
}

/**
 * Upserts a keyframe snapshot into a keyframe collection.
 * If an existing keyframe is within thresholdMs, updates its bounding box in place.
 * Otherwise, inserts the keyframe and maintains ascending chronological order.
 *
 * @param keyframes - Existing keyframe array or undefined.
 * @param timeMs - Target timestamp in milliseconds.
 * @param bbox - Normalized bounding box tuple to record.
 * @param thresholdMs - Proximity threshold in ms to treat as same keyframe (default: 16ms).
 * @returns New array containing the upserted keyframe list.
 */
export function upsertKeyframe(
  keyframes: RedactionKeyframe[] | undefined,
  timeMs: number,
  bbox: NormalizedBBoxTuple,
  thresholdMs: number = 16
): RedactionKeyframe[] {
  const currentList = keyframes ? [...keyframes] : [];
  const existingIndex = currentList.findIndex(
    k => Math.abs(k.timeMs - timeMs) <= thresholdMs
  );

  const [normX, normY, normW, normH] = bbox;
  const clampedX = round6(clamp(normX, 0, 1));
  const clampedY = round6(clamp(normY, 0, 1));
  const clampedW = round6(clamp(normW, 0, 1 - clampedX));
  const clampedH = round6(clamp(normH, 0, 1 - clampedY));
  const sanitizedBbox: NormalizedBBoxTuple = [clampedX, clampedY, clampedW, clampedH];

  if (existingIndex !== -1) {
    currentList[existingIndex] = {
      timeMs,
      bbox: sanitizedBbox
    };
  } else {
    currentList.push({
      timeMs,
      bbox: sanitizedBbox
    });
  }

  // Sort ascending by timestamp
  return currentList.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Removes any keyframe within thresholdMs of the specified timestamp.
 *
 * @param keyframes - Existing keyframe array or undefined.
 * @param timeMs - Target timestamp in milliseconds.
 * @param thresholdMs - Proximity window in ms (default: 16ms).
 * @returns Filtered keyframe array.
 */
export function removeKeyframeNear(
  keyframes: RedactionKeyframe[] | undefined,
  timeMs: number,
  thresholdMs: number = 16
): RedactionKeyframe[] {
  if (!keyframes || keyframes.length === 0) return [];
  return keyframes.filter(k => Math.abs(k.timeMs - timeMs) > thresholdMs);
}

/**
 * Finds the immediately preceding and succeeding keyframes relative to a given timestamp.
 *
 * @param keyframes - Chronologically ordered keyframe list.
 * @param timeMs - Current playback timestamp in milliseconds.
 * @returns Object with prev and next keyframe references, or null if none exist.
 */
export function findSurroundingKeyframes(
  keyframes: RedactionKeyframe[] | undefined,
  timeMs: number
): { prev: RedactionKeyframe | null; next: RedactionKeyframe | null } {
  if (!keyframes || keyframes.length === 0) {
    return { prev: null, next: null };
  }

  let prev: RedactionKeyframe | null = null;
  let next: RedactionKeyframe | null = null;

  for (let i = 0; i < keyframes.length; i++) {
    const k = keyframes[i];
    if (!k) continue;
    if (k.timeMs < timeMs - 1) {
      prev = k;
    } else if (k.timeMs > timeMs + 1 && !next) {
      next = k;
      break;
    }
  }

  return { prev, next };
}
