/**
 * Root Application Container & Global Forensic Keyboard Coordinator.
 * Connects video playback engine, annotation state machine, and canvas interaction
 * gestures into an accessible, responsive WCAG 2.1 Level AAA workspace.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVideoPlayback } from './hooks/useVideoPlayback';
import { useRedactions } from './hooks/useRedactions';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { RedactionBox } from './types';
import { createExportPayload, validateAndSanitizeImport } from './utils/export';
import { findSurroundingKeyframes } from './utils/keyframes';
import { msToTimecode, stepFrameTime } from './utils/timecode';

import { useAutoDetection } from './hooks/useAutoDetection';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { PlaybackControls } from './components/PlaybackControls';
import { Timeline } from './components/Timeline';
import { AnnotationSidebar } from './components/AnnotationSidebar';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';

// Lazily load AI Detection modal so zero heavy AI UI/model assets appear on initial load
const AutoRedactModal = React.lazy(() =>
  import('./components/AutoRedactModal').then((m) => ({ default: m.AutoRedactModal }))
);

export default function App(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [jumpFrames, setJumpFrames] = useState(5);
  const [reviewerId, setReviewerId] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 1. Media Playback Hook
  const playback = useVideoPlayback({ defaultFps: 30 });

  // 2. Redaction Annotation State Hook
  const redactionsState = useRedactions(playback.currentTimeMs);

  // Automatic chain of custody reviewer attribution on newly drawn redactions
  const handleAddRedaction = useCallback((box: Omit<RedactionBox, 'id'>): string => {
    return redactionsState.addRedaction({
      ...box,
      reviewerId: box.reviewerId || reviewerId || undefined
    });
  }, [redactionsState, reviewerId]);

  // 3. Direct Canvas Pointer Interaction Hook
  const interaction = useCanvasInteraction({
    canvasRef,
    activeRedactions: redactionsState.activeRedactions,
    selectedId: redactionsState.selectedId,
    currentTimeMs: playback.currentTimeMs,
    videoDurationMs: playback.durationMs,
    defaultSpanMs: 3000,
    defaultType: 'blur',
    onAddRedaction: handleAddRedaction,
    onUpdateRedaction: redactionsState.updateRedaction,
    onSelectRedaction: redactionsState.selectRedaction
  });

  // 4. AI Automated Detection & Tracking Hook
  const handleApplyAutoRedactions = useCallback(
    (boxes: Array<Omit<RedactionBox, 'id'> & { id?: string }>) => {
      let count = 0;
      for (const box of boxes) {
        redactionsState.addRedaction({
          ...box,
          reviewerId: box.reviewerId || reviewerId || undefined,
        });
        count++;
      }
      setNotification({
        message: `Applied ${count} AI-assisted redaction trajectory track${count === 1 ? '' : 's'}.`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 3500);
    },
    [redactionsState, reviewerId]
  );

  const autoDetect = useAutoDetection({
    videoRef: playback.videoRef,
    durationMs: playback.durationMs,
    fps: playback.fps,
    isReady: playback.isReady,
    onApplyRedactions: handleApplyAutoRedactions,
  });


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
        if (payload.metadata.reviewerId) {
          setReviewerId(payload.metadata.reviewerId);
        }
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
        case ' ': // Space: Play/Pause OR Keyframe & Step in Tracking Mode
          e.preventDefault();
          if (isTrackingMode && redactionsState.selectedRedaction) {
            const currentMs = playback.currentTimeMs;
            const currentBbox = redactionsState.selectedRedaction.bbox;
            const targetId = redactionsState.selectedRedaction.id;

            const deltaFrames = e.shiftKey ? -jumpFrames : jumpFrames;
            const nextMs = stepFrameTime(currentMs, deltaFrames, playback.durationMs, playback.fps);
            const jumpDurationMs = Math.max(33, Math.round((jumpFrames * 1000) / (playback.fps || 30)));

            // Forward-project endMs to the next jump so the redaction never stops abruptly
            const projectedEndMs = !e.shiftKey
              ? Math.min(playback.durationMs, Math.max(redactionsState.selectedRedaction.endMs, nextMs + jumpDurationMs))
              : redactionsState.selectedRedaction.endMs;

            redactionsState.setKeyframe(
              targetId,
              currentMs,
              currentBbox,
              projectedEndMs
            );

            if (nextMs < redactionsState.selectedRedaction.startMs) {
              redactionsState.setInPoint(targetId, nextMs);
            }

            playback.stepFrame(e.shiftKey ? 'backward' : 'forward', jumpFrames);
          } else {
            playback.togglePlay();
          }
          break;

        case 'm':
        case 'M':
        case 'Enter': // Enter / M: Mark keyframe at current position
          if (redactionsState.selectedRedaction) {
            e.preventDefault();
            const currentMs = playback.currentTimeMs;
            const targetId = redactionsState.selectedRedaction.id;
            const jumpDurationMs = Math.max(33, Math.round((jumpFrames * 1000) / (playback.fps || 30)));
            const projectedEndMs = isTrackingMode
              ? Math.min(playback.durationMs, Math.max(redactionsState.selectedRedaction.endMs, currentMs + jumpDurationMs))
              : undefined;

            redactionsState.setKeyframe(
              targetId,
              currentMs,
              redactionsState.selectedRedaction.bbox,
              projectedEndMs
            );
            setNotification({
              message: `Marked keyframe at ${msToTimecode(playback.currentTimeMs, playback.fps).formatted}`,
              type: 'success'
            });
            setTimeout(() => setNotification(null), 1500);
          }
          break;

        case 't':
        case 'T': // T: Toggle Censor Tracking Mode
          e.preventDefault();
          setIsTrackingMode((prev) => {
            const next = !prev;
            setNotification({
              message: next ? 'Censor Tracking Mode Enabled (Space = Keyframe & Step)' : 'Censor Tracking Mode Disabled',
              type: 'info'
            });
            setTimeout(() => setNotification(null), 2500);
            return next;
          });
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

        case 'ArrowLeft': // Left Arrow: Step 1 frame backward (or jumpFrames with Shift, or Prev Keyframe with Alt)
          e.preventDefault();
          if (e.altKey && redactionsState.selectedRedaction?.keyframes) {
            const surrounding = findSurroundingKeyframes(
              redactionsState.selectedRedaction.keyframes,
              playback.currentTimeMs
            );
            if (surrounding.prev) {
              playback.seekToMs(surrounding.prev.timeMs);
            }
          } else {
            playback.stepFrame('backward', e.shiftKey ? jumpFrames : 1);
          }
          break;

        case 'ArrowRight': // Right Arrow: Step 1 frame forward (or jumpFrames with Shift, or Next Keyframe with Alt)
          e.preventDefault();
          if (e.altKey && redactionsState.selectedRedaction?.keyframes) {
            const surrounding = findSurroundingKeyframes(
              redactionsState.selectedRedaction.keyframes,
              playback.currentTimeMs
            );
            if (surrounding.next) {
              playback.seekToMs(surrounding.next.timeMs);
            }
          } else {
            playback.stepFrame('forward', e.shiftKey ? jumpFrames : 1);
          }
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
          } else if (autoDetect.isOpen) {
            autoDetect.closeModal();
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
  }, [playback, redactionsState, isExportOpen, isShortcutsOpen, autoDetect.isOpen, autoDetect.closeModal, isTrackingMode, jumpFrames]);

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
    redactionsState.redactions,
    reviewerId || undefined
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-800 selection:text-white">
      {/* Top Header & Forensic Action Bar */}
      <Header
        onFileUpload={handleFileUpload}
        onImportJson={handleImportJson}
        onExportClick={() => setIsExportOpen(true)}
        onClearAll={redactionsState.clearAll}
        onToggleShortcuts={() => setIsShortcutsOpen(true)}
        onAutoRedactClick={autoDetect.openModal}
        hasMedia={playback.isReady}
        redactionCount={redactionsState.redactions.length}
        reviewerId={reviewerId}
        onReviewerIdChange={setReviewerId}
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
              onFileUpload={handleFileUpload}
              activeRedactions={redactionsState.activeRedactions}
              selectedId={redactionsState.selectedId}
              currentDragRect={interaction.currentDragRect}
              activeHandle={interaction.activeHandle}
              cursorStyle={interaction.cursorStyle}
              isPlaying={playback.isPlaying || playback.shuttleRate !== 0}
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
            jumpFrames={jumpFrames}
            onSetJumpFrames={setJumpFrames}
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
          isTrackingMode={isTrackingMode}
          onToggleTrackingMode={() => setIsTrackingMode((prev) => !prev)}
          onSetKeyframe={redactionsState.setKeyframe}
          onRemoveKeyframe={redactionsState.removeKeyframe}
          onClearKeyframes={redactionsState.clearKeyframes}
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

      {/* AI Face Detection & Subject Gallery Modal (Lazy Loaded) */}
      <React.Suspense fallback={null}>
        {autoDetect.isOpen && (
          <AutoRedactModal
            isOpen={autoDetect.isOpen}
            onClose={autoDetect.closeModal}
            status={autoDetect.status}
            progressPercent={autoDetect.progressPercent}
            currentScanMs={autoDetect.currentScanMs}
            durationMs={playback.durationMs}
            fps={playback.fps}
            detectedSubjects={autoDetect.detectedSubjects}
            selectedCount={autoDetect.selectedCount}
            markAiAssisted={autoDetect.markAiAssisted}
            hardwareAcceleration={autoDetect.hardwareAcceleration}
            reviewerId={reviewerId}
            keyframeDensity={autoDetect.keyframeDensity}
            onSetKeyframeDensity={autoDetect.setKeyframeDensity}
            onStartScan={autoDetect.startScan}
            onCancelScan={autoDetect.cancelScan}
            onToggleSelection={autoDetect.toggleSubjectSelection}
            onUpdateTreatment={autoDetect.updateSubjectTreatment}
            onUpdateLabel={autoDetect.updateSubjectLabel}
            onSelectAll={autoDetect.selectAllSubjects}
            onDeselectAll={autoDetect.deselectAllSubjects}
            onSetMarkAiAssisted={autoDetect.setMarkAiAssisted}
            onApply={autoDetect.applySelectedRedactions}
          />
        )}
      </React.Suspense>
    </div>
  );
}
