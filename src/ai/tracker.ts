/**
 * Multi-Object Tracking Engine (SORT / ByteTrack paradigm in pure TypeScript).
 * Provides kinematic 2D projection, IoU spatial matching, and trajectory keyframe optimization.
 */

import { NormalizedBBoxTuple, RedactionKeyframe, RedactionType } from '../types';
import { clamp } from '../utils/coordinates';
import { RawDetection, TrackSample, TrackedSubject, Tracklet } from './types';
import { extractFaceThumbnail } from './faceExtractor';

/**
 * Calculates the Intersection-over-Union (IoU) ratio between two normalized bounding boxes.
 *
 * @param boxA - First normalized bounding box [x, y, w, h].
 * @param boxB - Second normalized bounding box [x, y, w, h].
 * @returns Spatial overlap ratio in range [0.0 .. 1.0].
 */
export function computeIoU(boxA: NormalizedBBoxTuple, boxB: NormalizedBBoxTuple): number {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;

  const ax2 = ax + aw;
  const ay2 = ay + ah;
  const bx2 = bx + bw;
  const by2 = by + bh;

  const interX1 = Math.max(ax, bx);
  const interY1 = Math.max(ay, by);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const interArea = interWidth * interHeight;

  const areaA = Math.max(0, aw * ah);
  const areaB = Math.max(0, bw * bh);
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return Math.min(1, Math.max(0, interArea / unionArea));
}

/**
 * Single Kalman-inspired 2D kinematic track state.
 */
class KinematicTrack {
  public id: string;
  public label: string;
  public samples: TrackSample[] = [];
  public hits: number = 0;
  public timeSinceUpdate: number = 0;
  public bestSample: TrackSample;

  // 2D State: x, y, width, height
  private x: number;
  private y: number;
  private w: number;
  private h: number;

  // Velocities
  private vx: number = 0;
  private vy: number = 0;
  private vw: number = 0;
  private vh: number = 0;

  constructor(id: string, label: string, initialDetection: RawDetection, timeMs: number) {
    this.id = id;
    this.label = label;
    const [x, y, w, h] = initialDetection.bbox;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    const sample: TrackSample = {
      timeMs,
      bbox: [x, y, w, h],
      confidence: initialDetection.confidence,
    };
    this.samples.push(sample);
    this.bestSample = sample;
    this.hits = 1;
    this.timeSinceUpdate = 0;
  }

  /**
   * Projects track state forward by one time step.
   */
  public predict(): NormalizedBBoxTuple {
    this.x = clamp(this.x + this.vx, 0, 1);
    this.y = clamp(this.y + this.vy, 0, 1);
    this.w = clamp(this.w + this.vw, 0.01, 1 - this.x);
    this.h = clamp(this.h + this.vh, 0.01, 1 - this.y);
    this.timeSinceUpdate++;

    return [this.x, this.y, this.w, this.h];
  }

  /**
   * Updates track state with a matched detection.
   */
  public update(detection: RawDetection, timeMs: number): void {
    const [dx, dy, dw, dh] = detection.bbox;
    const alpha = 0.75; // Coordinate smoothing filter gain

    const prevX = this.x;
    const prevY = this.y;
    const prevW = this.w;
    const prevH = this.h;

    this.x = clamp(this.x * (1 - alpha) + dx * alpha, 0, 1);
    this.y = clamp(this.y * (1 - alpha) + dy * alpha, 0, 1);
    this.w = clamp(this.w * (1 - alpha) + dw * alpha, 0.01, 1 - this.x);
    this.h = clamp(this.h * (1 - alpha) + dh * alpha, 0.01, 1 - this.y);

    // Update estimated velocity
    const beta = 0.3;
    this.vx = this.vx * (1 - beta) + (this.x - prevX) * beta;
    this.vy = this.vy * (1 - beta) + (this.y - prevY) * beta;
    this.vw = this.vw * (1 - beta) + (this.w - prevW) * beta;
    this.vh = this.vh * (1 - beta) + (this.h - prevH) * beta;

    const sample: TrackSample = {
      timeMs,
      bbox: [this.x, this.y, this.w, this.h],
      confidence: detection.confidence,
    };
    this.samples.push(sample);

    if (detection.confidence >= this.bestSample.confidence) {
      this.bestSample = sample;
    }

    this.hits++;
    this.timeSinceUpdate = 0;
  }

