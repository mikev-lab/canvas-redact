/**
 * React hook governing HTML5 video playback, frame-accurate stepping,
 * J/K/L forensic shuttle controls, and Object URL memory lifecycle.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoMetadata } from '../types';
import { stepFrameTime } from '../utils/timecode';

export interface PlaybackState {
  /** Whether media is actively playing forward */
  isPlaying: boolean;
  /** Current playback timecode in continuous milliseconds */
  currentTimeMs: number;
  /** Total media duration in milliseconds */
  durationMs: number;
  /** Forward playback rate multiplier (0.25x to 2x) */
  playbackRate: number;
  /** Forensic shuttle speed: negative for reverse, 0 for paused, positive for forward */
  shuttleRate: number;
  /** Audio output volume in range [0.0, 1.0] */
  volume: number;
  /** Whether audio output is muted */
  isMuted: boolean;
  /** Intrinsic pixel width of raw video frame */
  videoWidth: number;
  /** Intrinsic pixel height of raw video frame */
  videoHeight: number;
  /** Whether video metadata is loaded and ready for frame extraction */
  isReady: boolean;
  /** Configured or detected frames per second */
  fps: number;
  /** Active media metadata */
  metadata: VideoMetadata | null;
}

export interface PlaybackActions {
  /** Play media forward */
  play: () => Promise<void>;
  /** Pause media playback */
  pause: () => void;
  /** Toggle between play and pause states */
  togglePlay: () => void;
  /** Seek directly to target timestamp in milliseconds */
  seekToMs: (targetMs: number) => void;
  /** Frame-accurate single or multi-frame stepping */
  stepFrame: (direction: 'forward' | 'backward', frameCount?: number) => void;
  /** Set regular forward playback rate (e.g. 0.25, 0.5, 1, 2) */
  setRate: (rate: number) => void;
  /** Shuttle forward (L key): advances through 1x, 2x, 4x */
  shuttleForward: () => void;
  /** Shuttle reverse (J key): advances through -1x, -2x, -4x */
  shuttleReverse: () => void;
  /** Shuttle pause (K key): resets shuttle rate to 0 and pauses */
  shuttlePause: () => void;
  /** Update volume [0.0, 1.0] */
  setVolume: (volume: number) => void;
  /** Toggle audio mute state */
  toggleMute: () => void;
  /** Load media from URL, File, or Blob with automatic Object URL cleanup */
  loadSource: (source: string | File | Blob, name?: string) => void;
}

export interface UseVideoPlaybackReturn extends PlaybackState, PlaybackActions {
  /** Reference callback to attach to the HTML5 <video> element */
  videoRef: React.RefObject<HTMLVideoElement>;
}

export interface UseVideoPlaybackOptions {
  /** Initial frames per second standard (default: 30) */
  defaultFps?: number;
}

/**
 * Custom hook providing robust, frame-accurate control over HTML5 video elements.
 *
 * @param options - Configuration options such as default FPS.
 * @returns Combined playback state, action dispatchers, and video DOM ref.
 */
