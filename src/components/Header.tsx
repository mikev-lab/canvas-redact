/**
 * Application header displaying branding, air-gapped security status,
 * media file uploaders, synthetic demo generator trigger, and export actions.
 */

import React, { useRef } from 'react';
import { Shield, Upload, Download, Trash2, HelpCircle, FolderInput, UserCheck, Sparkles } from 'lucide-react';

export interface HeaderProps {
  /** Callback when user selects a local video file */
  onFileUpload: (file: File) => void;
  /** Callback when user imports an evidence review JSON manifest */
  onImportJson: (rawJson: string) => boolean;
  /** Callback to open evidence review JSON import modal */
  onImportClick?: () => void;
  /** Callback to open evidence review JSON export modal */
  onExportClick: () => void;
  /** Callback to clear all active annotations */
  onClearAll: () => void;
  /** Callback to toggle forensic keyboard shortcuts modal */
  onToggleShortcuts: () => void;
  /** Callback to open AI auto detection modal */
  onAutoRedactClick?: () => void;
  /** Whether a video file is currently loaded and ready */
  hasMedia: boolean;
  /** Total count of redaction boxes */
  redactionCount: number;
  /** Active reviewer or employee ID for chain of custody tracking */
  reviewerId?: string;
  /** Callback when reviewer or employee ID updates */
  onReviewerIdChange?: (id: string) => void;
}

/**
 * Top navigation and forensic utility toolbar.
 */
export const Header: React.FC<HeaderProps> = ({
  onFileUpload,
  onImportJson,
  onImportClick,
  onExportClick,
  onClearAll,
  onToggleShortcuts,
  onAutoRedactClick,
  hasMedia,
  redactionCount,
  reviewerId = '',
  onReviewerIdChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset input value so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleManifestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          onImportJson(text);
        }
      };
      reader.readAsText(file);
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
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* Hidden native video file input */}
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

        {/* Hidden evidence JSON manifest input */}
        <input
          ref={manifestInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleManifestChange}
          className="sr-only"
          id="manifest-file-input"
          tabIndex={-1}
          aria-label="Upload evidence review JSON manifest file"
        />

        {/* Reviewer / Employee ID Badge Input */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
          <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
          <label htmlFor="reviewer-id-input" className="sr-only">
            Reviewer or Employee ID for forensic chain of custody
          </label>
          <input
            id="reviewer-id-input"
            type="text"
            value={reviewerId}
            onChange={(e) => onReviewerIdChange?.(e.target.value)}
            placeholder="Reviewer ID (e.g. OFC-4921)"
            className="bg-transparent text-xs text-white placeholder-zinc-500 w-28 sm:w-44 focus:outline-none font-mono"
            title="Reviewer or Employee ID automatically stamped on new redactions for chain of custody"
          />
        </div>

        {/* Open Local Video File button (Primary Action) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Open local evidence media file from disk"
        >
          <Upload className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
          <span>Open Video</span>
        </button>


        {/* Import Evidence JSON Manifest button */}
        <button
          type="button"
          onClick={() => {
            if (onImportClick) {
              onImportClick();
            } else {
              manifestInputRef.current?.click();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Import evidence review JSON manifest from disk"
        >
          <FolderInput className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span>Import JSON</span>
        </button>

        {/* AI Face Detection & Subject Gallery button */}
        {hasMedia && onAutoRedactClick && (
          <button
            type="button"
            onClick={onAutoRedactClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600/90 hover:bg-purple-600 text-white border border-purple-500/50 text-xs font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Launch AI face detection and subject gallery"
            title="Auto-Detect Faces & Select Individuals to Censor (Apple Silicon / WebGPU Accelerated)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" aria-hidden="true" />
            <span>Auto-Redact</span>
          </button>
        )}

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