  public get currentBBox(): NormalizedBBoxTuple {
    return [this.x, this.y, this.w, this.h];
  }

  public toTracklet(minHits: number): Tracklet {
    return {
      id: this.id,
      label: this.label,
      samples: [...this.samples],
      hits: this.hits,
      timeSinceUpdate: this.timeSinceUpdate,
      bestSample: { ...this.bestSample },
      isConfirmed: this.hits >= minHits,
    };
  }
}

/**
 * High-performance multi-object tracker for in-browser video scrubbing.
 */
export class SORTTracker {
  private tracks: KinematicTrack[] = [];
  private nextId: number = 1;
  private readonly maxAge: number;
  private readonly minHits: number;
  private readonly iouThreshold: number;

  /**
   * Initializes tracker with configurable temporal and spatial thresholds.
   *
   * @param maxAge - Maximum frames to retain track without matched detection (default: 10).
   * @param minHits - Minimum hits required to confirm subject identity (default: 2).
   * @param iouThreshold - Minimum IoU spatial overlap to accept detection match (default: 0.25).
   */
  constructor(maxAge: number = 10, minHits: number = 2, iouThreshold: number = 0.25) {
    this.maxAge = maxAge;
    this.minHits = minHits;
    this.iouThreshold = iouThreshold;
  }

  /**
   * Processes a new frame detection set at a given timestamp.
   *
   * @param detections - Candidate detections identified in the current frame.
   * @param timeMs - Media timestamp in milliseconds.
   * @returns Active confirmed tracklets.
   */
  public update(detections: RawDetection[], timeMs: number): Tracklet[] {
    // 1. Predict predicted bounding box for each active track
    const predictedBoxes = this.tracks.map((t) => t.predict());

    // 2. Compute IoU cost matrix
    const matchedTrackIndices = new Set<number>();
    const matchedDetectionIndices = new Set<number>();

    // Build pairs sorted by descending IoU overlap
    const pairs: Array<{ trackIdx: number; detIdx: number; iou: number }> = [];
    for (let t = 0; t < this.tracks.length; t++) {
      const predBox = predictedBoxes[t];
      if (!predBox) continue;
      for (let d = 0; d < detections.length; d++) {
        const det = detections[d];
        if (!det) continue;
        const iou = computeIoU(predBox, det.bbox);
        if (iou >= this.iouThreshold) {
          pairs.push({ trackIdx: t, detIdx: d, iou });
        }
      }
    }
    pairs.sort((a, b) => b.iou - a.iou);

    // Greedy bipartite assignment
    for (const pair of pairs) {
      if (!matchedTrackIndices.has(pair.trackIdx) && !matchedDetectionIndices.has(pair.detIdx)) {
        matchedTrackIndices.add(pair.trackIdx);
        matchedDetectionIndices.add(pair.detIdx);
        const track = this.tracks[pair.trackIdx];
        const det = detections[pair.detIdx];
        if (track && det) {
          track.update(det, timeMs);
        }
      }
    }

    // 3. Initiate new tracks for unmatched detections
    for (let d = 0; d < detections.length; d++) {
      const det = detections[d];
      if (!matchedDetectionIndices.has(d) && det) {
        const id = `subject-${this.nextId}`;
        const label = `Subject ${this.nextId}`;
        this.nextId++;
        this.tracks.push(new KinematicTrack(id, label, det, timeMs));
      }
    }

    // 4. Prune dead tracks that have exceeded maxAge
    this.tracks = this.tracks.filter((t) => t.timeSinceUpdate <= this.maxAge);

    return this.tracks.map((t) => t.toTracklet(this.minHits));
  }

