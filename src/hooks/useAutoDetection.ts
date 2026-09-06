/**
 * React custom hook governing autonomous client-side video frame sampling,
 * face detection, multi-object tracking, and subject gallery aggregation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RedactionBox, RedactionType } from '../types';
import type { IDetector } from '../ai/detector';
import { SORTTracker, downsampleKeyframes } from '../ai/tracker';
import { TrackedSubject, KeyframeDensity } from '../ai/types';

export type AutoDetectionStatus = 'idle' | 'scanning' | 'reviewing' | 'applying';

export interface UseAutoDetectionOptions {
  /** Reference to the active HTML5 <video> element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Total video duration in milliseconds */
  durationMs: number;
  /** Active media frame rate (default: 30) */
  fps: number;
  /** Whether video is loaded and ready */
  isReady: boolean;
  /** Callback to commit approved redaction boxes into state */
  onApplyRedactions: (boxes: Array<Omit<RedactionBox, 'id'> & { id?: string }>) => void;
  /** Optional custom detector instance (for testing or model upgrades) */
  customDetector?: IDetector;
}

export interface UseAutoDetectionReturn {
  isOpen: boolean;
  status: AutoDetectionStatus;
  progressPercent: number;
  currentScanMs: number;
  durationMs: number;
  detectedSubjects: TrackedSubject[];
  selectedCount: number;
  markAiAssisted: boolean;
  hardwareAcceleration: 'webgpu' | 'cpu' | 'simulated';
  keyframeDensity: KeyframeDensity;
  setKeyframeDensity: (density: KeyframeDensity) => void;
  openModal: () => void;
  closeModal: () => void;
  startScan: (stepFrames?: number) => Promise<void>;
  cancelScan: () => void;
  toggleSubjectSelection: (subjectId: string) => void;
  updateSubjectTreatment: (subjectId: string, type: RedactionType) => void;
  updateSubjectLabel: (subjectId: string, label: string) => void;
  updateSubjectRange: (subjectId: string, startMs: number, endMs: number) => void;
  selectAllSubjects: () => void;
  deselectAllSubjects: () => void;
  setMarkAiAssisted: (enabled: boolean) => void;
  applySelectedRedactions: (reviewerId?: string) => void;
}

/**
 * Hook managing the automated detection pipeline and Subject Gallery state.
 */
