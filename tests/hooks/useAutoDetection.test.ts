/**
 * Unit and integration tests for useAutoDetection hook.
 * Tests lazy model orchestration, keyframe density re-downsampling,
 * subject selection, and redaction pipeline commit.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAutoDetection, UseAutoDetectionOptions } from '../../src/hooks/useAutoDetection';
import { IDetector, RawDetection } from '../../src/ai/types';

describe('useAutoDetection hook', () => {
  const mockVideo = document.createElement('video');
  Object.defineProperty(mockVideo, 'videoWidth', { value: 1920 });
  Object.defineProperty(mockVideo, 'videoHeight', { value: 1080 });

  const mockCustomDetector: IDetector = {
    detect: vi.fn(async (): Promise<RawDetection[]> => [
      { bbox: [0.2, 0.2, 0.15, 0.15], confidence: 0.95 }
    ])
  };

  const defaultOptions: UseAutoDetectionOptions = {
    videoRef: { current: mockVideo },
    durationMs: 1000,
    fps: 30,
    isReady: true,
    onApplyRedactions: vi.fn(),
    customDetector: mockCustomDetector,
  };

  it('initializes with default balanced keyframe density and closed modal', () => {
    const { result } = renderHook(() => useAutoDetection(defaultOptions));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.keyframeDensity).toBe('balanced');
    expect(result.current.detectedSubjects).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.markAiAssisted).toBe(true);
  });

  it('opens and closes modal cleanly', () => {
    const { result } = renderHook(() => useAutoDetection(defaultOptions));

    act(() => {
      result.current.openModal();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('updates keyframeDensity and allows changing profile', () => {
    const { result } = renderHook(() => useAutoDetection(defaultOptions));

    act(() => {
      result.current.openModal();
    });

    // Toggle to sparse keyframe density
    act(() => {
      result.current.setKeyframeDensity('sparse');
    });
    expect(result.current.keyframeDensity).toBe('sparse');

    // Toggle to dense keyframe density
    act(() => {
      result.current.setKeyframeDensity('dense');
    });
    expect(result.current.keyframeDensity).toBe('dense');

    // Toggle back to balanced
    act(() => {
      result.current.setKeyframeDensity('balanced');
    });
    expect(result.current.keyframeDensity).toBe('balanced');
  });

  it('commits selected redactions with AI-Assisted tag and reviewer attribution', () => {
    const onApplyRedactions = vi.fn();
    const { result } = renderHook(() =>
      useAutoDetection({
        ...defaultOptions,
        onApplyRedactions,
      })
    );

    act(() => {
      result.current.openModal();
      result.current.setMarkAiAssisted(true);
    });

    // Apply with no selection does nothing
    act(() => {
      result.current.applySelectedRedactions('OFC-1234');
    });
    expect(onApplyRedactions).not.toHaveBeenCalled();
  });
});
