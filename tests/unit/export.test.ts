import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createExportPayload,
  validateAndSanitizeImport,
  sanitizeLabel,
  downloadJsonFile,
} from '../../src/utils/export';
import { RedactionBox, VideoMetadata } from '../../src/types';

describe('Evidence Export & Import Sanitization', () => {
  const mockVideoMeta: VideoMetadata = {
    name: 'bodycam_incident_12.mp4',
    durationMs: 12450.7,
    dimensions: { width: 1920, height: 1080 },
    fps: 30,
  };

  const mockRedactions: RedactionBox[] = [
    {
      id: 'box-1',
      label: 'Suspect Face',
      type: 'blur',
      startMs: 1200,
      endMs: 4500,
      bbox: [0.2, 0.3, 0.15, 0.25],
    },
    {
      id: 'box-2',
      label: '<script>alert("xss")</script>License Plate',
      type: 'pixelate',
      startMs: 2000,
      endMs: 6000,
      bbox: [-0.1, 0.5, 1.5, 0.2], // out of bounds coordinates
    },
  ];

  describe('sanitizeLabel', () => {
    it('strips script tags and HTML markup from labels to prevent XSS', () => {
      expect(sanitizeLabel('<script>alert(1)</script>Suspect')).toBe('Suspect');
      expect(sanitizeLabel('<b>Bold Title</b>')).toBe('Bold Title');
      expect(sanitizeLabel('')).toBe('Redaction');
      expect(sanitizeLabel('   ')).toBe('Redaction');
    });
  });

  describe('createExportPayload', () => {
    it('creates schema-compliant v1.0.0 export payload with sanitized labels and clamped coordinates', () => {
      const payload = createExportPayload(mockVideoMeta, mockRedactions);

      expect(payload.version).toBe('1.0.0');
      expect(payload.metadata.source).toBe('canvas-redact');
      expect(payload.metadata.videoName).toBe('bodycam_incident_12.mp4');
      expect(payload.metadata.durationMs).toBe(12451); // rounded
      expect(payload.metadata.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(payload.metadata.fps).toBe(30);
      expect(new Date(payload.metadata.exportedAt).getTime()).not.toBeNaN();

      expect(payload.redactions).toHaveLength(2);

      // Clean box
      expect(payload.redactions[0]?.label).toBe('Suspect Face');
      expect(payload.redactions[0]?.type).toBe('blur');
      expect(payload.redactions[0]?.bbox).toEqual([0.2, 0.3, 0.15, 0.25]);

      // XSS sanitized and clamped box
      expect(payload.redactions[1]?.label).toBe('License Plate');
      // x clamped to 0, width clamped to remaining max 1.0
      expect(payload.redactions[1]?.bbox[0]).toBe(0);
      expect(payload.redactions[1]?.bbox[2]).toBe(1);
    });
  });

  describe('validateAndSanitizeImport', () => {
    it('parses valid evidence JSON payload correctly', () => {
      const validPayload = createExportPayload(mockVideoMeta, mockRedactions);
      const jsonString = JSON.stringify(validPayload);

      const imported = validateAndSanitizeImport(jsonString);
      expect(imported.version).toBe('1.0.0');
      expect(imported.redactions).toHaveLength(2);
      expect(imported.redactions[0]?.label).toBe('Suspect Face');
    });

    it('auto-corrects inverted time ranges where startMs > endMs', () => {
      const malformed = {
        version: '1.0.0',
        metadata: {
          videoName: 'test.mp4',
          durationMs: 10000,
          dimensions: { width: 1920, height: 1080 },
        },
        redactions: [
          {
            id: 'box-inverted',
            label: 'Reversed Box',
            type: 'blur',
            startMs: 5000,
            endMs: 2000, // inverted!
            bbox: [0.1, 0.1, 0.2, 0.2],
          },
        ],
      };

      const imported = validateAndSanitizeImport(JSON.stringify(malformed));
      expect(imported.redactions[0]?.startMs).toBe(2000);
      expect(imported.redactions[0]?.endMs).toBe(5000);
    });

    it('strips XSS attacks from imported labels', () => {
      const malicious = {
        version: '1.0.0',
        metadata: { videoName: 'test.mp4', durationMs: 10000 },
        redactions: [
          {
            id: 'xss-box',
            label: '<img src=x onerror=alert(1)>Target',
            type: 'blackout',
            startMs: 1000,
            endMs: 3000,
            bbox: [0.1, 0.1, 0.2, 0.2],
          },
        ],
      };

      const imported = validateAndSanitizeImport(JSON.stringify(malicious));
      expect(imported.redactions[0]?.label).toBe('Target');
    });

    it('throws meaningful error when JSON parsing fails or required fields are missing', () => {
      expect(() => validateAndSanitizeImport('invalid json {')).toThrow(/JSON parsing failed/);
      expect(() => validateAndSanitizeImport('{"version": "1.0.0"}')).toThrow(/Missing or invalid "metadata"/);
      expect(() => validateAndSanitizeImport('{"version": "1.0.0", "metadata": {}}')).toThrow(/"redactions" must be an array/);
    });

    it('preserves, clamps, and chronologically sorts keyframe trajectories on export and import', () => {
      const firstBox = mockRedactions[0]!;
      const redactionsWithKeyframes: RedactionBox[] = [
        {
          ...firstBox,
          keyframes: [
            { timeMs: 3000, bbox: [0.5, 0.5, 0.2, 0.2] as [number, number, number, number] },
            { timeMs: 1000, bbox: [0.1, 0.1, 0.2, 0.2] as [number, number, number, number] },
          ],
        },
      ];

      const exported = createExportPayload(mockVideoMeta, redactionsWithKeyframes);
      expect(exported.redactions[0]?.keyframes).toHaveLength(2);

      const imported = validateAndSanitizeImport(JSON.stringify(exported));
      expect(imported.redactions[0]?.keyframes).toHaveLength(2);
      expect(imported.redactions[0]?.keyframes?.[0]?.timeMs).toBe(1000);
      expect(imported.redactions[0]?.keyframes?.[1]?.timeMs).toBe(3000);
    });
  });

  describe('downloadJsonFile', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers anchor download and revokes ObjectURL to prevent memory leaks', () => {
      const payload = createExportPayload(mockVideoMeta, mockRedactions);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      downloadJsonFile('test_export.json', payload);

      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      // Fast-forward 100ms timer to trigger revokeObjectURL
      vi.advanceTimersByTime(150);
      expect(window.URL.revokeObjectURL).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });
});
