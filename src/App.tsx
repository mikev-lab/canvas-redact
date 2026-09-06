import React, { useState } from 'react';
import { Shield, Play, Video, Download, Sliders, Layers } from 'lucide-react';
import { RedactionBox } from './types';

export default function App(): React.ReactElement {
  const [redactions] = useState<RedactionBox[]>([]);
  const [currentTimeMs] = useState<number>(0);

  return (
    <div className="flex flex-col min-h-screen bg-obsidian text-zinc-100 font-sans">
      {/* Header Landmark */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-forensic-blue/10 border border-forensic-blue/30 rounded-lg text-forensic-blue">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              canvas-redact
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v0.1.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Frame-accurate video evidence redaction</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors text-zinc-200 flex items-center gap-1.5 focus-visible:outline-none"
            aria-label="Load demo evidence video"
          >
            <Video className="w-3.5 h-3.5 text-forensic-blue" aria-hidden="true" />
            Load Sample Clip
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-medium bg-forensic-blue hover:bg-blue-600 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20 focus-visible:outline-none"
            aria-label="Export redaction coordinates to JSON"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export Evidence JSON
          </button>
        </div>
      </header>

      {/* Main Layout Landmark */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Video Viewport & Controls */}
        <section
          aria-label="Video Player and Controls"
          className="flex-1 flex flex-col items-center justify-center p-4 bg-black/40 border-b lg:border-b-0 lg:border-r border-obsidian-border"
        >
          <div className="w-full max-w-4xl aspect-video bg-obsidian-elevated rounded-xl border border-obsidian-border flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400 mb-3">
                <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-medium text-zinc-200 mb-1">Canvas Video Redactor Ready</h2>
              <p className="text-xs text-zinc-400 max-w-md">
                Load a local evidence video file or trigger the synthetic procedural CCTV sample to start annotating redactions.
              </p>
            </div>

            {/* Timecode HUD */}
            <div
              className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm border border-zinc-800 rounded px-2 py-1 font-mono text-xs text-zinc-300 flex items-center gap-2"
              aria-live="polite"
            >
              <span className="text-forensic-blue font-semibold">00:00:00:00</span>
              <span className="text-zinc-600">|</span>
              <span>{currentTimeMs.toFixed(0)} ms</span>
            </div>
          </div>
        </section>

        {/* Right Column: Redaction Inspector Sidebar */}
        <aside
          aria-label="Redaction Annotations Sidebar"
          className="w-full lg:w-80 bg-obsidian-surface p-4 flex flex-col gap-4 border-obsidian-border"
        >
          <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-forensic-blue" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-zinc-200">Annotations</h2>
            </div>
            <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
              {redactions.length} Total
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            <Sliders className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
            <p className="text-xs font-medium text-zinc-400">No active redactions</p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Drag over the video canvas to create blur, pixelate, or blackout regions.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
