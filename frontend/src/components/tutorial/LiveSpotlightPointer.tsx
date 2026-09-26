import React, { useEffect, useState, useRef } from 'react';
import { MousePointer2, Sparkles, Zap, CheckCircle2, BarChart2 } from 'lucide-react';

export interface LiveSpotlightPointerProps {
  targetSelector?: string;
  phase: 'action' | 'output';
  actionStatus?: 'moving' | 'clicking' | 'inspecting' | 'idle';
  label?: string;
  outputSnippet?: string;
}

interface TargetBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  visible: boolean;
}

export const LiveSpotlightPointer: React.FC<LiveSpotlightPointerProps> = ({
  targetSelector,
  phase,
  actionStatus = 'idle',
  label = 'Nova is interacting here live',
  outputSnippet
}) => {
  const [bounds, setBounds] = useState<TargetBounds | null>(null);
  const [isClickRipple, setIsClickRipple] = useState<boolean>(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!targetSelector) {
      setBounds(null);
      return;
    }

    const updateBounds = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setBounds({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: true
          });
          return;
        }
      }
      setBounds(null);
    };

    const el = document.querySelector(targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    updateBounds();

    const loop = () => {
      updateBounds();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [targetSelector]);

  // Click ripple trigger
  useEffect(() => {
    if (actionStatus === 'clicking') {
      setIsClickRipple(true);
      const t = setTimeout(() => setIsClickRipple(false), 1100);
      return () => clearTimeout(t);
    }
  }, [actionStatus]);

  if (!bounds || !bounds.visible) return null;

  // Position coordinates
  const pointerX = bounds.left + bounds.width / 2;
  const pointerY = bounds.top + bounds.height / 2;

  // Decide callout bubble placement (top or bottom depending on screen position)
  const isNearBottom = bounds.top > window.innerHeight - 200;
  const calloutTop = isNearBottom ? Math.max(10, bounds.top - 60) : bounds.top + bounds.height + 12;
  const calloutLeft = Math.min(window.innerWidth - 320, Math.max(16, bounds.left));

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none transition-all duration-300">
      {/* 1. Holographic Cyber Spotlight Box over the Target Element */}
      <div
        className={`absolute rounded-2xl transition-all duration-500 ease-out border-2 ${
          phase === 'action'
            ? 'border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.7),inset_0_0_20px_rgba(6,182,212,0.3)] bg-cyan-500/15'
            : 'border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.7),inset_0_0_20px_rgba(52,211,153,0.3)] bg-emerald-500/15'
        }`}
        style={{
          top: Math.max(0, bounds.top - 6),
          left: Math.max(0, bounds.left - 6),
          width: bounds.width + 12,
          height: bounds.height + 12
        }}
      >
        {/* Animated High-Tech Corner Brackets */}
        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-300" />
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-300" />
        <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-300" />
        <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-300" />

        {/* Pulsing Target Radar Ping */}
        <span className="absolute inset-0 rounded-2xl border-2 border-cyan-400 animate-ping opacity-50 pointer-events-none" />
      </div>

      {/* 2. Virtual Robotic Laser Pointer Cursor */}
      <div
        className="absolute transition-all duration-300 ease-out flex flex-col items-center pointer-events-none"
        style={{
          top: pointerY,
          left: pointerX,
          transform: 'translate(-14px, -14px)'
        }}
      >
        {/* Click Ripple Waves */}
        {isClickRipple && (
          <>
            <span className="absolute -top-4 -left-4 w-16 h-16 rounded-full border-4 border-cyan-300 bg-cyan-400/40 animate-ping" />
            <span className="absolute -top-2 -left-2 w-12 h-12 rounded-full border-2 border-white animate-ping opacity-80" />
          </>
        )}

        {/* Robotic Cursor */}
        <div className="relative">
          <MousePointer2
            className={`w-9 h-9 drop-shadow-[0_0_15px_#38bdf8] fill-cyan-400 transform -rotate-12 animate-bounce-gentle ${
              phase === 'action' ? 'text-cyan-300' : 'text-emerald-300 fill-emerald-400'
            }`}
          />
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee] animate-pulse" />
        </div>
      </div>

      {/* 3. Floating Contextual Target HUD Callout Beside the Element */}
      <div
        className="absolute transition-all duration-300 ease-out pointer-events-none max-w-xs"
        style={{
          top: calloutTop,
          left: calloutLeft
        }}
      >
        <div className="p-3 rounded-2xl bg-[#071128]/95 border border-cyan-400/80 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-2xl space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${
                phase === 'action'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {phase === 'action' ? (
                <>
                  <Zap className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                  <span>PHASE 1: AI ACTION</span>
                </>
              ) : (
                <>
                  <BarChart2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>PHASE 2: AI OUTPUT</span>
                </>
              )}
            </span>
            <span className="text-[9px] font-mono text-slate-400">TARGET ACQUIRED</span>
          </div>

          <p className="text-xs font-bold text-white leading-tight">{label}</p>

          {outputSnippet && phase === 'output' && (
            <p className="text-[11px] text-emerald-300 font-mono line-clamp-2 leading-relaxed border-t border-slate-800 pt-1">
              {outputSnippet}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
