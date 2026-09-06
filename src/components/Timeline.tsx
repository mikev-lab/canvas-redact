/**
 * Multi-track forensic timeline scrubber.
 * Visualizes media duration ruler, playhead position, redaction validity windows,
 * and draggable In/Out point markers for the active annotation.
 */

import React, { useRef, useCallback, useState } from 'react';
import { RedactionBox } from '../types';
import { msToTimecode } from '../utils/timecode';

export interface TimelineProps {
  /** Current playback timestamp in milliseconds */
  currentTimeMs: number;
  /** Total media duration in milliseconds */
  durationMs: number;
  /** Frames per second (default: 30) */
  fps: number;
  /** Redaction annotation collection */
  redactions: RedactionBox[];
  /** Currently selected redaction ID or null */
  selectedId: string | null;
  /** Seek callback */
  onSeek: (targetMs: number) => void;
  /** Redaction selection callback */
  onSelectRedaction: (id: string | null) => void;
  /** In-point change callback */
  onSetInPoint: (id: string, startMs: number) => void;
  /** Out-point change callback */
  onSetOutPoint: (id: string, endMs: number) => void;
}

/**
 * Interactive timeline scrubber with multi-track segment visualization.
 */
export const Timeline: React.FC<TimelineProps> = ({
  currentTimeMs,
  durationMs,
  fps,
  redactions,
  selectedId,
  onSeek,
  onSelectRedaction,
  onSetInPoint,
  onSetOutPoint
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null);

  const selectedBox = redactions.find(r => r.id === selectedId);

  // Convert pointer event clientX to timeline millisecond offset
  const getMsFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || durationMs <= 0) return 0;

      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * durationMs);
    },
    [durationMs]
  );

  // Pointer down initiates scrubbing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (durationMs <= 0) return;
    setIsScrubbing(true);
    const targetMs = getMsFromClientX(e.clientX);
    onSeek(targetMs);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const ms = getMsFromClientX(moveEvent.clientX);
      onSeek(ms);
    };

    const handlePointerUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerMoveHover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (durationMs <= 0) return;
    const ms = getMsFromClientX(e.clientX);
    setHoverTimeMs(ms);
  };

  const handlePointerLeave = () => {
    setHoverTimeMs(null);
  };

  // Keyboard seek support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (durationMs <= 0) return;
    const frameMs = Math.round(1000 / fps);
    const secondMs = 1000;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        onSeek(Math.max(0, currentTimeMs - frameMs));
        break;
      case 'ArrowRight':
        e.preventDefault();
        onSeek(Math.min(durationMs, currentTimeMs + frameMs));
        break;
      case 'PageUp':
        e.preventDefault();
        onSeek(Math.max(0, currentTimeMs - secondMs));
        break;
      case 'PageDown':
        e.preventDefault();
        onSeek(Math.min(durationMs, currentTimeMs + secondMs));
        break;
      case 'Home':
        e.preventDefault();
        onSeek(0);
        break;
      case 'End':
        e.preventDefault();
        onSeek(durationMs);
        break;
    }
  };

  const playheadPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;
  const hoverPercent = hoverTimeMs !== null && durationMs > 0 ? (hoverTimeMs / durationMs) * 100 : null;

  // Generate 5 evenly spaced time markers
  const markerCount = 5;
  const markers = Array.from({ length: markerCount }, (_, i) => {
    const fraction = i / (markerCount - 1);
    const ms = Math.round(fraction * durationMs);
    return {
      fraction,
      percent: fraction * 100,
      label: msToTimecode(ms, fps).formatted
    };
  });

  return (
    <div
      className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 shadow select-none"
      role="region"
      aria-label="Timeline scrubber and annotation tracks"
    >
      {/* Time ruler labels */}
      <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1 px-1">
        {markers.map((m, idx) => (
          <span key={idx} style={{ left: `${m.percent}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Main interactive scrubber track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMoveHover}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Media playhead timeline"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={currentTimeMs}
        aria-valuetext={msToTimecode(currentTimeMs, fps).formatted}
        className="relative h-14 bg-zinc-900 rounded border border-zinc-800 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        {/* Subtle grid ticks */}
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-full w-px bg-zinc-600" />
          ))}
        </div>

        {/* Hover Time Indicator Tooltip */}
        {hoverPercent !== null && hoverTimeMs !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/40 pointer-events-none z-30"
            style={{ left: `${hoverPercent}%` }}
          >
            <div className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-zinc-800 text-white text-[10px] font-mono border border-zinc-700 shadow pointer-events-none">
              {msToTimecode(hoverTimeMs, fps).formatted}
            </div>
          </div>
        )}

        {/* Multi-Track Redaction Segments */}
        <div className="absolute inset-x-0 top-1 bottom-1 flex flex-col justify-center gap-1 px-1 pointer-events-none">
          {redactions.map((box) => {
            if (durationMs <= 0) return null;
            const isSelected = box.id === selectedId;
            const leftPct = (box.startMs / durationMs) * 100;
            const widthPct = Math.max(0.5, ((box.endMs - box.startMs) / durationMs) * 100);

            // Color coding based on redaction category
            let barColor = 'bg-blue-600/60 border-blue-400 text-blue-100';
            if (box.type === 'pixelate') {
              barColor = 'bg-amber-600/60 border-amber-400 text-amber-100';
            } else if (box.type === 'blackout') {
              barColor = 'bg-zinc-700/80 border-zinc-400 text-zinc-100';
            }

            return (
              <div
                key={box.id}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRedaction(box.id);
                  onSeek(box.startMs);
                }}
                className={`relative h-3 rounded border text-[9px] font-mono font-semibold px-1 flex items-center shadow-sm pointer-events-auto cursor-pointer transition-all ${barColor} ${
                  isSelected ? 'ring-2 ring-white border-white brightness-125 z-20' : 'opacity-80 hover:opacity-100'
                }`}
                title={`${box.label} (${box.type}): ${msToTimecode(box.startMs, fps).formatted} -> ${msToTimecode(box.endMs, fps).formatted}`}
              >
                <span className="truncate mr-1">{box.label}</span>

                {/* Keyframe Diamond Markers */}
                {box.keyframes && box.keyframes.map((k, kIdx) => {
                  const segDuration = Math.max(1, box.endMs - box.startMs);
                  const kOffsetPct = Math.max(0, Math.min(100, ((k.timeMs - box.startMs) / segDuration) * 100));
                  const isKeyframeActive = Math.abs(currentTimeMs - k.timeMs) <= (1000 / fps) * 0.75;
                  return (
                    <div
                      key={`kf-${box.id}-${kIdx}`}
                      style={{ left: `${kOffsetPct}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRedaction(box.id);
                        onSeek(k.timeMs);
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 z-30 pointer-events-auto cursor-pointer shadow transition-transform ${
                        isKeyframeActive
                          ? 'bg-amber-400 border border-amber-100 scale-125 ring-2 ring-amber-400/60'
                          : 'bg-white hover:bg-amber-200 border border-zinc-900 hover:scale-125'
                      }`}
                      title={`Keyframe at ${msToTimecode(k.timeMs, fps).formatted} (Click to jump)`}
                      aria-label={`Keyframe for ${box.label} at ${msToTimecode(k.timeMs, fps).formatted}`}
                      role="button"
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* In-Point and Out-Point Bracket Markers for Selected Box */}
        {selectedBox && durationMs > 0 && (
          <>
            {/* In-Point Marker handle [ */}
            <div
              style={{ left: `${(selectedBox.startMs / durationMs) * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const handleMove = (ev: PointerEvent) => {
                  const ms = getMsFromClientX(ev.clientX);
                  onSetInPoint(selectedBox.id, ms);
                };
                const handleUp = () => {
                  window.removeEventListener('pointermove', handleMove);
                  window.removeEventListener('pointerup', handleUp);
                };
                window.addEventListener('pointermove', handleMove);
                window.addEventListener('pointerup', handleUp);
              }}
              className="absolute top-0 bottom-0 w-2.5 bg-emerald-500/80 hover:bg-emerald-400 cursor-ew-resize z-20 flex items-center justify-center border-l-2 border-emerald-300 shadow"
              title={`In-Point: ${msToTimecode(selectedBox.startMs, fps).formatted} (Drag to adjust or press [)`}
            >
              <span className="text-[10px] text-white font-bold leading-none select-none">[</span>
            </div>

            {/* Out-Point Marker handle ] */}
            <div
              style={{ left: `${(selectedBox.endMs / durationMs) * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const handleMove = (ev: PointerEvent) => {
                  const ms = getMsFromClientX(ev.clientX);
                  onSetOutPoint(selectedBox.id, ms);
                };
                const handleUp = () => {
                  window.removeEventListener('pointermove', handleMove);
                  window.removeEventListener('pointerup', handleUp);
                };
                window.addEventListener('pointermove', handleMove);
                window.addEventListener('pointerup', handleUp);
              }}
              className="absolute top-0 bottom-0 w-2.5 bg-red-500/80 hover:bg-red-400 cursor-ew-resize z-20 flex items-center justify-center border-r-2 border-red-300 shadow -translate-x-full"
              title={`Out-Point: ${msToTimecode(selectedBox.endMs, fps).formatted} (Drag to adjust or press ])`}
            >
              <span className="text-[10px] text-white font-bold leading-none select-none">]</span>
            </div>
          </>
        )}

        {/* Playhead Needle & Scrubber Cap */}
        <div
          style={{ left: `${playheadPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-40"
        >
          {/* Top scrubber diamond/handle */}
          <div
            className={`w-3 h-3.5 bg-red-500 border border-white rounded-b-sm -translate-x-[5px] shadow-md transition-transform ${
              isScrubbing ? 'scale-125' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
};
