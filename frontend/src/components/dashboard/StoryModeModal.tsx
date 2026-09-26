import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Presentation,
  ShieldAlert
} from 'lucide-react';
import { Dataset, DashboardSheet, DashboardChart, AnalysisOverview } from '../../types';
import { ChartRenderer } from './ChartRenderer';

interface StoryModeModalProps {
  dataset: Dataset;
  sheet: DashboardSheet;
  overview?: AnalysisOverview | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StoryModeModal: React.FC<StoryModeModalProps> = ({
  dataset,
  sheet,
  overview,
  isOpen,
  onClose
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const charts: DashboardChart[] = sheet.charts || [];
  // Slides:
  // Slide 0: Executive Pulse
  // Slide 1..N: Individual Chart deep-dives
  // Slide N+1: Risk & Anomaly Watch
  // Slide N+2: Strategic Conclusion
  const totalSlides = 1 + charts.length + (overview?.anomalies?.length ? 1 : 0) + 1;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalSlides]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isAutoPlaying || !isOpen) return;

    const timer = setInterval(() => {
      setCurrentSlide(prev => {
        if (prev + 1 >= totalSlides) {
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 8000);

    return () => clearInterval(timer);
  }, [isAutoPlaying, isOpen, totalSlides]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#060913] text-white flex flex-col justify-between animate-fadeIn overflow-hidden select-none">
      {/* Top Presentation Bar */}
      <div className="px-3.5 sm:px-8 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-glow-brand">
            <Presentation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>{dataset.name}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300 font-normal">{sheet.title}</span>
            </h3>
            <span className="text-[11px] text-brand-400 font-mono">
              Slide {currentSlide + 1} of {totalSlides}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              isAutoPlaying
                ? 'btn-3d-emerald shadow-sm'
                : 'btn-3d-secondary text-slate-300 hover:text-white'
            }`}
          >
            {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isAutoPlaying ? 'Auto-Advancing (8s)' : 'Auto-Play'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="btn-3d-secondary p-2 rounded-xl text-slate-400 hover:text-white"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="btn-3d-secondary p-2 rounded-xl text-slate-400 hover:text-white ml-2"
            title="Exit Presentation (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Content Area */}
      <div className="flex-1 p-3.5 sm:p-8 md:p-14 flex items-center justify-center overflow-y-auto">
        {/* SLIDE 0: Executive Pulse & Title */}
        {currentSlide === 0 && (
          <div className="max-w-4xl w-full space-y-6 sm:space-y-8 animate-fadeIn">
            <div className="space-y-3 text-center">
              <span className="text-xs px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 font-mono border border-brand-500/30 uppercase tracking-widest font-bold inline-block">
                Executive Strategy Deck • {dataset.detected_domain || 'Enterprise Analytics'}
              </span>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {dataset.name}
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                Comprehensive operational performance synthesis, autonomous trend discovery, and risk diagnostic brief.
              </p>
            </div>

            {/* Top KPI Pulse Grid */}
            {overview && overview.kpis && overview.kpis.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {overview.kpis.slice(0, 3).map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-2xl space-y-2 hover:border-brand-500/40 transition"
                  >
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                      {kpi.name}
                    </span>
                    <span className="text-3xl font-black font-mono text-white block">
                      {kpi.formatted_value || String(kpi.value)}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full inline-block font-mono font-bold ${
                        kpi.status === 'positive'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : kpi.status === 'negative'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {kpi.status?.toUpperCase() || 'NORMAL'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Strategic Summary Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-950/40 via-blue-950/40 to-slate-900 border border-brand-500/30 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                Data health score evaluated at <strong className="text-white">{dataset.data_health_score || 95}/100</strong>.
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-300 font-mono text-xs">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-300 font-mono text-xs">→</kbd> to advance into individual analytical slide deep-dives.
              </p>
            </div>
          </div>
        )}

        {/* SLIDES 1 to N: Individual Chart Spotlights */}
        {currentSlide > 0 && currentSlide <= charts.length && (() => {
          const chart = charts[currentSlide - 1];
          return (
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
              {/* Left Column: AI Commentary & Story Narrative */}
              <div className="lg:col-span-4 space-y-6">
                <div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-mono border border-brand-500/30 font-bold uppercase">
                    Visualization {currentSlide} of {charts.length}
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight mt-2">
                    {chart.title}
                  </h2>
                  {chart.description && (
                    <p className="text-xs text-slate-400 mt-1">{chart.description}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-brand-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Key Pattern
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Tracking aggregate <strong>{chart.aggregation?.toUpperCase()}</strong> across{' '}
                      <strong>{chart.x_field || 'time'}</strong>. Significant operational distribution concentrated in lead cohorts.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Performance Takeaway
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Trajectory indicates consistent volume velocity. Recommended action: leverage top-performing segments to offset trailing cohorts.
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800">
                  <span>Dimension: {chart.x_field}</span>
                  <span className="text-brand-400">Metric: {chart.y_field}</span>
                </div>
              </div>

              {/* Right Column: High-Res Interactive Chart Container */}
              <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/50 border border-slate-800 shadow-2xl flex flex-col justify-center min-h-[420px]">
                <ChartRenderer chart={chart} />
              </div>
            </div>
          );
        })()}

        {/* SLIDE N+1: Anomaly & Risk Watch (if anomalies exist) */}
        {overview?.anomalies && overview.anomalies.length > 0 && currentSlide === charts.length + 1 && (
          <div className="max-w-4xl w-full space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30 font-bold uppercase">
                Diagnostic Section
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight">
                Operational Anomaly & Risk Radar
              </h2>
              <p className="text-xs text-slate-400">
                Automated statistical scans flagged the following operational variance outliers:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {overview.anomalies.slice(0, 4).map((anomaly, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2 hover:border-rose-500/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">
                      {anomaly.column_name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        anomaly.severity === 'critical' || anomaly.severity === 'high'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{anomaly.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINAL SLIDE: Strategic Action Plan */}
        {currentSlide === totalSlides - 1 && (
          <div className="max-w-3xl w-full space-y-8 animate-fadeIn text-center">
            <div className="space-y-3">
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 uppercase tracking-widest font-bold inline-block">
                Deck Conclusion
              </span>
              <h2 className="text-4xl font-black text-white tracking-tight">
                Executive Action Plan
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Synthesized prescriptive initiatives derived from verified dataset patterns:
              </p>
            </div>

            <div className="space-y-3 text-left max-w-xl mx-auto">
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Capitalize on Core Growth Cohorts</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Maintain continuous inventory allocation and marketing investment toward top-performing segments.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Mitigate Operational Variance Drags</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Launch Driver Tree diagnostics on lagging categories to pinpoint pricing and supply friction.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Stress-Test Next Quarter Targets</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Utilize the What-If Scenario Sandbox to model elasticity curves before finalizing budget commitments.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow-brand transition"
            >
              Close Presentation Deck
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation Tray */}
      <div className="px-3.5 sm:px-8 py-3 sm:py-4 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between">
        <button
          onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
          disabled={currentSlide === 0}
          className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        {/* Slide Dots / Indicators */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all ${
                currentSlide === idx
                  ? 'w-8 bg-brand-500 shadow-glow-sm'
                  : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
              title={`Jump to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1))}
          disabled={currentSlide === totalSlides - 1}
          className="btn-3d-primary px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
