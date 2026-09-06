/**
 * Evidence review JSON export modal dialog.
 * Displays formatted export payload compliant with v1.0.0 evidence contract,
 * with copy-to-clipboard and file download triggers.
 */

import React, { useState, useEffect } from 'react';
import { ExportPayload } from '../types';
import { downloadJsonFile } from '../utils/export';
import { X, Copy, Check, Download, FileText } from 'lucide-react';

export interface ExportModalProps {
  /** Whether modal is currently visible */
  isOpen: boolean;
  /** Modal close callback */
  onClose: () => void;
  /** Complete evidence export payload */
  payload: ExportPayload;
}

/**
 * Accessible modal dialog for evidence JSON review and download.
 */
export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  payload
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard write failed
    }
  };

  const handleDownload = () => {
    const baseName = payload.metadata.videoName.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_redaction_manifest.json`;
    downloadJsonFile(filename, payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" aria-hidden="true" />
            <div>
              <h2 id="export-modal-title" className="text-sm font-bold text-white font-mono">
                Evidence Review Manifest (JSON v1.0.0)
              </h2>
              <p className="text-xs text-zinc-400">
                {payload.redactions.length} annotations verified for court review or post-processing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close export dialog (Escape)"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* JSON Code Viewer */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-950">
          <pre className="text-xs font-mono text-emerald-400 bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 overflow-x-auto selection:bg-blue-900 selection:text-white">
            <code>{jsonString}</code>
          </pre>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/40">
          <div className="text-xs text-zinc-400 font-mono">
            Exported: {new Date(payload.metadata.exportedAt).toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Copy JSON code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Download JSON evidence file to disk"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
