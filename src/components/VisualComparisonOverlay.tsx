import React, { useState } from 'react';

interface VisualComparisonOverlayProps {
  original: number[];
  reconstructed: number[];
  retainedCount: number;
  totalCount?: number; // 256
  isExact: boolean;
  psnr: number;
}

export const VisualComparisonOverlay: React.FC<VisualComparisonOverlayProps> = ({
  original,
  reconstructed,
  retainedCount,
  totalCount = 256,
  isExact,
  psnr
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100%
  const [viewMode, setViewMode] = useState<'split' | 'difference' | 'ghost'>('split');

  const reductionPercent = Math.max(0, Math.round((1 - retainedCount / totalCount) * 100));
  const compressionMultiplier = (totalCount / Math.max(1, retainedCount)).toFixed(1);

  return (
    <div className="bg-[#0b0e17] border border-slate-800 rounded-lg p-4 space-y-4">
      {/* Top Header & Visual Mode Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Interactive Visual Comparison
          </h4>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Compare original input with reconstructed shape without reading numbers.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              viewMode === 'split'
                ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Split Slider
          </button>
          <button
            onClick={() => setViewMode('difference')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              viewMode === 'difference'
                ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Discrepancy Glow
          </button>
          <button
            onClick={() => setViewMode('ghost')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              viewMode === 'ghost'
                ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ghost Blend
          </button>
        </div>
      </div>

      {/* Visual Data Reduction Meter */}
      <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Data Footprint Shrinkage:</span>
          <span className="text-emerald-400 font-bold text-sm">
            {reductionPercent}% Thrown Away ({compressionMultiplier}x Smaller!)
          </span>
        </div>

        {/* Progress gauge bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          <div
            style={{ width: `${(retainedCount / totalCount) * 100}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
          />
          <div className="flex-1 h-full bg-slate-900/80 pattern-diagonal-stripes" />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>{retainedCount} Stored Cells</span>
          <span className="text-emerald-400 font-semibold">
            {isExact ? '● Flawless Visual Match' : `● ${psnr >= 35 ? 'High Clarity' : 'Partial Loss'}`}
          </span>
          <span>{totalCount - retainedCount} Discarded Cells</span>
        </div>
      </div>

      {/* Interactive Visual Canvas Container */}
      <div className="relative aspect-square max-w-[320px] mx-auto bg-slate-950 border border-slate-800 rounded-lg overflow-hidden select-none">
        {viewMode === 'split' && (
          <>
            {/* Background: Reconstructed */}
            <div
              className="absolute inset-0 grid gap-[1px] p-1.5"
              style={{
                gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
              }}
            >
              {reconstructed.map((val, idx) => (
                <div
                  key={`rec-${idx}`}
                  style={{ backgroundColor: `rgb(${val}, ${val}, ${val})` }}
                  className="w-full h-full rounded-[0.5px]"
                />
              ))}
            </div>

            {/* Foreground: Original (clipped by slider) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <div
                className="w-full h-full grid gap-[1px] p-1.5"
                style={{
                  gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
                }}
              >
                {original.map((val, idx) => (
                  <div
                    key={`orig-${idx}`}
                    style={{ backgroundColor: `rgb(${val}, ${val}, ${val})` }}
                    className="w-full h-full rounded-[0.5px]"
                  />
                ))}
              </div>
            </div>

            {/* Vertical Split Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none shadow-[0_0_10px_rgba(6,182,212,0.8)]"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-[10px] font-bold shadow-md">
                ↔
              </div>
            </div>

            {/* Invisible Range Slider Overlay for dragging */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />
          </>
        )}

        {viewMode === 'difference' && (
          <div
            className="w-full h-full grid gap-[1px] p-1.5"
            style={{
              gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
            }}
          >
            {original.map((val, idx) => {
              const err = Math.abs(val - reconstructed[idx]);
              // Green if 0 error, gold if small, hot red if error
              let color = '#052e16'; // perfect emerald
              if (err > 0 && err < 10) color = '#047857';
              else if (err >= 10 && err < 40) color = '#d97706';
              else if (err >= 40) color = '#dc2626';

              return (
                <div
                  key={`diff-${idx}`}
                  style={{ backgroundColor: color }}
                  className="w-full h-full rounded-[0.5px]"
                />
              );
            })}
          </div>
        )}

        {viewMode === 'ghost' && (
          <div className="relative w-full h-full">
            {/* Original in Blue phosphor */}
            <div
              className="absolute inset-0 grid gap-[1px] p-1.5 opacity-70"
              style={{
                gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
              }}
            >
              {original.map((val, idx) => (
                <div
                  key={`ghost-orig-${idx}`}
                  style={{ backgroundColor: `rgb(0, ${Math.round(val * 0.8)}, ${val})` }}
                  className="w-full h-full rounded-[0.5px]"
                />
              ))}
            </div>

            {/* Reconstructed in Amber phosphor */}
            <div
              className="absolute inset-0 grid gap-[1px] p-1.5 mix-blend-screen opacity-70"
              style={{
                gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(16, minmax(0, 1fr))'
              }}
            >
              {reconstructed.map((val, idx) => (
                <div
                  key={`ghost-rec-${idx}`}
                  style={{ backgroundColor: `rgb(${val}, ${Math.round(val * 0.7)}, 0)` }}
                  className="w-full h-full rounded-[0.5px]"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
        <span>← Original Input</span>
        <span className="text-cyan-400">
          {viewMode === 'split' ? 'Drag slider across image' : viewMode === 'difference' ? 'Emerald = Exact Match' : 'Cyan + Amber Blend'}
        </span>
        <span>Reconstructed Output →</span>
      </div>
    </div>
  );
};
