import { ExportPayload, NormalizedBBoxTuple, RedactionBox, RedactionType, VideoMetadata } from '../types';
import { clamp } from './coordinates';

/**
 * Strips HTML tags and dangerous characters from user-provided label strings to prevent
 * Cross-Site Scripting (XSS) when rendered in the DOM or canvas context.
 *
 * @param raw - Raw input label.
 * @returns Sanitized plain text label.
 */
export function sanitizeLabel(raw: string): string {
  if (!raw) return 'Redaction';
  // Strip <script> and <style> tags along with their inner text
  const withoutScripts = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Strip all remaining HTML/XML tags and ASCII control characters
  return withoutScripts.replace(/<[^>]*>?/gm, '').replace(/[\x00-\x1F\x7F]/g, '').trim() || 'Redaction';
}

/**
 * Assembles an evidence review export payload compliant with the v1.0.0 JSON schema contract.
 *
 * @param videoMeta - Metadata describing the active media file.
 * @param redactions - List of active and inactive redaction bounding boxes.
 * @returns Fully populated, validated ExportPayload.
 */
export function createExportPayload(
  videoMeta: VideoMetadata,
  redactions: RedactionBox[]
): ExportPayload {
  return {
    version: '1.0.0',
    metadata: {
      source: 'canvas-redact',
      videoName: videoMeta.name || 'untitled_evidence.mp4',
      durationMs: Math.max(0, Math.round(videoMeta.durationMs)),
      dimensions: {
        width: videoMeta.dimensions.width || 1920,
        height: videoMeta.dimensions.height || 1080,
      },
      fps: videoMeta.fps || 30,
      exportedAt: new Date().toISOString(),
    },
    redactions: redactions.map((box) => ({
      id: box.id,
      label: sanitizeLabel(box.label),
      type: box.type,
      startMs: Math.round(box.startMs),
      endMs: Math.round(box.endMs),
      bbox: [
        clamp(box.bbox[0], 0, 1),
        clamp(box.bbox[1], 0, 1),
        clamp(box.bbox[2], 0, 1 - clamp(box.bbox[0], 0, 1)),
        clamp(box.bbox[3], 0, 1 - clamp(box.bbox[1], 0, 1)),
      ],
    })),
  };
}

/**
 * Validates, parses, and sanitizes an imported JSON evidence redaction file.
 *
 * @param rawJson - Raw JSON string from uploaded file or clipboard.
 * @returns Sanitized and validated ExportPayload.
 *
 * @throws Error if the JSON is malformed, missing required metadata, or corrupt.
 *
 * @remarks
 * Defense-in-depth sanitization:
 * 1. Clamps coordinates to strictly [0.0, 1.0].
 * 2. Auto-swaps inverted timestamps where startMs > endMs.
 * 3. Sanitizes labels to eliminate XSS vectors.
 */
export function validateAndSanitizeImport(rawJson: string): ExportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`JSON parsing failed: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid evidence file: Root must be a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.version || typeof obj.version !== 'string') {
    throw new Error('Invalid evidence file: Missing or invalid "version" field.');
  }

  if (!obj.metadata || typeof obj.metadata !== 'object') {
    throw new Error('Invalid evidence file: Missing or invalid "metadata" block.');
  }

  const meta = obj.metadata as Record<string, unknown>;
  const videoName = typeof meta.videoName === 'string' ? meta.videoName : 'imported_video.mp4';
  const durationMs = typeof meta.durationMs === 'number' ? Math.max(0, meta.durationMs) : 0;
  const fps = typeof meta.fps === 'number' ? meta.fps : 30;

  let width = 1920;
  let height = 1080;
  if (meta.dimensions && typeof meta.dimensions === 'object') {
    const dims = meta.dimensions as Record<string, unknown>;
    if (typeof dims.width === 'number') width = dims.width;
    if (typeof dims.height === 'number') height = dims.height;
  }

  if (!Array.isArray(obj.redactions)) {
    throw new Error('Invalid evidence file: "redactions" must be an array.');
  }

  const sanitizedRedactions: RedactionBox[] = [];

  for (let i = 0; i < obj.redactions.length; i++) {
    const rawBox = obj.redactions[i] as Record<string, unknown>;
    if (!rawBox || typeof rawBox !== 'object') continue;

    const id = typeof rawBox.id === 'string' ? rawBox.id : `redact-${Date.now()}-${i}`;
    const label = sanitizeLabel(typeof rawBox.label === 'string' ? rawBox.label : `Redaction ${i + 1}`);

    let type: RedactionType = 'blur';
    if (rawBox.type === 'pixelate' || rawBox.type === 'blackout') {
      type = rawBox.type;
    }

    let startMs = typeof rawBox.startMs === 'number' ? rawBox.startMs : 0;
    let endMs = typeof rawBox.endMs === 'number' ? rawBox.endMs : durationMs;

    // Correct inverted time interval
    if (startMs > endMs) {
      const temp = startMs;
      startMs = endMs;
      endMs = temp;
    }

    // Validate and clamp bounding box
    let bbox: NormalizedBBoxTuple = [0.1, 0.1, 0.2, 0.2];
    if (Array.isArray(rawBox.bbox) && rawBox.bbox.length === 4) {
      const b0 = typeof rawBox.bbox[0] === 'number' ? clamp(rawBox.bbox[0], 0, 1) : 0;
      const b1 = typeof rawBox.bbox[1] === 'number' ? clamp(rawBox.bbox[1], 0, 1) : 0;
      const b2 = typeof rawBox.bbox[2] === 'number' ? clamp(rawBox.bbox[2], 0, 1 - b0) : 0.2;
      const b3 = typeof rawBox.bbox[3] === 'number' ? clamp(rawBox.bbox[3], 0, 1 - b1) : 0.2;
      bbox = [b0, b1, b2, b3];
    }

    sanitizedRedactions.push({
      id,
      label,
      type,
      startMs: Math.max(0, startMs),
      endMs: Math.max(0, endMs),
      bbox,
    });
  }

  return {
    version: '1.0.0',
    metadata: {
      source: 'canvas-redact',
      videoName,
      durationMs,
      dimensions: { width, height },
      fps,
      exportedAt: typeof meta.exportedAt === 'string' ? meta.exportedAt : new Date().toISOString(),
    },
    redactions: sanitizedRedactions,
  };
}

/**
 * Triggers a browser download of an evidence JSON export payload with guaranteed
 * URL.revokeObjectURL cleanup to prevent browser memory leaks.
 *
 * @param filename - Target download file name: e.g. "redactions_incident_04.json".
 * @param payload - ExportPayload to download.
 */
export function downloadJsonFile(filename: string, payload: ExportPayload): void {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Guarantee cleanup to prevent memory leaks
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
