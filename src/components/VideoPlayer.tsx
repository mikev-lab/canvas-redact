/**
 * Video player container maintaining strict aspect-ratio alignment between
 * the base HTML5 <video> element and the interactive CanvasOverlay.
 */

import React, { useRef, useState } from 'react';
import { CanvasOverlay, CanvasOverlayProps } from './CanvasOverlay';
import { Upload } from 'lucide-react';

export interface VideoPlayerProps extends Omit<CanvasOverlayProps, 'videoDimensions'> {
  /** Intrinsic pixel width of raw video */
  videoWidth: number;
  /** Intrinsic pixel height of raw video */
  videoHeight: number;
  /** Whether video is loaded and ready for frame rendering */
  isReady: boolean;
  /** Video file upload callback */
  onFileUpload?: (file: File) => void;
  /** JSON evidence manifest import callback */
  onImportJson?: (rawJson: string) => boolean;
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
  onFileUpload,
  onImportJson,
  ...canvasProps
}) => {
  const dropInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Calculate aspect ratio string (e.g. "16 / 9") or fallback to standard 16:9
  const aspectRatioStyle = videoWidth > 0 && videoHeight > 0
    ? { aspectRatio: `${videoWidth} / ${videoHeight}` }
    : { aspectRatio: '16 / 9' };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
      if (onImportJson) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result;
          if (typeof text === 'string') {
            onImportJson(text);
          }
        };
        reader.readAsText(file);
      }
    } else if (onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full max-w-full mx-auto bg-zinc-950 rounded-lg overflow-hidden border shadow-2xl flex items-center justify-center transition-colors ${
        isDraggingOver && isReady ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-zinc-800'
      }`}
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

      {/* Active Video Drag-Over Drop Target Notification */}
      {isDraggingOver && isReady && (
        <div className="absolute inset-0 bg-blue-950/80 border-2 border-dashed border-blue-400 rounded-lg flex flex-col items-center justify-center z-30 pointer-events-none text-center p-6 backdrop-blur-xs">
          <Upload className="w-10 h-10 text-blue-300 mb-2 animate-bounce" aria-hidden="true" />
          <p className="text-sm font-bold text-white font-mono">Drop JSON Manifest or Video File</p>
          <p className="text-xs text-blue-200 mt-1">
            Release to import court evidence annotations or load new video
          </p>
        </div>
      )}

      {/* Empty State Drag-and-Drop Evidence Workspace */}
      {!isReady && (
        <div
          onClick={() => dropInputRef.current?.click()}
          className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-colors z-20 ${
            isDraggingOver
              ? 'bg-blue-950/40 border-2 border-dashed border-blue-500'
              : 'bg-zinc-950/90 border-2 border-dashed border-zinc-800 hover:border-zinc-700'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dropInputRef.current?.click();
            }
          }}
          aria-label="Upload evidence video file by dragging or clicking"
        >
          <input
            ref={dropInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onFileUpload) {
                onFileUpload(file);
              }
              e.target.value = '';
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-blue-400">
            <Upload className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-white mb-1">
            Drop Evidence Video Here
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Drag and drop an MP4, WebM, MOV, or MKV file, or click to browse.
          </p>

          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select File</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
