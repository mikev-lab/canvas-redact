/**
 * Unit tests for SORT multi-object tracker and IoU spatial calculations.
 */

import { describe, it, expect } from 'vitest';
import { computeIoU, downsampleKeyframes, SORTTracker } from '../../src/ai/tracker';
import { NormalizedBBoxTuple } from '../../src/types';
import { RawDetection } from '../../src/ai/types';

describe('computeIoU', () => {
  it('returns 1.0 for perfectly identical bounding boxes', () => {
    const box: NormalizedBBoxTuple = [0.2, 0.2, 0.3, 0.3];
    expect(computeIoU(box, box)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for completely disjoint bounding boxes', () => {
    const boxA: NormalizedBBoxTuple = [0.0, 0.0, 0.2, 0.2];
    const boxB: NormalizedBBoxTuple = [0.5, 0.5, 0.2, 0.2];
    expect(computeIoU(boxA, boxB)).toBe(0.0);
  });

  it('calculates accurate partial overlap IoU ratio', () => {
    // boxA: [0, 0, 0.4, 0.4], area = 0.16
    // boxB: [0.2, 0, 0.4, 0.4], area = 0.16
    // Intersection: x from 0.2 to 0.4 (width = 0.2), y from 0 to 0.4 (height = 0.4) -> area = 0.08
    // Union: 0.16 + 0.16 - 0.08 = 0.24
    // IoU: 0.08 / 0.24 = 1/3 ~ 0.3333
    const boxA: NormalizedBBoxTuple = [0, 0, 0.4, 0.4];
    const boxB: NormalizedBBoxTuple = [0.2, 0, 0.4, 0.4];
    expect(computeIoU(boxA, boxB)).toBeCloseTo(1 / 3, 4);
  });

  it('handles zero-area or inverted boxes safely without throwing', () => {
    const boxA: NormalizedBBoxTuple = [0, 0, 0, 0];
    const boxB: NormalizedBBoxTuple = [0.1, 0.1, 0.2, 0.2];
    expect(computeIoU(boxA, boxB)).toBe(0.0);
  });
});

describe('SORTTracker', () => {
  it('initiates a new subject track on initial detection', () => {
    const tracker = new SORTTracker(5, 1, 0.2);
    const detections: RawDetection[] = [
      { bbox: [0.2, 0.2, 0.15, 0.15], confidence: 0.92 }
    ];

    const tracks = tracker.update(detections, 0);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.id).toBe('subject-1');
    expect(tracks[0]!.label).toBe('Subject 1');
    expect(tracks[0]!.hits).toBe(1);
  });

  it('associates sequential detections for the same moving subject', () => {
    const tracker = new SORTTracker(5, 2, 0.2);

    // Frame 1: Subject at [0.2, 0.2, 0.1, 0.1]
    tracker.update([{ bbox: [0.2, 0.2, 0.1, 0.1], confidence: 0.9 }], 0);

    // Frame 2: Subject translates slightly to [0.22, 0.21, 0.1, 0.1]
    const tracks = tracker.update([{ bbox: [0.22, 0.21, 0.1, 0.1], confidence: 0.95 }], 100);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.id).toBe('subject-1');
    expect(tracks[0]!.hits).toBe(2);
    expect(tracks[0]!.isConfirmed).toBe(true);
  });

  it('tracks multiple distinct individuals simultaneously', () => {
    const tracker = new SORTTracker(5, 1, 0.2);

    // Frame 1: Two distinct individuals across opposite corners of the frame
    const frame1Detections: RawDetection[] = [
      { bbox: [0.1, 0.1, 0.12, 0.12], confidence: 0.88 },
      { bbox: [0.7, 0.6, 0.14, 0.14], confidence: 0.91 }
    ];

    const tracks1 = tracker.update(frame1Detections, 0);
    expect(tracks1).toHaveLength(2);
    expect(tracks1[0]!.id).toBe('subject-1');
    expect(tracks1[1]!.id).toBe('subject-2');

    // Frame 2: Both individuals move slightly
    const frame2Detections: RawDetection[] = [
      { bbox: [0.11, 0.11, 0.12, 0.12], confidence: 0.89 },
      { bbox: [0.71, 0.61, 0.14, 0.14], confidence: 0.93 }
    ];

    const tracks2 = tracker.update(frame2Detections, 150);
    expect(tracks2).toHaveLength(2);
    expect(tracks2.find((t) => t.id === 'subject-1')?.hits).toBe(2);
    expect(tracks2.find((t) => t.id === 'subject-2')?.hits).toBe(2);
  });

  it('survives momentary occlusion and maintains identity across missed frames', () => {
    const tracker = new SORTTracker(5, 2, 0.2);

    // Frame 1 & 2: Detections present
    tracker.update([{ bbox: [0.3, 0.3, 0.1, 0.1], confidence: 0.9 }], 0);
    tracker.update([{ bbox: [0.31, 0.3, 0.1, 0.1], confidence: 0.9 }], 100);

    // Frame 3: Occlusion: zero detections
    const tracksOccluded = tracker.update([], 200);
    expect(tracksOccluded).toHaveLength(1);
    expect(tracksOccluded[0]!.timeSinceUpdate).toBe(1);

    // Frame 4: Re-emergence: subject reappears
    const tracksReappeared = tracker.update([{ bbox: [0.33, 0.3, 0.1, 0.1], confidence: 0.92 }], 300);
    expect(tracksReappeared).toHaveLength(1);
    expect(tracksReappeared[0]!.id).toBe('subject-1');
    expect(tracksReappeared[0]!.hits).toBe(3);
    expect(tracksReappeared[0]!.timeSinceUpdate).toBe(0);
  });

  it('prunes dead tracks when missed frames exceed maxAge', () => {
    const tracker = new SORTTracker(2, 1, 0.2); // maxAge = 2

    tracker.update([{ bbox: [0.4, 0.4, 0.1, 0.1], confidence: 0.85 }], 0);

    // Miss frame 1
    tracker.update([], 100);
    // Miss frame 2
    tracker.update([], 200);
    // Miss frame 3 (exceeds maxAge = 2)
    const deadTracks = tracker.update([], 300);
    expect(deadTracks).toHaveLength(0);
  });

  it('generates confirmed subjects with keyframe trajectories', () => {
    const tracker = new SORTTracker(5, 2, 0.2);

    tracker.update([{ bbox: [0.1, 0.1, 0.2, 0.2], confidence: 0.8 }], 0);
    tracker.update([{ bbox: [0.15, 0.12, 0.2, 0.2], confidence: 0.95 }], 500);
    tracker.update([{ bbox: [0.2, 0.15, 0.2, 0.2], confidence: 0.9 }], 1000);

    const subjects = tracker.getConfirmedSubjects(undefined, 1920, 1080, 'pixelate');
    expect(subjects).toHaveLength(1);
    expect(subjects[0]!.id).toBe('subject-1');
    expect(subjects[0]!.label).toBe('Subject 1');
    expect(subjects[0]!.startMs).toBe(0);
    expect(subjects[0]!.endMs).toBe(1000);
    expect(subjects[0]!.type).toBe('pixelate');
    expect(subjects[0]!.selected).toBe(false); // Defaults to unselected for opt-in review
    expect(subjects[0]!.trajectory.length).toBeGreaterThanOrEqual(2);
  });
});

describe('downsampleKeyframes', () => {
  it('returns empty array when given zero samples', () => {
    expect(downsampleKeyframes([])).toEqual([]);
  });

  it('returns all samples when length is 2 or less', () => {
    const samples = [
      { timeMs: 0, bbox: [0.1, 0.1, 0.1, 0.1] as NormalizedBBoxTuple, confidence: 0.9 },
      { timeMs: 500, bbox: [0.2, 0.2, 0.1, 0.1] as NormalizedBBoxTuple, confidence: 0.9 }
    ];
    const keyframes = downsampleKeyframes(samples);
    expect(keyframes).toHaveLength(2);
    expect(keyframes[0]!.timeMs).toBe(0);
    expect(keyframes[1]!.timeMs).toBe(500);
  });
});
