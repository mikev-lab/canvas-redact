/**
 * Core type contracts for the client-side detection and multi-object tracking pipeline.
 */

import { NormalizedBBoxTuple, RedactionKeyframe, RedactionType } from '../types';

/**
 * Raw detection output from a face detector frame inference.
 */
export interface RawDetection {
  /** Normalized bounding box [x, y, width, height] in range [0.0 .. 1.0] */
  bbox: NormalizedBBoxTuple;
  /** Detection confidence score [0.0 .. 1.0] */
  confidence: number;
}

/**
 * Pluggable frame-level face detection interface.
 */
export interface IDetector {
  /**
   * Performs face detection on a source image or canvas.
   *
   * @param source - Canvas, image, or video element.
   * @param width - Intrinsic frame width in pixels.
   * @param height - Intrinsic frame height in pixels.
   * @returns Array of candidate face detections.
   */
  detect(source: CanvasImageSource, width: number, height: number): Promise<RawDetection[]>;
}

/**
 * Historical detection sample in a trajectory.
 */
export interface TrackSample {
  timeMs: number;
  bbox: NormalizedBBoxTuple;
  confidence: number;
}

/**
 * Continuous trajectory tracklet managed by the multi-object tracker.
 */
export interface Tracklet {
  /** Unique track identifier */
  id: string;
  /** Human-readable assigned label */
  label: string;
  /** Discrete chronological samples */
  samples: TrackSample[];
  /** Consecutive frames without a matched detection */
  timeSinceUpdate: number;
  /** Total matching detection hits */
  hits: number;
  /** Highest confidence detection sample observed */
  bestSample: TrackSample;
  /** Whether the track has satisfied minimum hit requirements to be confirmed */
  isConfirmed: boolean;
}

/**
 * User-configurable keyframe downsampling density profiles.
 */
export type KeyframeDensity = 'sparse' | 'balanced' | 'dense';

export interface KeyframeDensityConfig {
  /** Minimum time in ms between keyframes (hard rate ceiling to prevent flooding) */
  minIntervalMs: number;
  /** Maximum time in ms before committing a keyframe during continuous motion */
  maxIntervalMs: number;
  /** Minimum spatial movement delta (fraction of frame) required to justify a keyframe */
  minMovementDelta: number;
}

export const KEYFRAME_DENSITY_PROFILES: Record<KeyframeDensity, KeyframeDensityConfig> = {
  sparse: {
    minIntervalMs: 800, // Max ~1.25 keyframes per second
    maxIntervalMs: 2000,
    minMovementDelta: 0.05, // 5% frame movement
  },
  balanced: {
    minIntervalMs: 400, // Max ~2.5 keyframes per second
    maxIntervalMs: 1000,
    minMovementDelta: 0.025, // 2.5% frame movement
  },
  dense: {
    minIntervalMs: 200, // Max ~5 keyframes per second
    maxIntervalMs: 500,
    minMovementDelta: 0.012, // 1.2% frame movement
  },
};

/**
 * Aggregated subject presented in the Subject Gallery for auditor review.
 */
export interface TrackedSubject {
  id: string;
  label: string;
  thumbnailUrl: string;
  startMs: number;
  endMs: number;
  samples?: TrackSample[];
  trajectory: RedactionKeyframe[];
  selected: boolean;
  type: RedactionType;
  confidence: number;
}
