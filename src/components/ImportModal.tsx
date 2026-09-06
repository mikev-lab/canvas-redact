/**
 * Accessible modal dialog for importing evidence review JSON manifests (v1.0.0).
 * Supports both drag-and-drop file ingestion and direct clipboard JSON pasting,
 * with real-time schema validation, live manifest preview, and replace/merge options.
 */

import React, { useState, useEffect, useRef, useId } from 'react';
import { validateAndSanitizeImport } from '../utils/export';
import { ExportPayload } from '../types';
import {
  X,
  Upload,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  FolderInput,
  UserCheck,
  Film,
  Sparkles,
  Layers
} from 'lucide-react';

export interface ImportModalProps {
  /** Whether modal is currently visible */
  isOpen: boolean;
  /** Modal close callback */
  onClose: () => void;
  /** Callback when valid manifest is confirmed for import */
  onImport: (rawJson: string, mode: 'replace' | 'merge') => boolean;
  /** Current count of redaction annotations in state */
  existingCount?: number;
}

type ImportTab = 'file' | 'paste';

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ImportTab>('file');
  const [rawText, setRawText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [parsedPayload, setParsedPayload] = useState<ExportPayload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const titleId = useId();
  const descId = useId();

  // Reset internal state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setSelectedFileName(null);
      setParsedPayload(null);
      setValidationError(null);
      setImportMode(existingCount > 0 ? 'merge' : 'replace');
    }
  }, [isOpen, existingCount]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Validate JSON string whenever raw text changes
  const handleValidateJson = (jsonString: string, fileName?: string) => {
    setRawText(jsonString);
    if (fileName) {
      setSelectedFileName(fileName);
    }

    if (!jsonString.trim()) {
      setParsedPayload(null);
      setValidationError(null);
      return;
    }

    try {
      const validated = validateAndSanitizeImport(jsonString);
      setParsedPayload(validated);
      setValidationError(null);
    } catch (err) {
      setParsedPayload(null);
      setValidationError((err as Error).message);
    }
  };

  const handleFileSelection = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        handleValidateJson(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPayload || !rawText) return;
    const success = onImport(rawText, importMode);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Compute breakdown of redactions
  const blurCount = parsedPayload?.redactions.filter((r) => r.type === 'blur').length || 0;
  const pixelateCount = parsedPayload?.redactions.filter((r) => r.type === 'pixelate').length || 0;
  const blackoutCount = parsedPayload?.redactions.filter((r) => r.type === 'blackout').length || 0;
  const keyframeCount = parsedPayload?.redactions.reduce(
    (acc, r) => acc + (r.keyframes?.length || 0),
    0
  ) || 0;
  const hasAiAssisted = parsedPayload?.redactions.some((r) => r.aiAssisted) || false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FolderInput className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-bold text-white font-mono">
                Import Evidence Review Manifest (JSON v1.0.0)
              </h2>
              <p id={descId} className="text-xs text-zinc-400">
                Load court evidence annotations, moving keyframes, and chain of custody records.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close import dialog (Escape)"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'file'}
            role="tab"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'paste'}
            role="tab"
          >
            <FileCode className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Paste JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* File Upload Tab */}
          {activeTab === 'file' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelection(file);
                }}
                className="sr-only"
                id="modal-file-upload-input"
                tabIndex={-1}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                  isDraggingFile
                    ? 'border-blue-500 bg-blue-950/30 text-blue-200'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-300'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label={selectedFileName ? `${selectedFileName}: Upload evidence JSON manifest file` : 'Drag and drop .json manifest file here: Upload evidence JSON manifest file'}
              >
                <FolderInput className="w-8 h-8 text-blue-400 mb-2" aria-hidden="true" />
                <p className="text-xs font-medium text-white mb-1">
                  {selectedFileName ? selectedFileName : 'Drag and drop .json manifest file here'}
                </p>
                <p className="text-[11px] text-zinc-300">or click to browse local files</p>
              </div>
            </div>
          )}

          {/* Paste JSON Tab */}
          {activeTab === 'paste' && (
            <div>
              <label htmlFor="raw-json-textarea" className="block text-xs text-zinc-300 font-medium mb-1.5">
                Paste JSON Manifest Payload:
              </label>
              <textarea
                id="raw-json-textarea"
                value={rawText}
                onChange={(e) => handleValidateJson(e.target.value)}
                placeholder={'{\n  "version": "1.0.0",\n  "metadata": { ... },\n  "redactions": [ ... ]\n}'}
                rows={8}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/80 flex items-start gap-2.5 text-red-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-red-300">Invalid Evidence Manifest</p>
                <p className="text-red-400/90 text-[11px] mt-0.5">{validationError}</p>
              </div>
            </div>
          )}

          {/* Validation Success & Live Preview Card */}
          {parsedPayload && (
            <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span className="text-xs font-bold text-emerald-300 font-mono">
                    Valid v1.0.0 Evidence Review Manifest
                  </span>
                </div>
                {parsedPayload.metadata.reviewerId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-mono border border-blue-800">
                    <UserCheck className="w-3 h-3 text-blue-400" aria-hidden="true" />
                    Reviewer: {parsedPayload.metadata.reviewerId}
                  </span>
                )}
              </div>

              {/* Source Video & Resolution Meta */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800/60 font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{parsedPayload.metadata.videoName}</span>
                </div>
                <div className="text-right text-zinc-400">
                  {parsedPayload.metadata.dimensions.width}x{parsedPayload.metadata.dimensions.height} ({parsedPayload.metadata.fps} FPS)
                </div>
              </div>

              {/* Redaction breakdown pills */}
              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-semibold">
                  {parsedPayload.redactions.length} Redactions
                </span>
                {blurCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                    {blurCount} Blur
                  </span>
                )}
                {pixelateCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                    {pixelateCount} Pixelate
                  </span>
                )}
                {blackoutCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700">
                    {blackoutCount} Blackout
                  </span>
                )}
                {keyframeCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                    {keyframeCount} Keyframes
                  </span>
                )}
                {hasAiAssisted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                    <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                    AI-Assisted
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Import Mode Selector (if existing redactions exist) */}
          {existingCount > 0 && parsedPayload && (
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
              <label className="block text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                Import Conflict Resolution:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-2 rounded border text-left transition-colors ${
                    importMode === 'merge'
                      ? 'bg-blue-950/40 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <p className="font-semibold text-xs">Merge with Existing</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Keep {existingCount} existing and append {parsedPayload.redactions.length} new
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-2 rounded border text-left transition-colors ${
                    importMode === 'replace'
                      ? 'bg-blue-950/40 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <p className="font-semibold text-xs text-red-300">Replace All</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Clear {existingCount} existing and overwrite with imported manifest
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsedPayload}
            onClick={handleConfirmImport}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              parsedPayload
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
            }`}
          >
            <FolderInput className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Apply Redactions ({parsedPayload ? parsedPayload.redactions.length : 0})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
