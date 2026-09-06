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
 * Aggregated subject presented in the Subject Gallery for auditor review.
 */
export interface TrackedSubject {
  id: string;
  label: string;
  thumbnailUrl: string;
  startMs: number;
  endMs: number;
  trajectory: RedactionKeyframe[];
  selected: boolean;
  type: RedactionType;
  confidence: number;
}
