/**
 * React hook governing redaction bounding box annotation state,
 * active temporal window slicing, selection, and evidence schema import.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { RedactionBox, ExportPayload, NormalizedBBoxTuple, RedactionType } from '../types';
import { sanitizeLabel, validateAndSanitizeImport } from '../utils/export';
import { interpolateBBox, upsertKeyframe, removeKeyframeNear } from '../utils/keyframes';

export interface UseRedactionsOptions {
  /** Initial redaction collection */
  initialRedactions?: RedactionBox[];
  /** Default redaction category for newly created boxes */
  defaultType?: RedactionType;
}

export interface UseRedactionsReturn {
  /** All saved redactions */
  redactions: RedactionBox[];
  /** Currently selected redaction ID or null */
  selectedId: string | null;
  /** Active redaction entities visible at the current timecode */
  activeRedactions: RedactionBox[];
  /** The currently selected RedactionBox or null */
  selectedRedaction: RedactionBox | null;
  /** Create a new redaction box with unique ID and auto-selection */
  addRedaction: (box: Omit<RedactionBox, 'id'>) => string;
  /** Update existing redaction box attributes */
  updateRedaction: (id: string, updates: Partial<Omit<RedactionBox, 'id'>>) => void;
  /** Delete a redaction box by ID */
  removeRedaction: (id: string) => void;
  /** Set active selection by ID */
  selectRedaction: (id: string | null) => void;
  /** Adjust in-point (start timestamp) with automatic inversion correction */
  setInPoint: (id: string, startMs: number) => void;
  /** Adjust out-point (end timestamp) with automatic inversion correction */
  setOutPoint: (id: string, endMs: number) => void;
  /** Record or update a keyframe snapshot for a redaction at a specific timestamp with optional minimum end boundary */
  setKeyframe: (id: string, timeMs: number, bbox: NormalizedBBoxTuple, minEndMs?: number) => void;
  /** Remove a keyframe near a specific timestamp */
  removeKeyframe: (id: string, timeMs: number) => void;
  /** Clear all keyframes from a redaction box */
  clearKeyframes: (id: string) => void;
  /** Cycle selection forward or backward through visible redactions (Tab / Shift+Tab) */
  cycleSelection: (direction?: 'forward' | 'backward') => void;
  /** Reset all redactions and clear selection */
  clearAll: () => void;
  /** Import external evidence review JSON payload */
  importPayload: (payload: ExportPayload) => boolean;
}

/**
 * Custom hook providing state management and temporal slicing for video redaction annotations.
 *
 * @param currentTimeMs - Current playback timestamp in milliseconds.
 * @param options - Initial configuration options.
 * @returns Redaction collection state, active temporal slices, and mutation dispatchers.
 */