export function useAutoDetection({
  videoRef,
  durationMs,
  fps,
  isReady,
  onApplyRedactions,
  customDetector,
}: UseAutoDetectionOptions): UseAutoDetectionReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AutoDetectionStatus>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentScanMs, setCurrentScanMs] = useState(0);
  const [detectedSubjects, setDetectedSubjects] = useState<TrackedSubject[]>([]);
  const [keyframeDensity, setKeyframeDensityState] = useState<KeyframeDensity>('balanced');
  const [markAiAssisted, setMarkAiAssisted] = useState(true);
  const [hardwareAcceleration, setHardwareAcceleration] = useState<'webgpu' | 'cpu' | 'simulated'>('webgpu');

  const isCancelledRef = useRef(false);
  // Lazily initialized detector and tracker to prevent large lumps on startup
  const detectorRef = useRef<IDetector | null>(customDetector || null);
  const trackerRef = useRef<SORTTracker | null>(null);

  // Detect WebGPU / Apple Neural Engine capability on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setHardwareAcceleration('webgpu');
    } else {
      setHardwareAcceleration('cpu');
    }
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
    // If no prior scan results, start in idle state ready to scan
    if (detectedSubjects.length === 0) {
      setStatus('idle');
      setProgressPercent(0);
      setCurrentScanMs(0);
    } else {
      setStatus('reviewing');
    }
  }, [detectedSubjects.length]);

  const closeModal = useCallback(() => {
    if (status === 'scanning') {
      isCancelledRef.current = true;
    }
    setIsOpen(false);
  }, [status]);

  const cancelScan = useCallback(() => {
    isCancelledRef.current = true;
    setStatus('idle');
    setProgressPercent(0);
    setCurrentScanMs(0);
  }, []);

  const toggleSubjectSelection = useCallback((subjectId: string) => {
    setDetectedSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, selected: !s.selected } : s))
    );
  }, []);

  const updateSubjectTreatment = useCallback((subjectId: string, type: RedactionType) => {
    setDetectedSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, type } : s))
    );
  }, []);

  const updateSubjectLabel = useCallback((subjectId: string, label: string) => {
    setDetectedSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, label } : s))
    );
  }, []);

  const updateSubjectRange = useCallback((subjectId: string, startMs: number, endMs: number) => {
    setDetectedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const validStart = Math.min(startMs, endMs);
        const validEnd = Math.max(startMs, endMs);
        return {
          ...s,
          startMs: validStart,
          endMs: validEnd,
          // Filter trajectory to within selected window
          trajectory: s.trajectory.filter((k) => k.timeMs >= validStart && k.timeMs <= validEnd),
        };
      })
    );
  }, []);

  const selectAllSubjects = useCallback(() => {
    setDetectedSubjects((prev) => prev.map((s) => ({ ...s, selected: true })));
  }, []);

  const deselectAllSubjects = useCallback(() => {
    setDetectedSubjects((prev) => prev.map((s) => ({ ...s, selected: false })));
  }, []);

  /**
   * Dynamically re-downsamples all confirmed subject trajectories when the auditor
   * adjusts the keyframe density profile without re-scanning video frames.
   */
  const setKeyframeDensity = useCallback((density: KeyframeDensity) => {
    setKeyframeDensityState(density);
    setDetectedSubjects((prev) =>
      prev.map((s) => {
        if (!s.samples || s.samples.length === 0) return s;
        const newTrajectory = downsampleKeyframes(s.samples, density);
        const filteredTrajectory = newTrajectory.filter(
          (k) => k.timeMs >= s.startMs && k.timeMs <= s.endMs
        );
        return {
          ...s,
          trajectory: filteredTrajectory,
        };
      })
    );
  }, []);

  /**
   * Runs the automated video frame extraction, inference, and tracking loop.
   */
  const startScan = useCallback(
    async (stepFrames: number = 5) => {
      if (!isReady || durationMs <= 0) return;

      isCancelledRef.current = false;
      setStatus('scanning');
      setProgressPercent(0);
      setCurrentScanMs(0);

      // Lazily instantiate detector and tracker to prevent bundle bloating
      if (!detectorRef.current) {
        const { createDefaultDetector } = await import('../ai/detector');
        detectorRef.current = createDefaultDetector();
      }
      if (!trackerRef.current) {
        trackerRef.current = new SORTTracker(8, 2, 0.25);
      }

      const video = videoRef.current;
      const frameDurationMs = 1000 / (fps || 30);
      const stepMs = Math.max(33, stepFrames * frameDurationMs);

      trackerRef.current.reset();

      const offscreenCanvas = document.createElement('canvas');
      const videoWidth = video?.videoWidth || 1920;
      const videoHeight = video?.videoHeight || 1080;
      offscreenCanvas.width = videoWidth;
      offscreenCanvas.height = videoHeight;
      const offscreenCtx = offscreenCanvas.getContext('2d');

      let scanTimeMs = 0;

      try {
        while (scanTimeMs <= durationMs) {
          if (isCancelledRef.current) {
            setStatus('idle');
            return;
          }

          setCurrentScanMs(scanTimeMs);
          const percent = Math.min(100, Math.round((scanTimeMs / durationMs) * 100));
          setProgressPercent(percent);

          // Seek video to sample timestamp if video element is present
          if (video && !video.paused) {
            video.pause();
          }

          if (video && offscreenCtx) {
            // Await video seek to requested timestamp
            await new Promise<void>((resolve) => {
              let isResolved = false;
              const handleSeeked = () => {
                if (!isResolved) {
                  isResolved = true;
                  video.removeEventListener('seeked', handleSeeked);
                  resolve();
                }
              };
              video.addEventListener('seeked', handleSeeked);
              video.currentTime = scanTimeMs / 1000;

              // Safety timeout for rapid seeks in headless/jsdom tests
              setTimeout(() => {
                if (!isResolved) {
                  isResolved = true;
                  video.removeEventListener('seeked', handleSeeked);
                  resolve();
                }
              }, 100);
            });

            // Draw current video frame to offscreen buffer
            offscreenCtx.drawImage(video, 0, 0, videoWidth, videoHeight);

            // Execute frame face detection
            const detections = await detectorRef.current.detect(
              offscreenCanvas,
              videoWidth,
              videoHeight
            );

            // Feed detections into multi-object tracker
            trackerRef.current.update(detections, scanTimeMs);
          } else {
            // Simulated / mock fallback if video is unavailable
            await new Promise((r) => setTimeout(r, 20));
          }

          scanTimeMs += stepMs;
        }

        // Finalize scan: collect confirmed subjects with cropped thumbnails and rate-limited keyframes
        const subjects = trackerRef.current.getConfirmedSubjects(
          offscreenCanvas,
          videoWidth,
          videoHeight,
          'blur',
          keyframeDensity
        );

        setDetectedSubjects(subjects);
        setProgressPercent(100);
        setStatus('reviewing');
      } catch (err) {
        console.error('Automated detection error:', err);
        setStatus('idle');
      }
    },
    [durationMs, fps, isReady, keyframeDensity, videoRef]
  );

  /**
   * Commits approved subjects as RedactionBox annotations into the main state.
   */
  const applySelectedRedactions = useCallback(
    (reviewerId?: string) => {
      const selected = detectedSubjects.filter((s) => s.selected);
      if (selected.length === 0) return;

      setStatus('applying');

      const boxesToCreate: Array<Omit<RedactionBox, 'id'> & { id?: string }> = selected.map(
        (subject) => {
          const initialBBox =
            subject.trajectory[0]?.bbox || ([0.4, 0.3, 0.2, 0.2] as import('../types').NormalizedBBoxTuple);

          return {
            label: subject.label,
            type: subject.type,
            startMs: subject.startMs,
            endMs: subject.endMs,
            bbox: initialBBox,
            keyframes: subject.trajectory,
            aiAssisted: markAiAssisted,
            reviewerId: reviewerId || undefined,
          };
        }
      );

      onApplyRedactions(boxesToCreate);
      setStatus('idle');
      setIsOpen(false);
    },
    [detectedSubjects, markAiAssisted, onApplyRedactions]
  );

  const selectedCount = detectedSubjects.filter((s) => s.selected).length;

  return {
    isOpen,
    status,
    progressPercent,
    currentScanMs,
    durationMs,
    detectedSubjects,
    selectedCount,
    markAiAssisted,
    hardwareAcceleration,
    keyframeDensity,
    setKeyframeDensity,
    openModal,
    closeModal,
    startScan,
    cancelScan,
    toggleSubjectSelection,
    updateSubjectTreatment,
    updateSubjectLabel,
    updateSubjectRange,
    selectAllSubjects,
    deselectAllSubjects,
    setMarkAiAssisted,
    applySelectedRedactions,
  };
}
