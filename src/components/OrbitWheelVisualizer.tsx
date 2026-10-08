import React, { useMemo, useRef, useState, useEffect } from 'react';
import { getAffinePermutation } from '../math/gf257';

interface OrbitWheelVisualizerProps {
  k: number;
  b?: number;
  keptMask: boolean[];
  size?: number; // default 256
}

export const OrbitWheelVisualizer: React.FC<OrbitWheelVisualizerProps> = ({
  k,
  b = 0,
  keptMask,
  size = 256
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { forward, a } = useMemo(() => {
    return getAffinePermutation(k, b, size);
  }, [k, b, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width * 0.42;

    ctx.clearRect(0, 0, width, height);

    // Background circle ring
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary inner guide
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Number of chords to render (sample 64 for visual clarity so it doesn't become a solid blur)
    const chordStep = 4;
    ctx.lineWidth = 0.7;

    for (let i = 0; i < size; i += chordStep) {
      const target = forward[i];
      const isKept = keptMask[i];
      const isTargetKept = keptMask[target];

      const theta1 = (i / size) * Math.PI * 2 - Math.PI / 2;
      const theta2 = (target / size) * Math.PI * 2 - Math.PI / 2;

      const x1 = cx + Math.cos(theta1) * radius;
      const y1 = cy + Math.sin(theta1) * radius;
      const x2 = cx + Math.cos(theta2) * radius;
      const y2 = cy + Math.sin(theta2) * radius;

      const isHovered = hoveredIdx === i || hoveredIdx === target;

      if (isHovered) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
      } else if (isKept && isTargetKept) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.lineWidth = 0.9;
      } else if (isKept) {
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.12)';
        ctx.lineWidth = 0.6;
      } else {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.04)';
        ctx.lineWidth = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      // Quadratic curve bending slightly toward center
      const midDist = radius * 0.4;
      const midX = cx + (Math.cos((theta1 + theta2) / 2) * midDist);
      const midY = cy + (Math.sin((theta1 + theta2) / 2) * midDist);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
    }

    // Draw perimeter node dots
    for (let i = 0; i < size; i += 2) {
      const isKept = keptMask[i];
      const theta = (i / size) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(theta) * radius;
      const py = cy + Math.sin(theta) * radius;

      const isHovered = hoveredIdx === i;

      if (isHovered) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isKept) {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Center focal label
    ctx.fillStyle = '#06b6d4';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`k = ${k}`, cx, cy - 8);
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`multiplier a = ${a}`, cx, cy + 8);
  }, [k, b, size, forward, a, keptMask, hoveredIdx]);

  return (
    <div className="flex flex-col items-center bg-[#0b0e17] border border-slate-800 rounded-lg p-3">
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-200 font-mono">
          Finite Field Orbit Wheel
        </span>
        <span className="text-[11px] font-mono text-cyan-400">
          GF(257) Chords
        </span>
      </div>

      <div className="relative aspect-square w-full max-w-[240px]">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="w-full h-full"
        />
      </div>

      <div className="w-full flex justify-between text-[10px] font-mono text-slate-500 mt-2">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          Retained Nodes
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
          Discarded Nodes
        </span>
      </div>
    </div>
  );
};