export function useRedactions(
  currentTimeMs: number,
  options: UseRedactionsOptions = {}
): UseRedactionsReturn {
  const [redactions, setRedactions] = useState<RedactionBox[]>(() => options.initialRedactions || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const idCounterRef = useRef(1);

  // Active redactions filtered by current timecode window [startMs, endMs] with dynamic interpolation
  const activeRedactions = useMemo(() => {
    return redactions
      .filter(r => currentTimeMs >= r.startMs && currentTimeMs <= r.endMs)
      .map(r => {
        if (!r.keyframes || r.keyframes.length === 0) {
          return r;
        }
        return {
          ...r,
          bbox: interpolateBBox(r.keyframes, r.bbox, currentTimeMs)
        };
      });
  }, [redactions, currentTimeMs]);

  // Selected redaction lookup with interpolated bounding box
  const selectedRedaction = useMemo(() => {
    if (!selectedId) return null;
    const found = redactions.find(r => r.id === selectedId);
    if (!found) return null;
    if (found.keyframes && found.keyframes.length > 0) {
      return {
        ...found,
        bbox: interpolateBBox(found.keyframes, found.bbox, currentTimeMs)
      };
    }
    return found;
  }, [redactions, selectedId, currentTimeMs]);

  const addRedaction = useCallback((box: Omit<RedactionBox, 'id'>): string => {
    const id = `redact-${Date.now()}-${idCounterRef.current++}`;
    const sanitizedLabel = sanitizeLabel(box.label || 'Redaction');

    // Ensure valid temporal bounds
    const startMs = Math.min(box.startMs, box.endMs);
    const endMs = Math.max(box.startMs, box.endMs);

    // Ensure normalized bbox coordinates [0..1]
    const clampedBbox: NormalizedBBoxTuple = [
      Math.max(0, Math.min(1, box.bbox[0])),
      Math.max(0, Math.min(1, box.bbox[1])),
      Math.max(0, Math.min(1 - Math.max(0, Math.min(1, box.bbox[0])), box.bbox[2])),
      Math.max(0, Math.min(1 - Math.max(0, Math.min(1, box.bbox[1])), box.bbox[3]))
    ];

    const newRedaction: RedactionBox = {
      ...box,
      id,
      label: sanitizedLabel,
      startMs,
      endMs,
      bbox: clampedBbox
    };

    setRedactions(prev => [...prev, newRedaction]);
    setSelectedId(id);
    return id;
  }, []);

  const updateRedaction = useCallback((id: string, updates: Partial<Omit<RedactionBox, 'id'>>) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;

        let nextLabel = r.label;
        if (updates.label !== undefined) {
          nextLabel = sanitizeLabel(updates.label);
        }

        let nextStartMs = updates.startMs !== undefined ? updates.startMs : r.startMs;
        let nextEndMs = updates.endMs !== undefined ? updates.endMs : r.endMs;

        // Auto-correct inverted start/end timestamps
        if (nextStartMs > nextEndMs) {
          const temp = nextStartMs;
          nextStartMs = nextEndMs;
          nextEndMs = temp;
        }

        let nextBbox = r.bbox;
        let nextKeyframes = r.keyframes;
        if (updates.bbox) {
          const [normX, normY, normW, normH] = updates.bbox;
          const clampedX = Math.max(0, Math.min(1, normX));
          const clampedY = Math.max(0, Math.min(1, normY));
          const clampedW = Math.max(0, Math.min(1 - clampedX, normW));
          const clampedH = Math.max(0, Math.min(1 - clampedY, normH));
          const clampedBbox: NormalizedBBoxTuple = [clampedX, clampedY, clampedW, clampedH];

          // If the box already has keyframes OR we are moving it at a timestamp different from startMs
          if ((nextKeyframes && nextKeyframes.length > 0) || currentTimeMs > r.startMs) {
            const baseKeyframes = nextKeyframes && nextKeyframes.length > 0
              ? nextKeyframes
              : [{ timeMs: r.startMs, bbox: r.bbox }];

            nextKeyframes = upsertKeyframe(baseKeyframes, currentTimeMs, clampedBbox);
            // Automatically expand temporal validity window if dragged outside initial bounds
            nextStartMs = Math.min(nextStartMs, currentTimeMs);
            nextEndMs = Math.max(nextEndMs, currentTimeMs);
          } else {
            nextBbox = clampedBbox;
          }
        }

        return {
          ...r,
          ...updates,
          label: nextLabel,
          startMs: nextStartMs,
          endMs: nextEndMs,
          bbox: nextBbox,
          ...(nextKeyframes ? { keyframes: nextKeyframes } : {})
        };
      })
    );
  }, [currentTimeMs]);

  const removeRedaction = useCallback((id: string) => {
    setRedactions(prev => prev.filter(r => r.id !== id));
    setSelectedId(prev => (prev === id ? null : prev));
  }, []);

  const selectRedaction = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const setInPoint = useCallback((id: string, startMs: number) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        // If new start point exceeds end point, auto-extend end point by 1000ms
        const nextEndMs = startMs > r.endMs ? startMs + 1000 : r.endMs;
        return {
          ...r,
          startMs,
          endMs: nextEndMs
        };
      })
    );
  }, []);

  const setOutPoint = useCallback((id: string, endMs: number) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        // If new out point precedes start point, auto-adjust start point
        const nextStartMs = endMs < r.startMs ? Math.max(0, endMs - 1000) : r.startMs;
        return {
          ...r,
          startMs: nextStartMs,
          endMs
        };
      })
    );
  }, []);

  const setKeyframe = useCallback((id: string, timeMs: number, bbox: NormalizedBBoxTuple, minEndMs?: number) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        let existingKeyframes = r.keyframes;
        if (!existingKeyframes || existingKeyframes.length === 0) {
          // Anchor initial frame at startMs to preserve origin position
          existingKeyframes = [{ timeMs: r.startMs, bbox: r.bbox }];
        }
        const updatedKeyframes = upsertKeyframe(existingKeyframes, timeMs, bbox);

        // Automatically expand the temporal validity window [startMs, endMs] to encompass the new keyframe
        // and optionally extend to the projected next jump so tracking does not cut off abruptly
        const nextStartMs = Math.min(r.startMs, timeMs);
        const nextEndMs = Math.max(r.endMs, timeMs, minEndMs ?? timeMs);

        return {
          ...r,
          startMs: nextStartMs,
          endMs: nextEndMs,
          bbox: timeMs <= r.startMs ? bbox : r.bbox,
          keyframes: updatedKeyframes
        };
      })
    );
  }, []);

  const removeKeyframe = useCallback((id: string, timeMs: number) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updatedKeyframes = removeKeyframeNear(r.keyframes, timeMs);
        return {
          ...r,
          keyframes: updatedKeyframes.length > 0 ? updatedKeyframes : undefined
        };
      })
    );
  }, []);

  const clearKeyframes = useCallback((id: string) => {
    setRedactions(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const { keyframes: _, ...rest } = r;
        return rest;
      })
    );
  }, []);

  const cycleSelection = useCallback((direction: 'forward' | 'backward' = 'forward') => {
    const list = activeRedactions.length > 0 ? activeRedactions : redactions;
    if (list.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId) {
      const first = list[0];
      const last = list[list.length - 1];
      if (direction === 'forward' && first) {
        setSelectedId(first.id);
      } else if (last) {
        setSelectedId(last.id);
      }
      return;
    }

    const currentIndex = list.findIndex(r => r.id === selectedId);
    if (currentIndex === -1) {
      const first = list[0];
      if (first) setSelectedId(first.id);
      return;
    }

    const nextIndex = direction === 'forward'
      ? (currentIndex + 1) % list.length
      : (currentIndex - 1 + list.length) % list.length;

    const nextItem = list[nextIndex];
    if (nextItem) {
      setSelectedId(nextItem.id);
    }
  }, [activeRedactions, redactions, selectedId]);

  const clearAll = useCallback(() => {
    setRedactions([]);
    setSelectedId(null);
  }, []);

  const importPayload = useCallback((payload: ExportPayload): boolean => {
    const validated = validateAndSanitizeImport(JSON.stringify(payload));
    if (!validated) {
      return false;
    }

    setRedactions(validated.redactions);
    const firstRedaction = validated.redactions[0];
    setSelectedId(firstRedaction ? firstRedaction.id : null);
    return true;
  }, []);

  return {
    redactions,
    selectedId,
    activeRedactions,
    selectedRedaction,
    addRedaction,
    updateRedaction,
    removeRedaction,
    selectRedaction,
    setInPoint,
    setOutPoint,
    setKeyframe,
    removeKeyframe,
    clearKeyframes,
    cycleSelection,
    clearAll,
    importPayload
  };
}
