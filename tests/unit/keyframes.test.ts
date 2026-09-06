import { describe, it, expect } from 'vitest';
import {
  interpolateBBox,
  upsertKeyframe,
  removeKeyframeNear,
  findSurroundingKeyframes
} from '../../src/utils/keyframes';
import { NormalizedBBoxTuple, RedactionKeyframe } from '../../src/types';

describe('keyframes utility mathematics', () => {
  const defaultBbox: NormalizedBBoxTuple = [0.1, 0.1, 0.2, 0.2];

  describe('interpolateBBox', () => {
    it('returns defaultBbox when keyframes array is undefined or empty', () => {
      expect(interpolateBBox(undefined, defaultBbox, 1000)).toEqual(defaultBbox);
      expect(interpolateBBox([], defaultBbox, 1000)).toEqual(defaultBbox);
    });

    it('returns single keyframe bbox regardless of query timecode', () => {
      const single: RedactionKeyframe[] = [
        { timeMs: 2000, bbox: [0.2, 0.3, 0.4, 0.5] }
      ];
      expect(interpolateBBox(single, defaultBbox, 500)).toEqual([0.2, 0.3, 0.4, 0.5]);
      expect(interpolateBBox(single, defaultBbox, 2000)).toEqual([0.2, 0.3, 0.4, 0.5]);
      expect(interpolateBBox(single, defaultBbox, 8000)).toEqual([0.2, 0.3, 0.4, 0.5]);
    });

    it('clamps to first keyframe when timecode precedes it', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.2, 0.2] },
        { timeMs: 3000, bbox: [0.5, 0.5, 0.2, 0.2] }
      ];
      expect(interpolateBBox(keyframes, defaultBbox, 500)).toEqual([0.1, 0.1, 0.2, 0.2]);
      expect(interpolateBBox(keyframes, defaultBbox, 1000)).toEqual([0.1, 0.1, 0.2, 0.2]);
    });

    it('clamps to last keyframe when timecode exceeds it', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.2, 0.2] },
        { timeMs: 3000, bbox: [0.5, 0.5, 0.2, 0.2] }
      ];
      expect(interpolateBBox(keyframes, defaultBbox, 3000)).toEqual([0.5, 0.5, 0.2, 0.2]);
      expect(interpolateBBox(keyframes, defaultBbox, 5000)).toEqual([0.5, 0.5, 0.2, 0.2]);
    });

    it('linearly interpolates coordinates midway between two keyframes', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.2, 0.3, 0.4] },
        { timeMs: 3000, bbox: [0.3, 0.6, 0.5, 0.8] }
      ];

      // At t = 2000ms (50% progress):
      // x = 0.1 + 0.5 * (0.3 - 0.1) = 0.2
      // y = 0.2 + 0.5 * (0.6 - 0.2) = 0.4
      // w = 0.3 + 0.5 * (0.5 - 0.3) = 0.4
      // h = 0.4 + 0.5 * (0.8 - 0.4) = 0.6
      const result = interpolateBBox(keyframes, defaultBbox, 2000);
      expect(result).toEqual([0.2, 0.4, 0.4, 0.6]);
    });

    it('interpolates accurately across multiple keyframe intervals', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 0, bbox: [0.0, 0.0, 0.1, 0.1] },
        { timeMs: 1000, bbox: [0.2, 0.2, 0.1, 0.1] },
        { timeMs: 2000, bbox: [0.8, 0.4, 0.1, 0.1] }
      ];

      // In second segment at t = 1500 (50% of segment 2):
      // x = 0.2 + 0.5 * (0.8 - 0.2) = 0.5
      // y = 0.2 + 0.5 * (0.4 - 0.2) = 0.3
      const result = interpolateBBox(keyframes, defaultBbox, 1500);
      expect(result).toEqual([0.5, 0.3, 0.1, 0.1]);
    });

    it('strictly clamps interpolated coordinates to [0.0, 1.0]', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 0, bbox: [0.8, 0.8, 0.3, 0.3] },
        { timeMs: 1000, bbox: [0.9, 0.9, 0.4, 0.4] }
      ];
      const result = interpolateBBox(keyframes, defaultBbox, 500);
      expect(result[0] + result[2]).toBeLessThanOrEqual(1.000001);
      expect(result[1] + result[3]).toBeLessThanOrEqual(1.000001);
    });
  });

  describe('upsertKeyframe', () => {
    it('inserts a new keyframe into an empty collection', () => {
      const list = upsertKeyframe(undefined, 1000, [0.2, 0.2, 0.3, 0.3]);
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        timeMs: 1000,
        bbox: [0.2, 0.2, 0.3, 0.3]
      });
    });

    it('maintains chronological ordering when inserting keyframes out of order', () => {
      let list = upsertKeyframe([], 3000, [0.3, 0.3, 0.1, 0.1]);
      list = upsertKeyframe(list, 1000, [0.1, 0.1, 0.1, 0.1]);
      list = upsertKeyframe(list, 2000, [0.2, 0.2, 0.1, 0.1]);

      expect(list.map(k => k.timeMs)).toEqual([1000, 2000, 3000]);
    });

    it('updates existing keyframe in place if timestamp is within threshold', () => {
      const initial: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.1, 0.1] },
        { timeMs: 2000, bbox: [0.2, 0.2, 0.2, 0.2] }
      ];

      // Upsert at 1008ms (within 16ms threshold of 1000ms)
      const updated = upsertKeyframe(initial, 1008, [0.4, 0.4, 0.4, 0.4], 16);
      expect(updated).toHaveLength(2);
      expect(updated[0]).toEqual({
        timeMs: 1008,
        bbox: [0.4, 0.4, 0.4, 0.4]
      });
    });
  });

  describe('removeKeyframeNear', () => {
    it('removes keyframe matching threshold proximity', () => {
      const initial: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.1, 0.1] },
        { timeMs: 2000, bbox: [0.2, 0.2, 0.2, 0.2] },
        { timeMs: 3000, bbox: [0.3, 0.3, 0.3, 0.3] }
      ];

      const result = removeKeyframeNear(initial, 2005, 16);
      expect(result.map(k => k.timeMs)).toEqual([1000, 3000]);
    });

    it('returns empty array when undefined is passed', () => {
      expect(removeKeyframeNear(undefined, 1000)).toEqual([]);
    });
  });

  describe('findSurroundingKeyframes', () => {
    it('returns nulls when keyframes array is empty', () => {
      expect(findSurroundingKeyframes([], 1000)).toEqual({ prev: null, next: null });
      expect(findSurroundingKeyframes(undefined, 1000)).toEqual({ prev: null, next: null });
    });

    it('locates nearest previous and next keyframes around a query timestamp', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.1, 0.1] },
        { timeMs: 2000, bbox: [0.2, 0.2, 0.2, 0.2] },
        { timeMs: 3000, bbox: [0.3, 0.3, 0.3, 0.3] }
      ];

      const { prev, next } = findSurroundingKeyframes(keyframes, 1800);
      expect(prev?.timeMs).toBe(1000);
      expect(next?.timeMs).toBe(2000);
    });

    it('returns null for prev when query is before first keyframe', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.1, 0.1] }
      ];
      const { prev, next } = findSurroundingKeyframes(keyframes, 500);
      expect(prev).toBeNull();
      expect(next?.timeMs).toBe(1000);
    });

    it('returns null for next when query is after last keyframe', () => {
      const keyframes: RedactionKeyframe[] = [
        { timeMs: 1000, bbox: [0.1, 0.1, 0.1, 0.1] }
      ];
      const { prev, next } = findSurroundingKeyframes(keyframes, 1500);
      expect(prev?.timeMs).toBe(1000);
      expect(next).toBeNull();
    });
  });
});
