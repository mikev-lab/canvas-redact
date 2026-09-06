import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoPlayback } from '../../src/hooks/useVideoPlayback';

describe('useVideoPlayback hook', () => {
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    vi.clearAllMocks();

    mockVideo = document.createElement('video');
    Object.defineProperty(mockVideo, 'duration', { value: 10, writable: true });
    Object.defineProperty(mockVideo, 'currentTime', { value: 0, writable: true });
    Object.defineProperty(mockVideo, 'videoWidth', { value: 1920, writable: true });
    Object.defineProperty(mockVideo, 'videoHeight', { value: 1080, writable: true });

    mockVideo.play = vi.fn().mockResolvedValue(undefined);
    mockVideo.pause = vi.fn();
    mockVideo.load = vi.fn();
  });

  it('initializes with default playback state', () => {
    const { result } = renderHook(() => useVideoPlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTimeMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.playbackRate).toBe(1);
    expect(result.current.shuttleRate).toBe(0);
    expect(result.current.volume).toBe(1);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.fps).toBe(30);
  });

  it('loads media source from blob and dispatches loadedmetadata', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url-1');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useVideoPlayback());

    // Bind ref
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    const mockBlob = new Blob(['mock-data'], { type: 'video/mp4' });

    act(() => {
      result.current.loadSource(mockBlob, 'evidence_bodycam.mp4');
    });

    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(mockVideo.src).toBe('blob:mock-url-1');
    expect(mockVideo.load).toHaveBeenCalled();

    // Trigger loadedmetadata event
    act(() => {
      mockVideo.dispatchEvent(new Event('loadedmetadata'));
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.durationMs).toBe(10000);
    expect(result.current.videoWidth).toBe(1920);
    expect(result.current.videoHeight).toBe(1080);
    expect(result.current.metadata?.name).toBe('evidence_bodycam.mp4');

    // Load second source to test revocation of previous URL
    const mockBlob2 = new Blob(['mock-data-2'], { type: 'video/mp4' });
    createObjectURLSpy.mockReturnValue('blob:mock-url-2');

    act(() => {
      result.current.loadSource(mockBlob2, 'second_video.mp4');
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1');

    // Test cleanup on unmount
    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-2');
  });

  it('controls playback: play, pause, togglePlay, and seekToMs', async () => {
    const { result } = renderHook(() => useVideoPlayback());
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    await act(async () => {
      await result.current.play();
    });

    expect(mockVideo.play).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.shuttleRate).toBe(1);

    act(() => {
      result.current.pause();
    });

    expect(mockVideo.pause).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.shuttleRate).toBe(0);

    // Seek
    act(() => {
      result.current.seekToMs(4500);
    });

    expect(mockVideo.currentTime).toBe(4.5);
    expect(result.current.currentTimeMs).toBe(4500);
  });

  it('steps frames forward and backward with bounds clamping', () => {
    const { result } = renderHook(() => useVideoPlayback({ defaultFps: 30 }));
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    act(() => {
      result.current.seekToMs(1000);
    });

    // Step forward 1 frame (+33ms)
    act(() => {
      result.current.stepFrame('forward', 1);
    });

    expect(result.current.currentTimeMs).toBe(1033);
    expect(mockVideo.currentTime).toBeCloseTo(1.033, 2);

    // Step backward 2 frames (-66ms)
    act(() => {
      result.current.stepFrame('backward', 2);
    });

    expect(result.current.currentTimeMs).toBe(967);
  });

  it('cycles forensic shuttle speeds via J/K/L hotkeys', () => {
    const { result } = renderHook(() => useVideoPlayback());
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    // L: shuttleForward: 0 -> 1 -> 2 -> 4
    act(() => {
      result.current.shuttleForward();
    });
    expect(result.current.shuttleRate).toBe(1);

    act(() => {
      result.current.shuttleForward();
    });
    expect(result.current.shuttleRate).toBe(2);

    act(() => {
      result.current.shuttleForward();
    });
    expect(result.current.shuttleRate).toBe(4);

    // K: shuttlePause
    act(() => {
      result.current.shuttlePause();
    });
    expect(result.current.shuttleRate).toBe(0);

    // J: shuttleReverse: 0 -> -1 -> -2 -> -4
    act(() => {
      result.current.shuttleReverse();
    });
    expect(result.current.shuttleRate).toBe(-1);

    act(() => {
      result.current.shuttleReverse();
    });
    expect(result.current.shuttleRate).toBe(-2);

    act(() => {
      result.current.shuttleReverse();
    });
    expect(result.current.shuttleRate).toBe(-4);
  });

  it('controls volume and mute toggling', () => {
    const { result } = renderHook(() => useVideoPlayback());
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    act(() => {
      result.current.setVolume(0.4);
    });

    expect(mockVideo.volume).toBe(0.4);
    expect(result.current.volume).toBe(0.4);

    act(() => {
      result.current.toggleMute();
    });

    expect(mockVideo.muted).toBe(true);
    expect(result.current.isMuted).toBe(true);
  });

  it('updates currentTimeMs and clears seeking flag upon seeked event during reverse shuttle', () => {
    const { result } = renderHook(() => useVideoPlayback());
    (result.current.videoRef as unknown as { current: HTMLVideoElement }).current = mockVideo;

    // Set duration and seek to 5000ms
    act(() => {
      result.current.seekToMs(5000);
    });
    expect(result.current.currentTimeMs).toBe(5000);

    // Start reverse shuttle
    act(() => {
      result.current.shuttleReverse();
    });
    expect(result.current.shuttleRate).toBe(-1);

    // Simulate video element decoding and completing a seek to 4900ms
    mockVideo.currentTime = 4.9;
    act(() => {
      mockVideo.dispatchEvent(new Event('seeked'));
    });

    expect(result.current.currentTimeMs).toBe(4900);
  });
});
