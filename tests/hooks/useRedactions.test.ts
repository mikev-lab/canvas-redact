import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRedactions } from '../../src/hooks/useRedactions';
import { RedactionBox, ExportPayload } from '../../src/types';

describe('useRedactions hook', () => {
  it('adds redaction, generates ID, sanitizes label, and auto-selects', () => {
    const { result } = renderHook(() => useRedactions(0));

    let createdId = '';
    act(() => {
      createdId = result.current.addRedaction({
        label: '<b>Suspect Face</b>',
        type: 'blur',
        startMs: 1000,
        endMs: 4000,
        bbox: [0.1, 0.2, 0.3, 0.4]
      });
    });

    expect(createdId).toMatch(/^redact-/);
    expect(result.current.redactions).toHaveLength(1);
    expect(result.current.selectedId).toBe(createdId);
    expect(result.current.selectedRedaction?.label).toBe('Suspect Face');
    expect(result.current.selectedRedaction?.type).toBe('blur');
  });

  it('filters activeRedactions strictly based on temporal validity window', () => {
    const initialBoxes: RedactionBox[] = [
      {
        id: 'box-1',
        label: 'Target A',
        type: 'blur',
        startMs: 1000,
        endMs: 3000,
        bbox: [0.1, 0.1, 0.2, 0.2]
      },
      {
        id: 'box-2',
        label: 'Target B',
        type: 'pixelate',
        startMs: 2500,
        endMs: 5000,
        bbox: [0.4, 0.4, 0.2, 0.2]
      }
    ];

    // At t = 500: neither is active
    const { result, rerender } = renderHook(
      ({ time }) => useRedactions(time, { initialRedactions: initialBoxes }),
      { initialProps: { time: 500 } }
    );
    expect(result.current.activeRedactions).toHaveLength(0);

    // At t = 1000: box-1 is active (inclusive boundary)
    rerender({ time: 1000 });
    expect(result.current.activeRedactions).toHaveLength(1);
    expect(result.current.activeRedactions[0]?.id).toBe('box-1');

    // At t = 2700: both box-1 and box-2 are active
    rerender({ time: 2700 });
    expect(result.current.activeRedactions).toHaveLength(2);

    // At t = 3000: both active (box-1 endMs inclusive)
    rerender({ time: 3000 });
    expect(result.current.activeRedactions).toHaveLength(2);

    // At t = 3001: only box-2 is active
    rerender({ time: 3001 });
    expect(result.current.activeRedactions).toHaveLength(1);
    expect(result.current.activeRedactions[0]?.id).toBe('box-2');

    // At t = 6000: neither is active
    rerender({ time: 6000 });
    expect(result.current.activeRedactions).toHaveLength(0);
  });

  it('updates redaction with label sanitization and auto-swaps inverted times', () => {
    const { result } = renderHook(() => useRedactions(0));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'Initial',
        type: 'blur',
        startMs: 1000,
        endMs: 2000,
        bbox: [0.1, 0.1, 0.2, 0.2]
      });
    });

    act(() => {
      result.current.updateRedaction(id, {
        label: '<script>evil()</script>Cleaned Label',
        startMs: 5000,
        endMs: 3000 // Inverted
      });
    });

    const updated = result.current.redactions.find(r => r.id === id);
    expect(updated?.label).toBe('Cleaned Label');
    expect(updated?.startMs).toBe(3000);
    expect(updated?.endMs).toBe(5000);
  });

  it('removes redaction and clears selectedId if active', () => {
    const { result } = renderHook(() => useRedactions(0));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'To Delete',
        type: 'blackout',
        startMs: 0,
        endMs: 1000,
        bbox: [0, 0, 0.1, 0.1]
      });
    });

    expect(result.current.selectedId).toBe(id);

    act(() => {
      result.current.removeRedaction(id);
    });

    expect(result.current.redactions).toHaveLength(0);
    expect(result.current.selectedId).toBeNull();
  });

  it('adjusts in-point and out-point with automatic duration extension', () => {
    const { result } = renderHook(() => useRedactions(0));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'Points Test',
        type: 'blur',
        startMs: 1000,
        endMs: 3000,
        bbox: [0, 0, 0.1, 0.1]
      });
    });

    // Set in-point to 4000 (exceeds out-point 3000): should extend out-point to 5000
    act(() => {
      result.current.setInPoint(id, 4000);
    });

    let box = result.current.redactions.find(r => r.id === id);
    expect(box?.startMs).toBe(4000);
    expect(box?.endMs).toBe(5000);

    // Set out-point to 2000 (precedes in-point 4000): should pull in-point to 1000
    act(() => {
      result.current.setOutPoint(id, 2000);
    });

    box = result.current.redactions.find(r => r.id === id);
    expect(box?.startMs).toBe(1000);
    expect(box?.endMs).toBe(2000);
  });

  it('cycles selection forward and backward through visible redactions', () => {
    const initialBoxes: RedactionBox[] = [
      { id: 'box-1', label: '1', type: 'blur', startMs: 0, endMs: 5000, bbox: [0, 0, 0.1, 0.1] },
      { id: 'box-2', label: '2', type: 'blur', startMs: 0, endMs: 5000, bbox: [0, 0, 0.1, 0.1] },
      { id: 'box-3', label: '3', type: 'blur', startMs: 0, endMs: 5000, bbox: [0, 0, 0.1, 0.1] }
    ];

    const { result } = renderHook(() => useRedactions(1000, { initialRedactions: initialBoxes }));

    // Cycle forward: null -> box-1 -> box-2 -> box-3 -> box-1
    act(() => {
      result.current.cycleSelection('forward');
    });
    expect(result.current.selectedId).toBe('box-1');

    act(() => {
      result.current.cycleSelection('forward');
    });
    expect(result.current.selectedId).toBe('box-2');

    act(() => {
      result.current.cycleSelection('forward');
    });
    expect(result.current.selectedId).toBe('box-3');

    act(() => {
      result.current.cycleSelection('forward');
    });
    expect(result.current.selectedId).toBe('box-1');

    // Cycle backward: box-1 -> box-3
    act(() => {
      result.current.cycleSelection('backward');
    });
    expect(result.current.selectedId).toBe('box-3');
  });

  it('imports valid ExportPayload and clears all on clearAll', () => {
    const { result } = renderHook(() => useRedactions(0));

    const payload: ExportPayload = {
      version: '1.0.0',
      metadata: {
        source: 'canvas-redact',
        videoName: 'test.mp4',
        durationMs: 5000,
        dimensions: { width: 1280, height: 720 },
        fps: 30,
        exportedAt: new Date().toISOString()
      },
      redactions: [
        {
          id: 'imported-1',
          label: 'Imported Plate',
          type: 'pixelate',
          startMs: 500,
          endMs: 2500,
          bbox: [0.2, 0.3, 0.4, 0.5]
        }
      ]
    };

    let success = false;
    act(() => {
      success = result.current.importPayload(payload);
    });

    expect(success).toBe(true);
    expect(result.current.redactions).toHaveLength(1);
    expect(result.current.selectedId).toBe('imported-1');

    // Clear all
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.redactions).toHaveLength(0);
    expect(result.current.selectedId).toBeNull();
  });

  it('sets, removes, and clears keyframes and computes dynamic activeRedactions interpolation', () => {
    let currentTime = 1000;
    const { result, rerender } = renderHook(() => useRedactions(currentTime));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'Moving Subject',
        type: 'blur',
        startMs: 0,
        endMs: 5000,
        bbox: [0.1, 0.1, 0.2, 0.2]
      });
    });

    // Record keyframe at t = 1000
    act(() => {
      result.current.setKeyframe(id, 1000, [0.1, 0.1, 0.2, 0.2]);
    });

    // Record keyframe at t = 3000 with moved box
    act(() => {
      result.current.setKeyframe(id, 3000, [0.3, 0.5, 0.2, 0.2]);
    });

    const box = result.current.redactions.find(r => r.id === id);
    // Seeded with startMs (0) anchor plus 1000 and 3000
    expect(box?.keyframes).toHaveLength(3);

    // At t = 2000 (midpoint), activeRedactions should output interpolated bbox [0.2, 0.3, 0.2, 0.2]
    currentTime = 2000;
    rerender();

    expect(result.current.activeRedactions[0]!.bbox).toEqual([0.2, 0.3, 0.2, 0.2]);
    expect(result.current.selectedRedaction?.bbox).toEqual([0.2, 0.3, 0.2, 0.2]);

    // Remove keyframe at 3000
    act(() => {
      result.current.removeKeyframe(id, 3000);
    });
    expect(result.current.redactions.find(r => r.id === id)?.keyframes).toHaveLength(2);

    // Clear all keyframes
    act(() => {
      result.current.clearKeyframes(id);
    });
    expect(result.current.redactions.find(r => r.id === id)?.keyframes).toBeUndefined();
  });

  it('automatically expands validity bounds [startMs, endMs] when setting keyframes beyond current span', () => {
    const { result } = renderHook(() => useRedactions(0));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'Tracking Target',
        type: 'blur',
        startMs: 1000,
        endMs: 3000,
        bbox: [0.1, 0.1, 0.2, 0.2]
      });
    });

    // Record keyframe at t = 5000 (past endMs of 3000)
    act(() => {
      result.current.setKeyframe(id, 5000, [0.4, 0.4, 0.2, 0.2]);
    });

    let box = result.current.redactions.find(r => r.id === id);
    expect(box?.startMs).toBe(1000);
    expect(box?.endMs).toBe(5000); // Auto-extended to encompass keyframe!

    // Record keyframe at t = 200 (before startMs of 1000)
    act(() => {
      result.current.setKeyframe(id, 200, [0.05, 0.05, 0.2, 0.2]);
    });

    box = result.current.redactions.find(r => r.id === id);
    expect(box?.startMs).toBe(200); // Auto-extended backward to encompass keyframe!
    expect(box?.endMs).toBe(5000);
  });

  it('preserves initial anchor keyframe when moving box at a later timestamp', () => {
    let currentTime = 0;
    const { result, rerender } = renderHook(() => useRedactions(currentTime));

    let id = '';
    act(() => {
      id = result.current.addRedaction({
        label: 'Moving Subject',
        type: 'blur',
        startMs: 0,
        endMs: 3000,
        bbox: [0.1, 0.1, 0.2, 0.2]
      });
    });

    // Move playhead forward to t = 1000
    currentTime = 1000;
    rerender();

    // User drags/moves the box at t = 1000
    act(() => {
      result.current.updateRedaction(id, {
        bbox: [0.3, 0.3, 0.2, 0.2]
      });
    });

    const box = result.current.redactions.find(r => r.id === id);
    // Should now contain 2 keyframes: initial anchor at 0ms and moved position at 1000ms
    expect(box?.keyframes).toBeDefined();
    expect(box?.keyframes).toHaveLength(2);
    expect(box?.keyframes?.[0]?.timeMs).toBe(0);
    expect(box?.keyframes?.[0]?.bbox).toEqual([0.1, 0.1, 0.2, 0.2]); // Initial origin preserved!
    expect(box?.keyframes?.[1]?.timeMs).toBe(1000);
    expect(box?.keyframes?.[1]?.bbox).toEqual([0.3, 0.3, 0.2, 0.2]);
  });
});