export function useVideoPlayback(options: UseVideoPlaybackOptions = {}): UseVideoPlaybackReturn {
  const defaultFps = options.defaultFps ?? 30;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastReverseTickRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuttleRate, setShuttleRate] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [fps] = useState(defaultFps);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Synchronize state from HTML5 video element
  const syncFromVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const ms = Math.round(video.currentTime * 1000);
    setCurrentTimeMs(ms);

    const dur = Number.isFinite(video.duration) && video.duration > 0
      ? Math.round(video.duration * 1000)
      : 0;
    setDurationMs(dur);

    setIsPlaying(!video.paused && !video.ended);
    setPlaybackRateState(video.playbackRate);
    setVolumeState(video.volume);
    setIsMuted(video.muted);
    setVideoWidth(video.videoWidth || 0);
    setVideoHeight(video.videoHeight || 0);
  }, []);

  // Frame sync render loop using requestAnimationFrame
  useEffect(() => {
    let active = true;

    const tick = (timestamp: number) => {
      if (!active) return;

      const video = videoRef.current;
      if (video) {
        // Normal forward playback RAF sync
        if (!video.paused && !video.ended) {
          const ms = Math.round(video.currentTime * 1000);
          setCurrentTimeMs(ms);
        }

        // Reverse shuttle emulation loop
        if (shuttleRate < 0) {
          if (lastReverseTickRef.current !== null) {
            const deltaSec = (timestamp - lastReverseTickRef.current) / 1000;
            const stepSec = deltaSec * Math.abs(shuttleRate);
            const targetSec = Math.max(0, video.currentTime - stepSec);

            video.currentTime = targetSec;
            setCurrentTimeMs(Math.round(targetSec * 1000));

            if (targetSec <= 0) {
              setShuttleRate(0);
              video.pause();
            }
          }
          lastReverseTickRef.current = timestamp;
        } else {
          lastReverseTickRef.current = null;
        }
      }

      if (isPlaying || shuttleRate < 0) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    if (isPlaying || shuttleRate < 0) {
      rafIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, shuttleRate]);

  // Clean up Object URLs when unmounting
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setShuttleRate(1);
    video.playbackRate = 1;
    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      // Browser autoplay policy or media error
    }
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setShuttleRate(0);
    video.pause();
    setIsPlaying(false);
    syncFromVideo();
  }, [syncFromVideo]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || shuttleRate !== 1) {
      void play();
    } else {
      pause();
    }
  }, [play, pause, shuttleRate]);

  const seekToMs = useCallback((targetMs: number) => {
    const video = videoRef.current;
    if (!video) return;

    const maxMs = Number.isFinite(video.duration) && video.duration > 0
      ? Math.round(video.duration * 1000)
      : durationMs;

    const clampedMs = Math.max(0, Math.min(targetMs, maxMs));
    video.currentTime = clampedMs / 1000;
    setCurrentTimeMs(clampedMs);
  }, [durationMs]);

  const stepFrame = useCallback((direction: 'forward' | 'backward', frameCount: number = 1) => {
    const video = videoRef.current;
    if (!video) return;

    // Stepping automatically pauses playback and resets shuttle
    if (!video.paused) {
      video.pause();
    }
    setShuttleRate(0);
    setIsPlaying(false);

    const deltaFrames = direction === 'forward' ? frameCount : -frameCount;
    const currentMs = Math.round(video.currentTime * 1000);
    const maxMs = Number.isFinite(video.duration) && video.duration > 0
      ? Math.round(video.duration * 1000)
      : durationMs;

    const nextMs = stepFrameTime(currentMs, deltaFrames, maxMs, fps);
    video.currentTime = nextMs / 1000;
    setCurrentTimeMs(Math.round(nextMs));
  }, [durationMs, fps]);

  const setRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRateState(rate);
    if (shuttleRate > 0) {
      setShuttleRate(rate);
    }
  }, [shuttleRate]);

  const shuttleForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    let nextRate = 1;
    if (shuttleRate <= 0) {
      nextRate = 1;
    } else if (shuttleRate === 1) {
      nextRate = 2;
    } else if (shuttleRate >= 2) {
      nextRate = 4;
    }

    setShuttleRate(nextRate);
    video.playbackRate = nextRate;
    void video.play();
    setIsPlaying(true);
  }, [shuttleRate]);

  const shuttleReverse = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause native forward video element to let RAF drive reverse frames
    if (!video.paused) {
      video.pause();
    }
    setIsPlaying(false);

    let nextRate = -1;
    if (shuttleRate >= 0) {
      nextRate = -1;
    } else if (shuttleRate === -1) {
      nextRate = -2;
    } else if (shuttleRate <= -2) {
      nextRate = -4;
    }

    setShuttleRate(nextRate);
  }, [shuttleRate]);

  const shuttlePause = useCallback(() => {
    pause();
  }, [pause]);

  const setVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedVol = Math.max(0, Math.min(1, vol));
    video.volume = clampedVol;
    setVolumeState(clampedVol);
    if (clampedVol > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const loadSource = useCallback((source: string | File | Blob, name?: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Revoke previous blob URL to prevent memory leaks
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    setIsReady(false);
    setIsPlaying(false);
    setShuttleRate(0);
    setCurrentTimeMs(0);

    let url: string;
    let fileName = name || 'evidence_video.mp4';
    let mimeType = 'video/mp4';
    let sizeBytes: number | undefined;

    if (typeof source === 'string') {
      url = source;
    } else {
      url = URL.createObjectURL(source);
      activeBlobUrlRef.current = url;
      if (source instanceof File) {
        fileName = source.name;
        mimeType = source.type || 'video/mp4';
        sizeBytes = source.size;
      } else {
        mimeType = source.type || 'video/mp4';
        sizeBytes = source.size;
      }
    }

    video.src = url;
    video.load();

    const handleLoadedMetadata = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0
        ? Math.round(video.duration * 1000)
        : 0;

      setDurationMs(dur);
      setVideoWidth(video.videoWidth || 0);
      setVideoHeight(video.videoHeight || 0);
      setIsReady(true);

      setMetadata({
        name: fileName,
        durationMs: dur,
        dimensions: {
          width: video.videoWidth || 0,
          height: video.videoHeight || 0
        },
        fps,
        mimeType,
        sizeBytes
      });

      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
  }, [fps]);

  return {
    videoRef,
    isPlaying,
    currentTimeMs,
    durationMs,
    playbackRate,
    shuttleRate,
    volume,
    isMuted,
    videoWidth,
    videoHeight,
    isReady,
    fps,
    metadata,
    play,
    pause,
    togglePlay,
    seekToMs,
    stepFrame,
    setRate,
    shuttleForward,
    shuttleReverse,
    shuttlePause,
    setVolume,
    toggleMute,
    loadSource
  };
}
