/**
 * Accessible modal displaying forensic keyboard shortcuts guide.
 */

import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

export interface ShortcutsModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
}

interface ShortcutEntry {
  key: string;
  action: string;
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'Space', action: 'Play / Pause', description: 'Toggle video playback (or Keyframe & Step in Tracking Mode)' },
  { key: 'K / Enter', action: 'Record Keyframe', description: 'Record keyframe at current position without advancing' },
  { key: 'T', action: 'Toggle Tracking', description: 'Toggle Censor Tracking Mode (Space = Keyframe & Step)' },
  { key: 'J / K / L', action: 'Forensic Shuttle', description: 'Reverse (-1x, -2x, -4x) / Pause / Forward (1x, 2x, 4x)' },
  { key: 'Left / Right Arrow', action: '1 Frame Step', description: 'Step backward or forward exactly 1 frame' },
  { key: 'Shift + Left / Right', action: 'Frame Jump', description: 'Jump customizable frame distance backward or forward' },
  { key: 'Alt + Left / Right', action: 'Jump Keyframe', description: 'Jump playhead to previous or next keyframe of selected box' },
  { key: '[', action: 'Set In-Point', description: 'Mark start timestamp for selected redaction' },
  { key: ']', action: 'Set Out-Point', description: 'Mark end timestamp for selected redaction' },
  { key: 'Tab / Shift + Tab', action: 'Cycle Selection', description: 'Navigate between visible bounding boxes' },
  { key: 'Delete / Backspace', action: 'Delete Redaction', description: 'Remove currently selected bounding box' },
  { key: 'Escape', action: 'Deselect / Close', description: 'Deselect box, cancel active drag, or close modal' },
  { key: '?', action: 'Shortcut Guide', description: 'Toggle this forensic hotkey cheat sheet' }
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-400" aria-hidden="true" />
            <h2 id="shortcuts-modal-title" className="text-sm font-bold text-white font-mono">
              Forensic Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close shortcuts guide (Escape)"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 divide-y divide-zinc-800/60">
          {SHORTCUTS.map((item, idx) => (
            <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-4 text-xs">
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">{item.action}</div>
                <div className="text-[11px] text-zinc-400">{item.description}</div>
              </div>
              <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-blue-300 font-mono text-[11px] font-bold shadow-sm whitespace-nowrap">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 text-center text-xs text-zinc-400">
          Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono">Esc</kbd> to return to redaction workstation
        </div>
      </div>
    </div>
  );
};
