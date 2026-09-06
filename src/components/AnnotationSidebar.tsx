/**
 * Sidebar inspector and redaction annotation manager.
 * Provides label editing, redaction type selection, temporal In/Out point adjustment,
 * coordinate readouts, and segment jumping.
 */

import React from 'react';
import { RedactionBox, RedactionType } from '../types';
import { msToTimecode } from '../utils/timecode';
import {
  Tag,
  Trash2,
  Clock,
  Layers,
  X,
  Sparkles,
  Grid,
  Square,
  Crosshair
} from 'lucide-react';

export interface AnnotationSidebarProps {
  /** Complete redaction collection */
  redactions: RedactionBox[];
  /** Redactions currently visible at playback timestamp */
  activeRedactions: RedactionBox[];
  /** Currently selected redaction box or null */
  selectedRedaction: RedactionBox | null;
  /** Current continuous playback timestamp in milliseconds */
  currentTimeMs: number;
  /** Video frames per second */
  fps: number;
  /** Select redaction callback */
  onSelectRedaction: (id: string | null) => void;
  /** Update redaction callback */
  onUpdateRedaction: (id: string, updates: Partial<Omit<RedactionBox, 'id'>>) => void;
  /** Delete redaction callback */
  onRemoveRedaction: (id: string) => void;
  /** Seek callback */
  onSeek: (targetMs: number) => void;
  /** Set In-Point callback */
  onSetInPoint: (id: string, startMs: number) => void;
  /** Set Out-Point callback */
  onSetOutPoint: (id: string, endMs: number) => void;
}

/**
 * Annotation sidebar inspector and layer list.
 */
export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  redactions,
  activeRedactions,
  selectedRedaction,
  currentTimeMs,
  fps,
  onSelectRedaction,
  onUpdateRedaction,
  onRemoveRedaction,
  onSeek,
  onSetInPoint,
  onSetOutPoint
}) => {
  const activeIds = new Set(activeRedactions.map(r => r.id));

  return (
    <aside
      className="w-full lg:w-80 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col h-full overflow-hidden shadow-lg select-none"
      aria-label="Annotation Inspector and Segment List"
    >
      {/* Header with counter badge */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Redactions
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
            {activeRedactions.length} Active / {redactions.length} Total
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Selected Redaction Inspector Card */}
        {selectedRedaction ? (
          <div className="bg-zinc-900/90 border border-blue-500/50 rounded-lg p-3 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-blue-400 font-mono flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                Selected Segment
              </span>
              <button
                type="button"
                onClick={() => onSelectRedaction(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Deselect annotation (Escape)"
                title="Deselect (Esc)"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Label text input */}
            <div>
              <label
                htmlFor="redaction-label-input"
                className="block text-[11px] font-medium text-zinc-300 mb-1"
              >
                Annotation Label
              </label>
              <div className="relative">
                <input
                  id="redaction-label-input"
                  type="text"
                  value={selectedRedaction.label}
                  onChange={(e) => onUpdateRedaction(selectedRedaction.id, { label: e.target.value })}
                  placeholder="e.g. Suspect Face, License Plate"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <Tag className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-2.5 pointer-events-none" aria-hidden="true" />
              </div>
            </div>

            {/* Redaction Treatment Type Selector */}
            <div>
              <span className="block text-[11px] font-medium text-zinc-300 mb-1">
                Visual Treatment
              </span>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Redaction filter type">
                {(['blur', 'pixelate', 'blackout'] as RedactionType[]).map((type) => {
                  const isCurrent = selectedRedaction.type === type;
                  let icon = <Sparkles className="w-3 h-3" aria-hidden="true" />;
                  let activeClass = 'bg-blue-600 text-white border-blue-400';

                  if (type === 'pixelate') {
                    icon = <Grid className="w-3 h-3" aria-hidden="true" />;
                    activeClass = 'bg-amber-600 text-white border-amber-400';
                  } else if (type === 'blackout') {
                    icon = <Square className="w-3 h-3" aria-hidden="true" />;
                    activeClass = 'bg-zinc-800 text-white border-zinc-400';
                  }

                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={isCurrent}
                      onClick={() => onUpdateRedaction(selectedRedaction.id, { type })}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-[10px] font-medium capitalize gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isCurrent
                          ? activeClass
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {icon}
                      <span>{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Temporal Validity In/Out Markers */}
            <div className="space-y-2 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  In-Point:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-emerald-300 font-semibold text-xs">
                    {msToTimecode(selectedRedaction.startMs, fps).formatted}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetInPoint(selectedRedaction.id, currentTimeMs)}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-mono border border-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    title="Set in-point to current playhead ([)"
                    aria-label="Set In-Point to current timestamp ([ key)"
                  >
                    Set [
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-red-400" aria-hidden="true" />
                  Out-Point:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-red-300 font-semibold text-xs">
                    {msToTimecode(selectedRedaction.endMs, fps).formatted}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetOutPoint(selectedRedaction.id, currentTimeMs)}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-mono border border-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    title="Set out-point to current playhead (])"
                    aria-label="Set Out-Point to current timestamp (] key)"
                  >
                    Set ]
                  </button>
                </div>
              </div>
            </div>

            {/* Normalized Coordinates Readout */}
            <div className="bg-zinc-950/80 rounded p-2 text-[10px] font-mono text-zinc-400 border border-zinc-800">
              <div className="flex justify-between">
                <span>X: {selectedRedaction.bbox[0].toFixed(4)}</span>
                <span>Y: {selectedRedaction.bbox[1].toFixed(4)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>W: {selectedRedaction.bbox[2].toFixed(4)}</span>
                <span>H: {selectedRedaction.bbox[3].toFixed(4)}</span>
              </div>
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onRemoveRedaction(selectedRedaction.id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800/80 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Delete this redaction annotation (Delete or Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Redaction</span>
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4 text-center">
            <p className="text-xs text-zinc-400">
              Select or draw a bounding box on the video frame to edit its properties.
            </p>
          </div>
        )}

        {/* Complete Redaction Segments List */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
            Segment Timeline List
          </h3>

          {redactions.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">
              No redactions added yet.
            </p>
          ) : (
            <div className="space-y-1.5" role="list">
              {redactions.map((box) => {
                const isSelected = box.id === selectedRedaction?.id;
                const isCurrentlyVisible = activeIds.has(box.id);

                return (
                  <div
                    key={box.id}
                    role="listitem"
                    onClick={() => {
                      onSelectRedaction(box.id);
                      onSeek(box.startMs);
                    }}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected
                        ? 'bg-zinc-900 border-blue-500 text-white'
                        : 'bg-zinc-950/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCurrentlyVisible ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                          title={isCurrentlyVisible ? 'Visible at current timestamp' : 'Inactive at current timestamp'}
                          aria-hidden="true"
                        />
                        <span className="font-semibold truncate">{box.label}</span>
                        <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {box.type}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {msToTimecode(box.startMs, fps).formatted} to {msToTimecode(box.endMs, fps).formatted}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRedaction(box.id);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                      aria-label={`Delete ${box.label}`}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
