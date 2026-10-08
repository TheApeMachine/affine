import React, { useState } from 'react';

interface SignalRasterProps {
  data: (number | null)[];
  title: string;
  subtitle?: string;
  width?: number; // default 16
  height?: number; // default 16
  mode?: 'grayscale' | 'heatmap' | 'difference';
  highlightMask?: boolean[];
  droppedIndices?: Set<number>;
  onCellClick?: (index: number) => void;
  interactivePaint?: boolean;
  onPaint?: (index: number, val: number) => void;
  showLabels?: boolean;
}

export const SignalRaster: React.FC<SignalRasterProps> = ({
  data,
  title,
  subtitle,
  width = 16,
  height = 16,
  mode = 'grayscale',
  highlightMask,
  droppedIndices,
  onCellClick,
  interactivePaint = false,
  onPaint,
  showLabels = false
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  const getCellColor = (val: number | null, idx: number): string => {
    if (val === null || (droppedIndices && droppedIndices.has(idx))) {
      // Hatched or dropped cell
      return 'rgba(15, 23, 42, 0.4)';
    }

    if (mode === 'difference') {
      // Delta error color: 0 is green, small error is yellow, large error is red
      const err = Math.min(255, Math.abs(val));
      if (err === 0) return '#052e16'; // perfect match dark emerald
      if (err < 10) return '#047857';
      if (err < 40) return '#b45309';
      return '#dc2626';
    }

    if (mode === 'heatmap') {
      // Spectral cyan-to-amber
      const norm = Math.max(0, Math.min(1, val / 255));
      const r = Math.round(norm * 245);
      const g = Math.round((1 - Math.abs(norm - 0.5) * 2) * 200);
      const b = Math.round((1 - norm) * 230);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Default monochrome scientific lab phosphor
    const norm = Math.max(0, Math.min(1, val / 255));
    const intensity = Math.round(norm * 255);
    return `rgb(${intensity}, ${intensity}, ${intensity})`;
  };

  const handleCellAction = (idx: number) => {
    if (interactivePaint && onPaint) {
      const current = data[idx] ?? 0;
      onPaint(idx, current === 0 ? 255 : 0);
    } else if (onCellClick) {
      onCellClick(idx);
    }
  };

  const hoveredVal = hoveredIdx !== null ? data[hoveredIdx] : null;
  const isHoveredDropped = hoveredIdx !== null && (hoveredVal === null || (droppedIndices && droppedIndices.has(hoveredIdx)));

  return (
    <div
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => {
        setIsMouseDown(false);
        setHoveredIdx(null);
      }}
      className="flex flex-col bg-[#0b0e17] border border-slate-800 rounded-lg p-3 w-full"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 tracking-wide">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 font-mono">{subtitle}</p>}
        </div>
        {hoveredIdx !== null ? (
          <div className="text-[11px] font-mono text-cyan-400">
            idx: {hoveredIdx} (r:{Math.floor(hoveredIdx / width)}, c:{hoveredIdx % width}) ·{' '}
            {isHoveredDropped ? (
              <span className="text-rose-400 font-semibold">ERASED</span>
            ) : (
              <span>val: {hoveredVal}</span>
            )}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            {width}×{height} ({data.length} cells)
          </div>
        )}
      </div>

      <div
        className="grid gap-[1px] bg-slate-900 border border-slate-800/90 rounded p-1 aspect-square w-full select-none"
        style={{
          gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`
        }}
      >
        {data.map((val, idx) => {
          const isDropped = val === null || (droppedIndices && droppedIndices.has(idx));
          const isHighlighted = highlightMask && highlightMask[idx];
          const color = getCellColor(val, idx);

          return (
            <div
              key={idx}
              onMouseDown={() => {
                setIsMouseDown(true);
                handleCellAction(idx);
              }}
              onMouseEnter={() => {
                setHoveredIdx(idx);
                if (isMouseDown) {
                  handleCellAction(idx);
                }
              }}
              style={{ backgroundColor: color }}
              className={`relative transition-transform duration-75 cursor-crosshair rounded-[1px] flex items-center justify-center ${
                isDropped
                  ? 'border border-dashed border-rose-500/40 opacity-50 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:4px_4px]'
                  : ''
              } ${isHighlighted ? 'ring-1 ring-cyan-400 z-10' : ''}`}
            >
              {isDropped && (
                <span className="text-[8px] text-rose-500 font-mono select-none font-bold">✕</span>
              )}
              {showLabels && !isDropped && val !== null && (
                <span className="text-[7px] text-slate-400 font-mono opacity-60">
                  {val}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
