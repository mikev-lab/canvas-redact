# Domain Data Models, Evidence Manifest Schema & Computer Vision Interoperability

> **Components:** `src/types/index.ts`, `src/utils/export.ts`, `src/utils/timecode.ts`  
> **Target Audience:** Systems Architects, Data Engineers & Full-Stack Developers  
> **Master Architecture:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Executive Summary

This document defines the core TypeScript data models, public safety evidence review export schemas, and timecode conversion algorithms powering **canvas-redact**.

The data architecture satisfies three strict criteria:
1. **Public Safety Evidentiary Integrity:** Every redaction record maintains millisecond and frame bounds, keyframe sequences, reviewer badge IDs, and immutable normalized coordinate tuples.
2. **Deterministic Timecode Arithmetic:** Timestamp calculations utilize integer milliseconds, eliminating IEEE 754 floating-point drift over multi-hour evidence recordings.
3. **Computer Vision Dataset Interoperability:** Because coordinates are strictly normalized to $[0.0, 1.0]$, exported manifests directly translate to standard machine learning object detection formats (COCO, YOLO, Pascal VOC).

---

## 2. Core TypeScript Domain Interfaces

```typescript
/**
 * Supported visual redaction filter modes.
 */
export type RedactionType = 'blur' | 'pixelate' | 'blackout';

/**
 * 8-point perimeter resize handles plus center move token.
 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/**
 * Normalized 2D bounding box vector.
 * Strictly clamped to: 0.0 <= value <= 1.0.
 */
export type NormalizedBBoxTuple = [
  /** x: Fractional horizontal origin (0.0 = left edge) */
  x: number,
  /** y: Fractional vertical origin (0.0 = top edge) */
  y: number,
  /** width: Fractional horizontal width (0.0 .. 1.0) */
  width: number,
  /** height: Fractional vertical height (0.0 .. 1.0) */
  height: number
];

/**
 * Spatial keyframe for moving redactions over time.
 */
export interface RedactionKeyframe {
  /** Timecode timestamp in integer milliseconds */
  timeMs: number;
  /** Normalized bounding box [x, y, width, height] at this keyframe */
  bbox: NormalizedBBoxTuple;
}

/**
 * Core in-memory redaction annotation record.
 */
export interface RedactionBox {
  /** Unique deterministic identifier: e.g. "redact-1725580000000-1" */
  id: string;
  /** Human-readable identifier: e.g. "Suspect Face", "License Plate" */
  label: string;
  /** Redaction visual treatment */
  type: RedactionType;
  /** Timecode in-point in milliseconds (inclusive) */
  startMs: number;
  /** Timecode out-point in milliseconds (inclusive) */
  endMs: number;
  /** Base normalized bounding box relative to intrinsic video resolution */
  bbox: NormalizedBBoxTuple;
  /** Optional sequence of chronologically sorted trajectory keyframes */
  keyframes?: RedactionKeyframe[];
  /** Optional reviewer or employee ID for chain of custody auditing */
  reviewerId?: string;
  /** Optional flag marking bounding box as AI-generated for legal transparency */
  aiAssisted?: boolean;
}
```

---

## 3. Evidence Review JSON Export Contract (`v1.0.0`)

Exported redaction manifests conform strictly to the public safety evidence review contract (`v1.0.0`):

```json
{
  "version": "1.0.0",
  "metadata": {
    "source": "canvas-redact",
    "videoName": "bodycam_incident_04.mp4",
    "durationMs": 14200,
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "exportedAt": "2026-09-06T00:30:00.000Z",
    "reviewerId": "OFC-4921",
    "fps": 30
  },
  "redactions": [
    {
      "id": "redact-1725580000000",
      "label": "Suspect Face",
      "type": "blur",
      "startMs": 1200,
      "endMs": 5400,
      "bbox": [0.42, 0.18, 0.14, 0.22],
      "reviewerId": "OFC-4921",
      "aiAssisted": true,
      "keyframes": [
        { "timeMs": 1200, "bbox": [0.42, 0.18, 0.14, 0.22] },
        { "timeMs": 2400, "bbox": [0.45, 0.20, 0.14, 0.22] },
        { "timeMs": 5400, "bbox": [0.52, 0.24, 0.15, 0.23] }
      ]
    }
  ]
}
```

---

## 4. Defense-in-Depth Sanitization on Import

When importing JSON manifests from external sources, untrusted data must never be injected directly into state. The import pipeline executes four layers of sanitization:

