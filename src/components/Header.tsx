/**
 * Application header displaying branding, air-gapped security status,
 * media file uploaders, synthetic demo generator trigger, and export actions.
 */

import React, { useRef } from 'react';
import { Shield, Upload, Download, Trash2, Video, HelpCircle } from 'lucide-react';

export interface HeaderProps {
  /** Callback to trigger procedural synthetic CCTV demo generation */
  onLoadSample: () => void;
  /** Callback when user selects a local video file */
  onFileUpload: (file: File) => void;
  /** Callback to open evidence review JSON export modal */
  onExportClick: () => void;
  /** Callback to clear all active annotations */
  onClearAll: () => void;
  /** Callback to toggle forensic keyboard shortcuts modal */
  onToggleShortcuts: () => void;
  /** Whether a video file is currently loaded and ready */
  hasMedia: boolean;
  /** Total count of redaction boxes */
  redactionCount: number;
}

/**
 * Top navigation and forensic utility toolbar.
 */
export const Header: React.FC<HeaderProps> = ({
  onLoadSample,
  onFileUpload,
  onExportClick,
  onClearAll,
  onToggleShortcuts,
  hasMedia,
  redactionCount
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset input value so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  return (
    <header
      className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none"
      role="banner"
    >
      {/* Brand logo & forensic security badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <Shield className="w-5 h-5 text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wider font-mono flex items-center gap-2">
              CANVAS-REDACT
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-sans border border-zinc-700">
                v0.1.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Frame-Accurate Evidence Scrubbing & Privacy Redaction
            </p>
          </div>
        </div>

        {/* Air-Gapped Security Guarantee Pill */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium"
          title="Zero network transmissions: Media files never leave this device."
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          <span>100% Client-Side Air-Gapped</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          onChange={handleFileChange}
          className="sr-only"
          id="evidence-file-input"
          tabIndex={-1}
          aria-label="Upload evidence video file"
        />

        {/* Load CCTV Synthetic Demo button */}
        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Load procedural synthetic CCTV demo evidence clip"
        >
          <Video className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span>Load CCTV Demo</span>
        </button>

        {/* Open Local Video File button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Open local evidence media file from disk"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span>Open File</span>
        </button>

        {/* Clear All Annotations */}
        {hasMedia && redactionCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-800 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Clear all current redaction annotations"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}

        {/* Export Evidence JSON button */}
        <button
          type="button"
          onClick={onExportClick}
          disabled={!hasMedia || redactionCount === 0}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
            hasMedia && redactionCount > 0
              ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-sm'
              : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
          }`}
          aria-label={`Export evidence JSON with ${redactionCount} annotations`}
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export JSON</span>
          {redactionCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-200 text-[10px] font-bold border border-blue-400/40">
              {redactionCount}
            </span>
          )}
        </button>

        {/* Keyboard Shortcuts Help */}
        <button
          type="button"
          onClick={onToggleShortcuts}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="View forensic keyboard shortcuts guide"
          title="Forensic Hotkeys (?)"
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
