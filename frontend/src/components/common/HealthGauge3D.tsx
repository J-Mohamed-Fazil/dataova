import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card3D } from './Card3D';

interface HealthGauge3DProps {
  score: number;
  onInspectSchema?: () => void;
}

export const HealthGauge3D: React.FC<HealthGauge3DProps> = ({ score, onInspectSchema }) => {
  const isHealthy = score >= 80;
  const isModerate = score >= 60 && score < 80;

  // Gauge calculations
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const colorConfig = isHealthy
    ? {
        primary: '#10b981', // Emerald
        secondary: '#06b6d4', // Cyan
        gradientId: 'gauge-healthy',
        badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        label: score >= 90 ? 'Exceptional Integrity' : 'Reliable Quality',
      }
    : isModerate
    ? {
        primary: '#f59e0b', // Amber
        secondary: '#f97316', // Orange
        gradientId: 'gauge-mod',
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        label: 'Moderate Health',
      }
    : {
        primary: '#f43f5e', // Rose
        secondary: '#e11d48',
        gradientId: 'gauge-risk',
        badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        glowColor: 'rgba(244, 63, 94, 0.4)',
        label: 'Audit Recommended',
      };

  return (
    <Card3D
      maxTilt={14}
      perspective={1000}
      scale={1.02}
      className="p-6 rounded-2xl glass-3d-card flex flex-col justify-between shadow-2xl relative overflow-hidden group"
    >
      {/* 3D Top Specular Light Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500 shadow-sm" />

      {/* Header */}
      <div className="pt-2 flex items-center justify-between translate-z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Data Health Score
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        {isHealthy ? (
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* 3D Volumetric Dial Body */}
      <div className="my-3 flex flex-col items-center justify-center relative translate-z-20">
        {/* Outer Beveled Cyber Housing */}
        <div className="relative w-36 h-36 flex items-center justify-center rounded-full bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.6)] border border-slate-700/60">
          
          {/* Ambient Glow Core */}
          <div
            className="absolute inset-4 rounded-full blur-xl pointer-events-none transition-all duration-700 opacity-60 group-hover:opacity-100"
            style={{ backgroundColor: colorConfig.glowColor }}
          />

          <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
            <defs>
              <linearGradient id={colorConfig.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colorConfig.secondary} />
                <stop offset="100%" stopColor={colorConfig.primary} />
              </linearGradient>
              <filter id="glow-3d" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={colorConfig.primary} floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Inset Dark Track Ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#0f172a"
              strokeWidth="9"
              className="drop-shadow-sm"
            />

            {/* Subtle Tick Ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="11"
              strokeDasharray="2 6"
            />

            {/* Glowing 3D Progress Arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={`url(#${colorConfig.gradientId})`}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#glow-3d)"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Floating 3D Score Core with Depth Parallax */}
          <div className="absolute inset-0 m-auto w-20 h-20 rounded-full flex flex-col items-center justify-center text-center bg-slate-900/90 border border-slate-700/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.5)] translate-z-30">
            <span className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-md">
              {score}
            </span>
            <span className="text-[10px] text-cyan-400 font-mono font-semibold mt-0.5 tracking-wider">
              / 100
            </span>
          </div>
        </div>

        {/* Rating Badge */}
        <div
          className={`mt-3 text-xs font-bold px-3 py-1 rounded-full border shadow-sm translate-z-15 transition-all duration-300 ${colorConfig.badgeBg}`}
        >
          {colorConfig.label}
        </div>
      </div>

      {/* Footer / Action */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 translate-z-10">
        <span className="font-mono text-[11px]">Deterministic Audit</span>
        {onInspectSchema && (
          <button
            onClick={onInspectSchema}
            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition group/btn"
          >
            <span>Inspect Schema</span>
            <span className="group-hover/btn:translate-x-0.5 transition-transform duration-200">→</span>
          </button>
        )}
      </div>
    </Card3D>
  );
};
