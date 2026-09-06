/**
 * Root Application Container & Global Forensic Keyboard Coordinator.
 * Connects video playback engine, annotation state machine, and canvas interaction
 * gestures into an accessible, responsive WCAG 2.1 Level AAA workspace.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVideoPlayback } from './hooks/useVideoPlayback';
import { useRedactions } from './hooks/useRedactions';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { createSampleVideo } from './sample/createSampleVideo';
import { createExportPayload, validateAndSanitizeImport } from './utils/export';

import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { PlaybackControls } from './components/PlaybackControls';
import { Timeline } from './components/Timeline';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 1. Media Playback Hook
  const playback = useVideoPlayback({ defaultFps: 30 });

  // 2. Redaction Annotation State Hook
  const redactionsState = useRedactions(playback.currentTimeMs);

  // 3. Direct Canvas Pointer Interaction Hook
  const interaction = useCanvasInteraction({
    canvasRef,
    activeRedactions: redactionsState.activeRedactions,
    selectedId: redactionsState.selectedId,
    currentTimeMs: playback.currentTimeMs,
    videoDurationMs: playback.durationMs,
    defaultSpanMs: 3000,
    defaultType: 'blur',
    onAddRedaction: redactionsState.addRedaction,
    onUpdateRedaction: redactionsState.updateRedaction,
    onSelectRedaction: redactionsState.selectRedaction
  });

  // Handler to generate and load procedural synthetic CCTV demo
  const handleLoadSample = useCallback(async () => {
    try {
      const sample = await createSampleVideo({
        durationMs: 10000,
        fps: 30,
        width: 1280,
        height: 720
      });
      playback.loadSource(sample.blob, sample.metadata.name);

      // Pre-populate with sample bounding boxes matching moving targets
      redactionsState.clearAll();
      redactionsState.addRedaction({
        label: 'Suspect Face',
        type: 'blur',
        startMs: 0,
        endMs: 8000,
        bbox: [0.15, 0.28, 0.12, 0.2]
      });
      redactionsState.addRedaction({
        label: 'Vehicle Plate',
        type: 'pixelate',
        startMs: 1500,
        endMs: 9500,
        bbox: [0.35, 0.68, 0.16, 0.12]
      });
    } catch {
      // Error loading synthetic sample
    }
  }, [playback, redactionsState]);

  // Handler for uploading local media file
  const handleFileUpload = useCallback((file: File) => {
    playback.loadSource(file, file.name);
    redactionsState.clearAll();
  }, [playback, redactionsState]);

  // Handler for importing an evidence review JSON manifest
  const handleImportJson = useCallback((rawJson: string): boolean => {
    try {
      const payload = validateAndSanitizeImport(rawJson);
      const success = redactionsState.importPayload(payload);
      if (success) {
        setNotification({
          message: `Successfully imported ${payload.redactions.length} redactions from manifest.`,
          type: 'success'
        });
        setTimeout(() => setNotification(null), 4000);
      }
      return success;
    } catch (err) {
      setNotification({
        message: `Import failed: ${(err as Error).message}`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
      return false;
    }
  }, [redactionsState]);


  // Global Forensic Keyboard Shortcut Coordinator
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input guard: bypass shortcuts when user is actively editing a form input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.key) {
        case ' ': // Space: Toggle Play/Pause
          e.preventDefault();
          playback.togglePlay();
          break;

        case 'j':
        case 'J': // J: Shuttle Reverse
          e.preventDefault();
          playback.shuttleReverse();
          break;

        case 'k':
        case 'K': // K: Shuttle Pause
          e.preventDefault();
          playback.shuttlePause();
          break;

        case 'l':
        case 'L': // L: Shuttle Forward
          e.preventDefault();
          playback.shuttleForward();
          break;

        case 'ArrowLeft': // Left Arrow: Step 1 frame backward (or 1s with Shift)
          e.preventDefault();
          playback.stepFrame('backward', e.shiftKey ? Math.round(playback.fps) : 1);
          break;

        case 'ArrowRight': // Right Arrow: Step 1 frame forward (or 1s with Shift)
          e.preventDefault();
          playback.stepFrame('forward', e.shiftKey ? Math.round(playback.fps) : 1);
          break;

        case '[': // [: Set In-Point for selected box
          if (redactionsState.selectedId) {
            e.preventDefault();
            redactionsState.setInPoint(redactionsState.selectedId, playback.currentTimeMs);
          }
          break;

        case ']': // ]: Set Out-Point for selected box
          if (redactionsState.selectedId) {
            e.preventDefault();
            redactionsState.setOutPoint(redactionsState.selectedId, playback.currentTimeMs);
          }
          break;

        case 'Delete':
        case 'Backspace': // Delete / Backspace: Remove selected box
          if (redactionsState.selectedId) {
            e.preventDefault();
            redactionsState.removeRedaction(redactionsState.selectedId);
          }
          break;

        case 'Escape': // Escape: Deselect box or close modal
          e.preventDefault();
          if (isExportOpen) {
            setIsExportOpen(false);
          } else if (isShortcutsOpen) {
            setIsShortcutsOpen(false);
          } else {
            redactionsState.selectRedaction(null);
          }
          break;

        case 'Tab': // Tab: Cycle through visible redactions
          if (redactionsState.activeRedactions.length > 0) {
            e.preventDefault();
            redactionsState.cycleSelection(e.shiftKey ? 'backward' : 'forward');
          }
          break;

        case '?': // ?: Toggle shortcuts cheat sheet
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playback, redactionsState, isExportOpen, isShortcutsOpen]);

  // Construct Export Payload
  const exportPayload = createExportPayload(
    playback.metadata || {
      name: 'evidence_video.mp4',
      durationMs: playback.durationMs,
      dimensions: {
        width: playback.videoWidth || 1920,
        height: playback.videoHeight || 1080
      },
      fps: playback.fps
    },
    redactionsState.redactions
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-800 selection:text-white">
      {/* Top Header & Forensic Action Bar */}
      <Header
        onLoadSample={handleLoadSample}
        onFileUpload={handleFileUpload}
        onImportJson={handleImportJson}
        onExportClick={() => setIsExportOpen(true)}
        onClearAll={redactionsState.clearAll}
        onToggleShortcuts={() => setIsShortcutsOpen(true)}
        hasMedia={playback.isReady}
        redactionCount={redactionsState.redactions.length}
      />

      {/* Accessible notification toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800'
              : 'bg-red-950/80 text-red-200 border-red-800'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-zinc-400 hover:text-white ml-2 text-sm font-bold"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Workspace: Media Viewport & Inspector Sidebar */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* Left Column: Video Player, Canvas Overlay, Controls & Timeline */}
        <section
          aria-label="Video Player and Scrubbing Controls"
          className="flex-1 flex flex-col gap-3 min-w-0"
        >
          {/* Aspect-Ratio Video & Canvas Overlay Viewport */}
          <div className="flex-1 flex items-center justify-center min-h-[360px] bg-black/50 rounded-lg p-2 border border-zinc-900">
            <VideoPlayer
              videoRef={playback.videoRef}
              canvasRef={canvasRef}
              videoWidth={playback.videoWidth}
              videoHeight={playback.videoHeight}
              isReady={playback.isReady}
              onLoadSample={handleLoadSample}
              onFileUpload={handleFileUpload}
              activeRedactions={redactionsState.activeRedactions}
              selectedId={redactionsState.selectedId}
              currentDragRect={interaction.currentDragRect}
              activeHandle={interaction.activeHandle}
              cursorStyle={interaction.cursorStyle}
              isPlaying={playback.isPlaying}
              currentTimeMs={playback.currentTimeMs}
              onPointerDown={interaction.handlePointerDown}
              onPointerMove={interaction.handleCanvasPointerMove}
            />
          </div>

          {/* Timeline Multi-Track Scrubber */}
          <Timeline
            currentTimeMs={playback.currentTimeMs}
            durationMs={playback.durationMs}
            fps={playback.fps}
            redactions={redactionsState.redactions}
            selectedId={redactionsState.selectedId}
            onSeek={playback.seekToMs}
            onSelectRedaction={redactionsState.selectRedaction}
            onSetInPoint={redactionsState.setInPoint}
            onSetOutPoint={redactionsState.setOutPoint}
          />

          {/* Playback Controls & Forensic Timecode HUD */}
          <PlaybackControls
            isPlaying={playback.isPlaying}
            currentTimeMs={playback.currentTimeMs}
            durationMs={playback.durationMs}
            playbackRate={playback.playbackRate}
            shuttleRate={playback.shuttleRate}
            fps={playback.fps}
            volume={playback.volume}
            isMuted={playback.isMuted}
            isReady={playback.isReady}
            onTogglePlay={playback.togglePlay}
            onStepFrame={playback.stepFrame}
            onSetRate={playback.setRate}
            onShuttleForward={playback.shuttleForward}
            onShuttleReverse={playback.shuttleReverse}
            onShuttlePause={playback.shuttlePause}
            onSetVolume={playback.setVolume}
            onToggleMute={playback.toggleMute}
          />
        </section>

        {/* Right Column: Annotation Inspector & Segment List */}
        <AnnotationSidebar
          redactions={redactionsState.redactions}
          activeRedactions={redactionsState.activeRedactions}
          selectedRedaction={redactionsState.selectedRedaction}
          currentTimeMs={playback.currentTimeMs}
          fps={playback.fps}
          onSelectRedaction={redactionsState.selectRedaction}
          onUpdateRedaction={redactionsState.updateRedaction}
          onRemoveRedaction={redactionsState.removeRedaction}
          onSeek={playback.seekToMs}
          onSetInPoint={redactionsState.setInPoint}
          onSetOutPoint={redactionsState.setOutPoint}
        />
      </main>

      {/* Evidence Export JSON Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        payload={exportPayload}
      />

      {/* Forensic Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
