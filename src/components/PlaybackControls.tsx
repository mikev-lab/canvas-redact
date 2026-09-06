/**
 * Playback controls and forensic timecode HUD.
 * Provides frame-accurate stepping, J/K/L shuttle speed indicators,
 * rate selection, volume adjustment, and WCAG 2.1 AAA screen reader live regions.
 */

import React from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Volume2,
  VolumeX,
  Gauge
} from 'lucide-react';
import { msToTimecode } from '../utils/timecode';

export interface PlaybackControlsProps {
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Current playback time in continuous milliseconds */
  currentTimeMs: number;
  /** Total video duration in milliseconds */
  durationMs: number;
  /** Forward playback rate multiplier (0.25 to 2) */
  playbackRate: number;
  /** Forensic shuttle speed (-4 to 4) */
  shuttleRate: number;
  /** Frames per second (default: 30) */
  fps: number;
  /** Audio output volume in range [0.0, 1.0] */
  volume: number;
  /** Audio mute status */
  isMuted: boolean;
  /** Whether video is loaded and ready */
  isReady: boolean;
  /** Play/pause toggle callback */
  onTogglePlay: () => void;
  /** Frame stepping callback */
  onStepFrame: (direction: 'forward' | 'backward', frameCount?: number) => void;
  /** Rate change callback */
  onSetRate: (rate: number) => void;
  /** J shuttle reverse callback */
  onShuttleReverse: () => void;
  /** K shuttle pause callback */
  onShuttlePause: () => void;
  /** L shuttle forward callback */
  onShuttleForward: () => void;
  /** Volume change callback */
  onSetVolume: (vol: number) => void;
  /** Mute toggle callback */
  onToggleMute: () => void;
}

/**
 * Forensic playback controller and timecode HUD bar.
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTimeMs,
  durationMs,
  playbackRate,
  shuttleRate,
  fps,
  volume,
  isMuted,
  isReady,
  onTogglePlay,
  onStepFrame,
  onSetRate,
  onShuttleReverse,
  onShuttlePause,
  onShuttleForward,
  onSetVolume,
  onToggleMute
}) => {
  const timecode = msToTimecode(currentTimeMs, fps);
  const totalTimecode = msToTimecode(durationMs, fps);
  const currentFrame = Math.round((currentTimeMs / 1000) * fps);

  return (
    <div
      className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg select-none"
      role="toolbar"
      aria-label="Video playback controls and forensic timecode"
    >
      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isPlaying
          ? `Playing at ${playbackRate}x speed. Timecode: ${timecode.formatted}`
          : `Paused at ${timecode.formatted}, Frame ${currentFrame}`}
      </div>

      {/* Left section: Playback & Frame Stepping Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Jump 1-second Backward (Shift + Left) */}
        <button
          type="button"
          onClick={() => onStepFrame('backward', Math.round(fps))}
          disabled={!isReady || currentTimeMs <= 0}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Jump 1 second backward (Shift + Left Arrow)"
          title="Jump 1s Backward (Shift+Left)"
        >
          <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Step 1 Frame Backward (Left Arrow) */}
        <button
          type="button"
          onClick={() => onStepFrame('backward', 1)}
          disabled={!isReady || currentTimeMs <= 0}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Step backward 1 frame (Left Arrow)"
          title="Step 1 Frame Back (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Primary Play / Pause Toggle Button (Space) */}
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!isReady}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium flex items-center gap-1.5 shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={isPlaying ? 'Pause video (Space)' : 'Play video (Space)'}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              <span className="text-xs font-semibold">PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span className="text-xs font-semibold">PLAY</span>
            </>
          )}
        </button>

        {/* Step 1 Frame Forward (Right Arrow) */}
        <button
          type="button"
          onClick={() => onStepFrame('forward', 1)}
          disabled={!isReady || (durationMs > 0 && currentTimeMs >= durationMs)}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Step forward 1 frame (Right Arrow)"
          title="Step 1 Frame Forward (Right Arrow)"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Jump 1-second Forward (Shift + Right) */}
        <button
          type="button"
          onClick={() => onStepFrame('forward', Math.round(fps))}
          disabled={!isReady || (durationMs > 0 && currentTimeMs >= durationMs)}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Jump 1 second forward (Shift + Right Arrow)"
          title="Jump 1s Forward (Shift+Right)"
        >
          <ChevronsRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Middle section: Forensic J/K/L Shuttle & Rate Selector */}
      <div className="flex items-center gap-3">
        {/* J/K/L Shuttle Speed Indicators */}
        <div
          className="flex items-center rounded bg-zinc-900 border border-zinc-800 p-0.5"
          role="group"
          aria-label="J/K/L Shuttle Playback Speed"
        >
          <button
            type="button"
            onClick={onShuttleReverse}
            disabled={!isReady}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
              shuttleRate < 0
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Reverse Shuttle (J)"
            aria-label="Reverse shuttle (J key)"
          >
            REV [J]
          </button>

          <button
            type="button"
            onClick={onShuttlePause}
            disabled={!isReady}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
              shuttleRate === 0 && !isPlaying
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Pause Shuttle (K)"
            aria-label="Pause shuttle (K key)"
          >
            PAUSE [K]
          </button>

          <button
            type="button"
            onClick={onShuttleForward}
            disabled={!isReady}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
              shuttleRate > 0 && isPlaying
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Forward Shuttle (L)"
            aria-label="Forward shuttle (L key)"
          >
            FWD [L]
          </button>
        </div>

        {/* Speed Indicator Badge */}
        {shuttleRate !== 0 && (
          <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/80">
            {shuttleRate > 0 ? `+${shuttleRate}x` : `${shuttleRate}x`}
          </span>
        )}

        {/* Normal Playback Rate Selector */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Gauge className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <select
            value={playbackRate}
            onChange={(e) => onSetRate(parseFloat(e.target.value))}
            disabled={!isReady}
            className="bg-zinc-900 text-zinc-200 text-xs rounded border border-zinc-700 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Select playback speed"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.5}>1.5x</option>
            <option value={2.0}>2.0x</option>
          </select>
        </div>

        {/* Volume / Mute Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            disabled={!isReady}
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-zinc-300" aria-hidden="true" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            disabled={!isReady}
            className="w-16 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Volume level"
          />
        </div>
      </div>

      {/* Right section: Forensic Timecode HUD */}
      <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-md">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-emerald-400 font-mono text-base font-bold tracking-wider">
              {timecode.formatted}
            </span>
            <span className="text-zinc-500 font-mono text-xs">/</span>
            <span className="text-zinc-400 font-mono text-xs">
              {totalTimecode.formatted}
            </span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between gap-2">
            <span>FR: {currentFrame.toString().padStart(4, '0')}</span>
            <span>{currentTimeMs}ms / {durationMs}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
