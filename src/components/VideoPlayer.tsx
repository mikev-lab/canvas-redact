/**
 * Video player container maintaining strict aspect-ratio alignment between
 * the base HTML5 <video> element and the interactive CanvasOverlay.
 */

import React from 'react';
import { CanvasOverlay, CanvasOverlayProps } from './CanvasOverlay';
import { Film } from 'lucide-react';

export interface VideoPlayerProps extends Omit<CanvasOverlayProps, 'videoDimensions'> {
  /** Intrinsic pixel width of raw video */
  videoWidth: number;
  /** Intrinsic pixel height of raw video */
  videoHeight: number;
  /** Whether video is loaded and ready for frame rendering */
  isReady: boolean;
  /** Trigger to load sample CCTV video when empty */
  onLoadSample: () => void;
}

/**
 * Aspect-ratio preserving media player and canvas viewport.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  canvasRef,
  videoWidth,
  videoHeight,
  isReady,
  onLoadSample,
  ...canvasProps
}) => {
  // Calculate aspect ratio string (e.g. "16 / 9") or fallback to standard 16:9
  const aspectRatioStyle = videoWidth > 0 && videoHeight > 0
    ? { aspectRatio: `${videoWidth} / ${videoHeight}` }
    : { aspectRatio: '16 / 9' };

  return (
    <div
      className="relative w-full max-w-full mx-auto bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center"
      style={{ maxHeight: 'calc(100vh - 280px)', ...aspectRatioStyle }}
    >
      {/* Native HTML5 Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        preload="auto"
        className="w-full h-full object-contain block select-none pointer-events-none"
        aria-label="Raw forensic video media feed"
      />

      {/* Synchronized 2D Redaction Canvas Overlay */}
      {isReady && (
        <CanvasOverlay
          {...canvasProps}
          videoRef={videoRef}
          canvasRef={canvasRef}
          videoDimensions={{
            width: videoWidth || 1920,
            height: videoHeight || 1080
          }}
        />
      )}

      {/* Empty State Overlay if no media loaded */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 z-20">
          <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-500">
            <Film className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            No Evidence Media Loaded
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            Load an MP4/WebM video file from your local workstation or generate a procedural synthetic CCTV demo clip to begin redaction.
          </p>
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Generate and load procedural synthetic CCTV demo evidence"
          >
            Load CCTV Evidence Demo
          </button>
        </div>
      )}
    </div>
  );
};
