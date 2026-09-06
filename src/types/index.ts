/**
 * Supported visual redaction treatments.
 */
export type RedactionType = 'blur' | 'pixelate' | 'blackout';

/**
 * Eight-direction resize handles and center move handle.
 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/**
 * Normalized 2D bounding box vector.
 * Stored as [x, y, width, height] where all values are in range [0.0, 1.0].
 */
export type NormalizedBBoxTuple = [
  /** x: Fractional horizontal origin (0.0 = left edge, 1.0 = right edge) */
  x: number,
  /** y: Fractional vertical origin (0.0 = top edge, 1.0 = bottom edge) */
  y: number,
  /** width: Fractional horizontal width (0.0 .. 1.0) */
  width: number,
  /** height: Fractional vertical height (0.0 .. 1.0) */
  height: number
];

/**
 * Keyframe snapshot capturing a bounding box at a discrete timestamp.
 */
export interface RedactionKeyframe {
  /** Timestamp in milliseconds */
  timeMs: number;
  /** Normalized bounding box [x, y, width, height] at this keyframe */
  bbox: NormalizedBBoxTuple;
}

/**
 * Core in-memory redaction annotation entity.
 */
export interface RedactionBox {
  /** Unique identifier: e.g. "redact-1725580000000-1" */
  id: string;
  /** Human-readable label: e.g. "Suspect Face", "License Plate" */
  label: string;
  /** Redaction visual mode */
  type: RedactionType;
  /** Timecode in-point in milliseconds (inclusive) */
  startMs: number;
  /** Timecode out-point in milliseconds (inclusive) */
  endMs: number;
  /** Normalized bounding box relative to video resolution (or base fallback state) */
  bbox: NormalizedBBoxTuple;
  /** Optional chronologically ordered sequence of trajectory keyframes */
  keyframes?: RedactionKeyframe[];
}

/**
 * Intrinsic and playback metadata for active video media.
 */
export interface VideoMetadata {
  /** File or stream identifier name */
  name: string;
  /** Total media duration in milliseconds */
  durationMs: number;
  /** Intrinsic video frame dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Estimated or configured frames per second (default: 30) */
  fps: number;
  /** MIME type if loaded from local file: e.g. "video/mp4" */
  mimeType?: string;
  /** File size in bytes if available */
  sizeBytes?: number;
}

/**
 * Forensic timecode string components.
 */
export interface TimecodeParts {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  formatted: string; // "HH:MM:SS:FF"
}

/**
 * Evidence review export contract matching v1.0.0 JSON schema.
 */
export interface ExportPayload {
  version: '1.0.0';
  metadata: {
    source: 'canvas-redact';
    videoName: string;
    durationMs: number;
    dimensions: {
      width: number;
      height: number;
    };
    fps: number;
    exportedAt: string; // ISO 8601 UTC timestamp
  };
  redactions: RedactionBox[];
}
