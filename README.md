# canvas-redact

> **High-performance, frame-accurate React + HTML5 Canvas video scrubber for evidence bounding box redaction and forensic timeline annotation.**

[![CI](https://github.com/mikev-lab/canvas-redact/actions/workflows/ci.yml/badge.svg)](https://github.com/mikev-lab/canvas-redact/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Interactive%20Scrubber-emerald?style=flat&logo=googlechrome&logoColor=white)](https://mikev-lab.github.io/canvas-redact/)
[![WCAG 2.1 AAA](https://img.shields.io/badge/WCAG%202.1-Level%20AAA-emerald)](https://www.w3.org/WAI/WCAG21/quickref/?levels=aaa)
[![Air-Gapped](https://img.shields.io/badge/Privacy-100%25%20Air--Gapped-blue)](https://github.com/mikev-lab/canvas-redact)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178c6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-zinc)](LICENSE)

---

> 🚀 **Live Interactive Demo:** [https://mikev-lab.github.io/canvas-redact/](https://mikev-lab.github.io/canvas-redact/)  
> *(Runs 100% client-side with zero install: drag and drop any local video file to begin)*

---

## Executive Overview

**canvas-redact** is a lightweight, zero-external-dependency React and HTML5 Canvas application built for public safety agencies, forensic investigators, legal counsel, and computer vision annotation teams. It provides sub-millisecond, frame-accurate video playback with real-time 60 FPS privacy redaction filters (Gaussian blur, mosaic pixelation, and opaque blackout).

Engineered specifically for evidence handling, **canvas-redact** operates **100% client-side** inside the browser. Media files are processed locally via native HTML5 video and offscreen canvas buffers. Zero bytes of video data are ever transmitted across a network, ensuring complete chain-of-custody privacy.

---

## Key Capabilities

* **100% Client-Side & Air-Gapped:** Zero telemetry, zero analytics tracking, and zero remote network requests. Media files never leave the local browser environment.
* **Frame-Accurate Video Engine & Multi-Rate Ingestion:** Synchronized to native video hardware clocks supporting standard 30 FPS, 24 FPS (film/cinematic), 25 FPS (PAL), 50/60 FPS (high-speed bodycams/dashcams), and low-FPS surveillance media (1, 5, 10, 12, and 15 FPS CCTV systems).
* **Real-Time 60 FPS Redaction Canvas:**
  * **Gaussian Defocus Blur:** Soft privacy blur applied via hardware-accelerated 2D context filtering.
  * **Mosaic Pixelation:** Spatial subsampling rendered using an offscreen scratch buffer with nearest-neighbor interpolation.
  * **Solid Blackout:** Complete opaque censor masking with centered metadata labels.
* **Dynamic Keyframe Trajectories & Moving Redactions:** Piecewise linear bounding box interpolation (`lerp`) across continuous timestamps at 60 FPS. Censorship moves smoothly with walking subjects, running suspects, or moving vehicles without popping.
* **Rapid Forensic Censor Tracking Mode:** Specialized rotoscoping workflow tying keyframe recording and automatic stepping to the `Space` bar (or `M`/`Enter`), enabling operators to track moving targets frame-by-frame with zero friction.
* **Decoder-Gated Smooth Reverse Playback:** Eliminates browser video decoder queue starvation and seek thrashing during `J` shuttle scrubbing by strictly gating seek requests on decoder readiness and binding immediate canvas redraws to the native `'seeked'` event.
* **Personnel Chain of Custody & Reviewer ID Stamping:** Automatic employee / reviewer badge ID attribution stamped onto all newly created redaction entries and serialized into manifest metadata for court-admissible audit trails.
* **Customizable Frame Jump Stepping:** Instant multi-frame navigation with configurable jump distances (1, 2, 5, 10, or 30 frames) triggered via `Shift + Left/Right Arrow` or quick-action toolbar buttons.
* **Normalized Video Space $[0.0, 1.0]$:** All bounding box coordinates are calculated and stored as fractional ratios relative to intrinsic video dimensions, ensuring display invariance across responsive resizing, full-screen mode, and letterbox pillarboxing.
* **8-Point Handle Transformation Geometry:** Interactive resize handles with automatic coordinate inversion math when dragged past opposing boundaries.
* **Multi-Track Forensic Timeline:** Drag-and-seek playhead, calibrated time ruler, visual interval validity bars, interactive diamond keyframe markers, and draggable In/Out point marker brackets.
* **Forensic Shuttle & Keyboard Controls:** Industry-standard video editing navigation (`Space`, `J/K/L` shuttle speeds from -4x to 4x, 1-frame steppers, customizable jumps, `[` and `]` in/out markers).
* **Evidence Review Import & Export Schema (`v1.0.0`):** Bi-directional evidence manifest handling (export and import) with keyframe trajectory persistence, defense-in-depth label sanitization, coordinate clamping, and automatic timestamp ordering.
* **Client-Side Face Tracking & Auto-Redaction Architecture:** Designed for local, zero-network facial detection and re-identification trajectories using in-browser WebAssembly/WebGPU runtimes.
* **Drag-and-Drop Forensic Workspace:** Instant video ingestion with automatic hardware aspect-ratio preservation, native letterboxing detection, and zero file upload latency.
* **WCAG 2.1 Level AAA Accessibility:** Enhanced $\ge 7:1$ contrast against obsidian surfaces, visible high-contrast focus rings, full keyboard operability without a mouse, multi-modal indicator coding, and ARIA live regions.

---

## Forensic Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Space` | Play / Pause or Keyframe Step | Toggle playback (or in Tracking Mode: mark keyframe and step) |
| `T` | Censor Tracking Mode | Toggle Tracking Mode (Space marks keyframe and steps forward) |
| `M` / `Enter` | Mark Keyframe | Record keyframe for selected box at current timestamp |
| `Alt + Left Arrow` | Previous Keyframe | Jump playhead to previous recorded trajectory keyframe |
| `Alt + Right Arrow` | Next Keyframe | Jump playhead to next recorded trajectory keyframe |
| `J` | Shuttle Reverse | Accelerate reverse playback (-1x, -2x, -4x) via RAF seeking |
| `K` | Shuttle Pause | Pause playback (0x) |
| `L` | Shuttle Forward | Accelerate forward playback (1x, 2x, 4x) |
| `Left Arrow` | Step Back 1 Frame | Step backward exactly 1 frame (33.33ms at 30 FPS) |
| `Right Arrow` | Step Forward 1 Frame | Step forward exactly 1 frame (33.33ms at 30 FPS) |
| `Shift + Left Arrow` | Jump Back | Seek backward by custom jump frames (1f, 2f, 5f, 10f, 30f) |
| `Shift + Right Arrow` | Jump Forward | Seek forward by custom jump frames (1f, 2f, 5f, 10f, 30f) |
| `[` | Set In-Point | Mark beginning timestamp (`startMs`) for selected box |
| `]` | Set Out-Point | Mark ending timestamp (`endMs`) for selected box |
| `Tab` / `Shift + Tab` | Cycle Selection | Navigate focus through active bounding boxes |
| `Delete` / `Backspace` | Delete Redaction | Remove the currently selected annotation box |
| `Escape` | Deselect / Cancel | Deselect active box, cancel active drag, or close modals |
| `?` | Shortcuts Cheat Sheet | Open accessible keyboard hotkeys dialog |

*Note: Global keyboard shortcuts are automatically bypassed when focusing inside text inputs or textareas.*

---

## Architecture & Technical Design

```mermaid
flowchart TD
    subgraph Media_Layer["Media Engine & Hardware Clock"]
        VID["HTML5 Video Element (Hardware Decode)"]
        DEC["Decoder-Gated Seek Controller: isSeekingRef"]
        FILE["Drag-and-Drop Local Media: URL.createObjectURL()"]
        FILE --> VID
        VID -->|Native timeupdate & seeked| VP["useVideoPlayback Hook"]
        VP -->|Reverse Shuttle Seeks| DEC
        DEC -->|video.currentTime = targetSec| VID
    end

    subgraph State_Management["Reactive State Machines & Computer Vision"]
        VP -->|Integer Millisecond Timecode & Rate| CTL["PlaybackControls & Timeline"]
        VP -->|Current Timestamp t| LERP["Keyframe Interpolation Engine (Lerp)"]
        
        PTR["User Pointer Gestures"] --> FSM["useCanvasInteraction (4-State FSM)"]
        FSM -->|8-Point Inversion Math| GEO["Normalized Geometry Engine [0.0, 1.0]"]
        GEO -->|Commit Bounding Box| RED["useRedactions Hook"]
        
        HOTKEY["Tracking Mode (T + Space)"] -->|Forward-Projected Bounds| EXT["Jump Extension: minEndMs"]
        EXT --> RED
        
        VID -->|Offscreen Frame Sampling| AI["useAutoDetection (Lazy-Loaded)"]
        AI -->|2D Kalman Filter + Hungarian IoU| SORT["SORT Multi-Object Tracker"]
        SORT -->|Subject Gallery & Treatment Selectors| MOD["AutoRedactModal"]
        MOD -->|Commit Tracklets with aiAssisted: true| RED
        
        ID["Reviewer Badge ID: OFC-XXXX"] -->|Chain of Custody Stamping| RED
        RED -->|Chronological Keyframe Sequence| LERP
    end

    subgraph Rendering_Pipeline["60 FPS Canvas Redaction Engine"]
        LERP -->|Active Interpolated Boxes| OVL["CanvasOverlay Component"]
        VID -->|Direct Video Frames| OVL
        DEC -->|Immediate seeked Redraw| OVL
        OVL -->|GPU Filters: Blur / Pixelate / Blackout| DISP["Visual Display Viewport (60 FPS)"]
    end

    subgraph Evidentiary_Export["Forensic Audit & Manifest Export"]
        RED -->|Sanitize Labels & Clamp Coordinates| EXP["ExportModal Dialog"]
        EXP -->|Public Safety v1.0.0 JSON Contract| FILE_OUT["Evidence Manifest File Download"]
    end
```

---

## Engineering Deep Dives & Architectural Documentation

To provide full transparency into the system architecture, mathematical formulations, and engineering trade-offs, **canvas-redact** includes dedicated technical deep dives:

| Document | Focus Areas | Key Technical Highlights |
| :--- | :--- | :--- |
| [Master Architecture Specification](docs/ARCHITECTURE.md) | System Topology & Development Rationale | End-to-end data flow, 10 development trade-off rationales, court admissibility standards |
| [Canvas Redaction Engine & Coordinate Math](docs/CANVAS_ENGINE.md) | 2D Canvas & Real-Time Graphics | 4-space coordinate pipeline, Retina DPI scaling, 8-point handle inversion math, GPU filters |
| [Reactive Hooks & State Machines](docs/STATE_MACHINES_AND_HOOKS.md) | State Management & Lifecycle Governance | 4-state pointer FSM, decoder-gated reverse seeking, rotoscoping tracking workflow |
| [Client-Side AI & Tracking Engine](docs/AI_TRACKING_ENGINE.md) | Computer Vision & Machine Learning | Pure TypeScript 2D Kalman filter, SORT tracking, zero-lump lazy loading |
| [Forensic Evidential Standards](docs/FORENSIC_STANDARDS.md) | Evidence Integrity & Accessibility | Non-destructive vectors, Reviewer ID attribution, WCAG 2.1 Level AAA compliance |
| [Data Models & Export Schemas](docs/DATA_MODELS_AND_SCHEMAS.md) | Domain Models & Machine Learning Data | Schema `v1.0.0`, XSS sanitization, integer millisecond math, YOLO/COCO conversion |
| [Testing Strategy & Test Pyramid](docs/TESTING_STRATEGY.md) | Software Quality & Verification Gates | 3-layer test pyramid, 19 suites / 162 automated tests, CI pipeline automation |

---


## Evidence Export Contract (`v1.0.0`)

Exported redaction manifests validate against the public safety evidence review schema:

```json
{
  "version": "1.0.0",
  "metadata": {
    "source": "canvas-redact",
    "videoName": "bodycam_incident_04.mp4",
    "durationMs": 14200,
    "dimensions": { "width": 1920, "height": 1080 },
    "exportedAt": "2026-09-06T00:30:00.000Z",
    "reviewerId": "OFC-4921"
  },
  "redactions": [
    {
      "id": "redact-1725580000000",
      "label": "Suspect Face",
      "type": "blur",
      "startMs": 1200,
      "endMs": 5400,
      "bbox": [0.42, 0.18, 0.14, 0.22],
      "reviewerId": "OFC-4921"
    }
  ]
}
```

---

## Getting Started

### Prerequisites
* Node.js 18.0 or higher
* npm 9.0 or higher

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/mikev-lab/canvas-redact.git
cd canvas-redact

# Install dependencies deterministically
npm ci

# Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Drag and drop any local video file (MP4, WebM, MOV) or click "Open Video" to begin scrubbing and annotating immediately.

### Verification & Testing

```bash
# Run strict TypeScript diagnostics
npm run typecheck

# Run full Vitest automated test suite
npm test

# Build production bundle
npm run build
```

---

## Technology Stack

* **UI Framework:** React 18 + TypeScript (Strict Mode)
* **Build Tooling:** Vite + PostCSS
* **Styling & Design System:** Tailwind CSS (Obsidian dark theme, WCAG 2.1 AAA contrast ratios)
* **Graphics & Video Engine:** Native HTML5 `<video>` and `<canvas>` 2D Context (Zero external player dependencies)
* **Icons:** `lucide-react`
* **Test Harness:** Vitest + React Testing Library + `@testing-library/jest-dom`

---

## Forensic Privacy & Zero-Telemetry Guarantee

1. **Air-Gapped Execution:** The application does not include any third-party telemetry, analytics scripts, crash trackers, or external API endpoints.
2. **Local Memory Governance:** Media uploaded to the application is loaded into browser memory via local Object URLs (`URL.createObjectURL`), which are immediately revoked (`URL.revokeObjectURL`) when changing media or unmounting.
3. **Data Sanitization:** All user-supplied labels are sanitized against cross-site scripting (XSS) vectors before canvas rendering or DOM display.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
