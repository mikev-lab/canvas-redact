/**
 * AI Face Detection & Subject Gallery Review Modal.
 * Displays face thumbnails, selective person checkboxes, segment controls,
 * per-individual treatment selectors, and legal AI-assisted attribution.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Shield,
  Grid,
  EyeOff,
  Cpu,
  CheckSquare,
  Square,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { RedactionType } from '../types';
import { TrackedSubject, KeyframeDensity } from '../ai/types';
import { msToTimecode } from '../utils/timecode';

export interface AutoRedactModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'idle' | 'scanning' | 'reviewing' | 'applying';
  progressPercent: number;
  currentScanMs: number;
  durationMs: number;
  fps: number;
  detectedSubjects: TrackedSubject[];
  selectedCount: number;
  markAiAssisted: boolean;
  hardwareAcceleration: 'webgpu' | 'cpu' | 'simulated';
  keyframeDensity?: KeyframeDensity;
  reviewerId?: string;
  onSetKeyframeDensity?: (density: KeyframeDensity) => void;
  onStartScan: (stepFrames?: number) => void;
  onCancelScan: () => void;
  onToggleSelection: (id: string) => void;
  onUpdateTreatment: (id: string, type: RedactionType) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSetMarkAiAssisted: (enabled: boolean) => void;
  onApply: (reviewerId?: string) => void;
}

export const AutoRedactModal: React.FC<AutoRedactModalProps> = ({
  isOpen,
  onClose,
  status,
  progressPercent,
  currentScanMs,
  durationMs,
  fps,
  detectedSubjects,
  selectedCount,
  markAiAssisted,
  hardwareAcceleration,
  keyframeDensity = 'balanced',
  reviewerId = '',
  onSetKeyframeDensity,
  onStartScan,
  onCancelScan,
  onToggleSelection,
  onUpdateTreatment,
  onUpdateLabel,
  onSelectAll,
  onDeselectAll,
  onSetMarkAiAssisted,
  onApply,
}) => {
  const [scanStep, setScanStep] = useState(5); // Default: sample every 5 frames (~166ms)

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-redact-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-purple-600/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4 text-purple-400" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="auto-redact-modal-title"
                className="text-sm font-bold text-white font-mono tracking-wide flex items-center gap-2"
              >
                AI FACE DETECTION & SUBJECT GALLERY
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800">
                  Experimental
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                100% Client-Side Air-Gapped. Detect, isolate, and selectively censor individuals.
              </p>
            </div>
          </div>

          {/* Hardware Acceleration Status Badge */}
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono"
              title="Workstation compute acceleration status"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="text-zinc-300">
                {hardwareAcceleration === 'webgpu'
                  ? 'Apple Neural Engine / WebGPU Active'
                  : 'CPU Engine'}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STATE 1: Idle (Ready to Scan) */}
          {status === 'idle' && detectedSubjects.length === 0 && (
            <div className="flex flex-col items-center text-center max-w-lg mx-auto py-8 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Scan Video for Unique Individuals</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  The client-side vision tracker scans video frames locally on your workstation to identify
                  faces across time. You will be able to review each person's face thumbnail before choosing who to censor.
                </p>
              </div>

              {/* Sampling rate and Keyframe density selectors */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-medium pl-1">Sampling:</span>
                  <button
                    type="button"
                    onClick={() => setScanStep(3)}
                    className={`px-2 py-1 rounded transition-colors ${
                      scanStep === 3
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Fine (3f)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanStep(5)}
                    className={`px-2 py-1 rounded transition-colors ${
                      scanStep === 5
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Standard (5f)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanStep(10)}
                    className={`px-2 py-1 rounded transition-colors ${
                      scanStep === 10
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Fast (10f)
                  </button>
                </div>

                <div className="hidden sm:block w-px h-4 bg-zinc-800" />

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 font-medium">Keyframes:</span>
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('sparse')}
                    className={`px-2 py-1 rounded transition-colors ${
                      keyframeDensity === 'sparse'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Sparse: ~1 keyframe per second (min 800ms gap)"
                  >
                    Sparse (~1/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('balanced')}
                    className={`px-2 py-1 rounded transition-colors ${
                      keyframeDensity === 'balanced'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Balanced: ~2 keyframes per second (min 400ms gap)"
                  >
                    Balanced (~2/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('dense')}
                    className={`px-2 py-1 rounded transition-colors ${
                      keyframeDensity === 'dense'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Dense: ~4 keyframes per second (min 200ms gap)"
                  >
                    Dense (~4/s)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStartScan(scanStep)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md hover:shadow-purple-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Video Face Scan</span>
              </button>
            </div>
          )}

          {/* STATE 2: Scanning Progress */}
          {status === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-10 max-w-md mx-auto space-y-5 text-center">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
                <div className="w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/60 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Scanning Video Frames</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Extracting face candidates and computing kinematic trajectories...
                </p>
              </div>

              {/* High-contrast progress bar */}
              <div className="w-full space-y-2">
                <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                  <span>
                    {msToTimecode(currentScanMs, fps).formatted} / {msToTimecode(durationMs, fps).formatted}
                  </span>
                  <span>{progressPercent}% Complete</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancelScan}
                className="px-4 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Cancel Scan
              </button>
            </div>
          )}

          {/* STATE 3: Reviewing Subject Gallery */}
          {(status === 'reviewing' || (status === 'idle' && detectedSubjects.length > 0)) && (
            <div className="space-y-4">
              {/* Toolbar & Filter Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white font-mono">
                    {detectedSubjects.length} INDIVIDUALS DETECTED
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-xs text-purple-400 font-medium">
                    {selectedCount} Selected for Redaction
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDeselectAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartScan(scanStep)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                    title="Re-scan video frames"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-Scan</span>
                  </button>
                </div>
              </div>

              {/* Trajectory Keyframe Density Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
                  <span className="text-zinc-300 font-medium">Trajectory Keyframe Density:</span>
                  <span className="text-zinc-400 text-[11px]">(Rate limited to avoid timeline clutter)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-md border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('sparse')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                      keyframeDensity === 'sparse'
                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Sparse: ~1 keyframe per second (minimum 800ms between keyframes)"
                  >
                    Sparse (~1/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('balanced')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                      keyframeDensity === 'balanced'
                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Balanced: ~2 keyframes per second (minimum 400ms between keyframes)"
                  >
                    Balanced (~2/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetKeyframeDensity?.('dense')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                      keyframeDensity === 'dense'
                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Dense: ~4 keyframes per second (minimum 200ms between keyframes)"
                  >
                    Dense (~4/s)
                  </button>
                </div>
              </div>

              {/* Zero results message */}
              {detectedSubjects.length === 0 && (
                <div className="p-8 text-center bg-zinc-900/40 rounded-lg border border-dashed border-zinc-800 space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">
                    No individuals detected with current confidence threshold.
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Try re-scanning with a finer sampling rate or manually draw bounding boxes on the canvas.
                  </p>
                </div>
              )}

              {/* Subject Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detectedSubjects.map((subject) => {
                  const durationSec = Math.max(0.1, (subject.endMs - subject.startMs) / 1000).toFixed(1);

                  return (
                    <div
                      key={subject.id}
                      className={`relative flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        subject.selected
                          ? 'bg-purple-950/20 border-purple-500/80 shadow-sm shadow-purple-950'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Face Avatar Thumbnail */}
                      <div className="relative shrink-0">
                        {subject.thumbnailUrl ? (
                          <img
                            src={subject.thumbnailUrl}
                            alt={subject.label}
                            className="w-20 h-20 rounded-md object-cover bg-zinc-900 border border-zinc-700"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-600">
                            <Sparkles className="w-6 h-6" />
                          </div>
                        )}
                        {/* Confidence chip */}
                        <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 py-0.2 rounded bg-black/80 text-zinc-300 border border-zinc-800">
                          {Math.round(subject.confidence * 100)}%
                        </span>
                      </div>

                      {/* Details & Controls */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          {/* Inline editable label */}
                          <input
                            type="text"
                            value={subject.label}
                            onChange={(e) => onUpdateLabel(subject.id, e.target.value)}
                            aria-label={`Label for ${subject.id}`}
                            className="text-xs font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-purple-500 focus:outline-none w-36 truncate font-mono"
                          />

                          {/* Censor toggle checkbox */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-zinc-200 hover:text-white">
                            <input
                              type="checkbox"
                              checked={subject.selected}
                              onChange={() => onToggleSelection(subject.id)}
                              className="w-4 h-4 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-zinc-950 bg-zinc-900"
                            />
                            <span className={subject.selected ? 'text-purple-300 font-semibold' : 'text-zinc-300'}>
                              {subject.selected ? 'Censor' : 'Ignore'}
                            </span>
                          </label>
                        </div>

                        {/* Appearance Timecode & Trajectory info */}
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300">
                          <Clock className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
                          <span>
                            {msToTimecode(subject.startMs, fps).formatted} to {msToTimecode(subject.endMs, fps).formatted}
                          </span>
                          <span className="text-zinc-500">|</span>
                          <span>{durationSec}s ({subject.trajectory.length} pts)</span>
                        </div>

                        {/* Redaction Treatment Selector */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] uppercase text-zinc-300 font-mono">Mode:</span>
                          <div className="inline-flex rounded border border-zinc-800 bg-zinc-950 p-0.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => onUpdateTreatment(subject.id, 'blur')}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                                subject.type === 'blur'
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                              title="Gaussian Defocus"
                            >
                              <Shield className="w-2.5 h-2.5" />
                              <span>Blur</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateTreatment(subject.id, 'pixelate')}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                                subject.type === 'pixelate'
                                  ? 'bg-amber-600 text-white font-semibold'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                              title="Mosaic Pixelation"
                            >
                              <Grid className="w-2.5 h-2.5" />
                              <span>Pixel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateTreatment(subject.id, 'blackout')}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                                subject.type === 'blackout'
                                  ? 'bg-zinc-700 text-white font-semibold'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                              title="Opaque Blackout"
                            >
                              <EyeOff className="w-2.5 h-2.5" />
                              <span>Blackout</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legal & Forensic Compliance Box */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={markAiAssisted}
                      onChange={(e) => onSetMarkAiAssisted(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-zinc-950 bg-zinc-900"
                    />
                    <span className="font-semibold text-white">
                      Mark as AI-Assisted (Recommended for Legal Discovery)
                    </span>
                  </label>
                  {reviewerId && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Reviewer: {reviewerId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 pl-6 leading-relaxed">
                  Attaches <code className="text-purple-300 font-mono">aiAssisted: true</code> to each generated redaction box and evidence export manifest. Distinguishes automated vision tracking from manual human annotations under evidentiary chain of custody standards.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Cancel / Discard
          </button>

          <div className="flex items-center gap-3">
            {detectedSubjects.length > 0 && (
              <span className="text-xs text-zinc-400 font-mono">
                {selectedCount} of {detectedSubjects.length} individuals selected
              </span>
            )}

            <button
              type="button"
              onClick={() => onApply(reviewerId)}
              disabled={selectedCount === 0 || status === 'scanning'}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                selectedCount > 0 && status !== 'scanning'
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Redactions ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