```mermaid
flowchart TD
    subgraph Import_Ingestion["Untrusted Ingestion Pipeline"]
        A["Raw Imported JSON String"] -->|JSON.parse() Safe Exception Handling| B["Structural Schema Validation: Version 1.0.0"]
    end

    subgraph Defense_Sanitization["Defense-in-Depth Sanitization Filters"]
        B -->|Strip HTML Tags & Script Blocks| C["Label & Reviewer ID Sanitization: XSS Prevention"]
        C -->|Clamp Coordinates to 0.0 to 1.0| D["Bounding Box Rectification: Math.abs(w), normW >= 0.005"]
        D -->|Order startMs <= endMs| E["Temporal Window Ordering & Clamping"]
        E -->|Sort Chronologically ti < ti+1| F["Keyframe Sequence Alignment: timeMs Ordering"]
    end

    subgraph State_Admission["Validated State Admission"]
        F --> G["Validated Payload Admitted into useRedactions State"]
        G --> H["Canvas Overlay Immediately Redraws with Interpolated Bboxes"]
    end
```

1. **Structural Schema Validation:** Verifies required root keys (`version`, `metadata`, `redactions`) and validates that `version === '1.0.0'`.
2. **Label Sanitization & XSS Prevention:** Strips HTML markup, control characters, and script blocks:
   ```typescript
   export function sanitizeLabel(rawLabel: string): string {
     return rawLabel
       .replace(/<[^>]*>/g, '') // Strip HTML tags
       .replace(/[\x00-\x1F\x7F]/g, '') // Strip ASCII control characters
       .trim()
       .slice(0, 64) || 'Redaction';
   }
   ```
3. **Coordinate Rectification:** Clamps all bounding box values strictly to $[0.0, 1.0]$ and ensures positive width and height:
   ```typescript
   export function sanitizeBBox(bbox: unknown): NormalizedBBoxTuple {
     if (!Array.isArray(bbox) || bbox.length !== 4) {
       return [0.1, 0.1, 0.2, 0.2];
     }
     const [x, y, w, h] = bbox.map(v => typeof v === 'number' && !isNaN(v) ? v : 0);
     const normX = Math.max(0, Math.min(1, x));
     const normY = Math.max(0, Math.min(1, y));
     const normW = Math.max(0.005, Math.min(1 - normX, Math.abs(w)));
     const normH = Math.max(0.005, Math.min(1 - normY, Math.abs(h)));
     return [normX, normY, normW, normH];
   }
   ```
4. **Temporal Ordering:** Enforces $startMs \le endMs$ and sorts keyframe sequences chronologically ($t_i < t_{i+1}$).

---

## 5. Timecode Mathematics & Floating-Point Drift Prevention

### 5.1 The IEEE 754 Floating-Point Drift Problem
The HTML5 `<video>` element exposes `currentTime` in floating-point seconds. In JavaScript, repeated floating-point addition accumulates precision drift:

$$0.1 + 0.2 = 0.30000000000000004 \neq 0.3$$

Over a 60-minute bodycam video (108,000 frames at 30 FPS), floating-point drift accumulates by tens of milliseconds, causing redaction boxes to trigger one frame too early or late.

### 5.2 Integer Millisecond Representation
All internal timestamps, intervals, and keyframe records are strictly normalized to discrete integer milliseconds:

$$t_{\text{integer}} = \text{round}(t_{\text{seconds}} \times 1000)$$

### 5.3 SMPTE Timecode Formulations
Timecodes are formatted as standard SMPTE $HH:MM:SS:FF$:

$$\text{Total Frames} = \text{floor}\left( \frac{t_{\text{ms}} \times \text{FPS}}{1000} \right)$$

$$\text{Frames } (FF) = \text{Total Frames} \pmod{\text{FPS}}$$

$$\text{Total Seconds} = \text{floor}\left( \frac{t_{\text{ms}}}{1000} \right)$$

$$\text{Seconds } (SS) = \text{Total Seconds} \pmod{60}$$

$$\text{Minutes } (MM) = \text{floor}\left( \frac{\text{Total Seconds}}{60} \right) \pmod{60}$$

$$\text{Hours } (HH) = \text{floor}\left( \frac{\text{Total Seconds}}{3600} \right)$$

---

## 6. Computer Vision Dataset Interoperability

Because coordinates are stored in normalized video space $[0.0, 1.0]$, **canvas-redact** manifests map directly to standard machine learning object detection formats:

### 6.1 YOLO Format Conversion
YOLO represents bounding boxes as center coordinates and dimensions $[x_{\text{center}}, y_{\text{center}}, \text{width}, \text{height}]$:

$$x_{\text{center}} = x + \frac{w}{2}, \qquad y_{\text{center}} = y + \frac{h}{2}$$

$$w_{\text{yolo}} = w, \qquad h_{\text{yolo}} = h$$

### 6.2 COCO Format Conversion
COCO represents bounding boxes as pixel offsets $[x_{\text{min}}, y_{\text{min}}, \text{width}, \text{height}]$:

$$x_{\text{coco}} = x \times W_{\text{video}}, \qquad y_{\text{coco}} = y \times H_{\text{video}}$$

$$w_{\text{coco}} = w \times W_{\text{video}}, \qquad h_{\text{coco}} = h \times H_{\text{video}}$$