  /**
   * Aggregates confirmed tracks into ready-to-review Subject Gallery items.
   *
   * @param frameSource - Optional canvas/video element to crop face thumbnails from.
   * @param frameWidth - Video frame width in pixels.
   * @param frameHeight - Video frame height in pixels.
   * @param defaultType - Default visual redaction treatment (default: 'blur').
   * @returns Array of detected subjects.
   */
  public getConfirmedSubjects(
    frameSource?: CanvasImageSource,
    frameWidth: number = 1920,
    frameHeight: number = 1080,
    defaultType: RedactionType = 'blur'
  ): TrackedSubject[] {
    const confirmed = this.tracks.filter((t) => t.hits >= this.minHits);

    return confirmed.map((track) => {
      const sortedSamples = [...track.samples].sort((a, b) => a.timeMs - b.timeMs);
      const startMs = sortedSamples[0]?.timeMs ?? 0;
      const endMs = sortedSamples[sortedSamples.length - 1]?.timeMs ?? startMs + 1000;

      // Extract keyframes: downsample dense detections into smooth keyframe trajectory
      const trajectory: RedactionKeyframe[] = downsampleKeyframes(sortedSamples);

      // Extract face avatar thumbnail
      const thumbnailUrl = frameSource
        ? extractFaceThumbnail(frameSource, track.bestSample.bbox, frameWidth, frameHeight, 96)
        : '';

      const totalConfidence = sortedSamples.reduce((acc, s) => acc + s.confidence, 0);
      const meanConfidence = sortedSamples.length > 0 ? totalConfidence / sortedSamples.length : 0.9;

      return {
        id: track.id,
        label: track.label,
        thumbnailUrl,
        startMs,
        endMs,
        trajectory,
        selected: false, // Default to unselected: auditor explicitly opts in
        type: defaultType,
        confidence: Math.round(meanConfidence * 100) / 100,
      };
    });
  }

  /**
   * Resets all internal tracking state.
   */
  public reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }
}

/**
 * Downsamples dense frame-by-frame samples into an optimized keyframe sequence.
 * Retains beginning, end, and intermediate samples where movement occurs.
 *
 * @param samples - Chronologically ordered track samples.
 * @returns Clean RedactionKeyframe sequence.
 */
export function downsampleKeyframes(samples: TrackSample[]): RedactionKeyframe[] {
  if (samples.length === 0) return [];
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return [];

  if (samples.length <= 2) {
    return samples.map((s) => ({ timeMs: s.timeMs, bbox: s.bbox }));
  }

  const keyframes: RedactionKeyframe[] = [{ timeMs: first.timeMs, bbox: first.bbox }];
  let lastCommittedBBox = first.bbox;
  let lastCommittedTime = first.timeMs;

  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (!s) continue;
    const timeDelta = s.timeMs - lastCommittedTime;
    const dx = Math.abs(s.bbox[0] - lastCommittedBBox[0]);
    const dy = Math.abs(s.bbox[1] - lastCommittedBBox[1]);
    const dw = Math.abs(s.bbox[2] - lastCommittedBBox[2]);
    const dh = Math.abs(s.bbox[3] - lastCommittedBBox[3]);
    const maxCoordDelta = Math.max(dx, dy, dw, dh);

    // Commit keyframe if moved significantly (> 1.5% frame) or elapsed > 400ms
    if (maxCoordDelta > 0.015 || timeDelta >= 400) {
      keyframes.push({ timeMs: s.timeMs, bbox: s.bbox });
      lastCommittedBBox = s.bbox;
      lastCommittedTime = s.timeMs;
    }
  }

  keyframes.push({ timeMs: last.timeMs, bbox: last.bbox });

  return keyframes;
}
