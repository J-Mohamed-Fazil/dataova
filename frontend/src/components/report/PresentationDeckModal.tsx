import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Award,
  AlertTriangle,
  FileText,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { ReportDocument, KpiMetric, Insight, AnomalyRecord, Dataset } from '../../types';

interface PresentationDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportDocument | null;
  dataset: Dataset | null;
  kpis?: KpiMetric[];
  insights?: Insight[];
  anomalies?: AnomalyRecord[];
}

export const PresentationDeckModal: React.FC<PresentationDeckModalProps> = ({
  isOpen,
  onClose,
  report,
  dataset,
  kpis = [],
  insights = [],
  anomalies = []
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  // Keyboard navigation: Left/Right arrows, Space, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  // Build slides from report sections & metrics
  const slides = [
    // Slide 1: Executive Title & Domain
    {
      type: 'title',
      title: report?.title || 'Executive Analytical Briefing',
      subtitle: `${dataset?.detected_domain || 'Enterprise'} Strategic Intelligence & Horizon Evaluation`,
      author: 'DATOVA AI Autonomous Reasoner',
      date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      healthScore: dataset?.data_health_score || 0
    },
    // Slide 2: Executive Summary
    {
      type: 'summary',
      title: 'Executive Summary & Operating Context',
      content: report?.summary || 'Comprehensive empirical analysis identifying growth drivers, margin variances, and operational anomalies across the dataset.'
    },
    // Slide 3: Key Business KPIs
    {
      type: 'kpis',
      title: 'Enterprise Performance Indicators',
      kpis: kpis.slice(0, 4)
    },
    // Slide 4: Top Strategic Insights
    {
      type: 'insights',
      title: 'Core Analytical Findings & Drivers',
      insights: insights.slice(0, 3)
    },
    // Slide 5: Data Quality & Anomalies
    {
      type: 'governance',
      title: 'Data Health & Statistical Anomalies',
      healthScore: dataset?.data_health_score || 0,
      anomalies: anomalies.slice(0, 3)
    },
    // Slide 6: Prescriptive Recommendations
    {
      type: 'takeaways',
      title: 'Strategic Priorities & Recommended Actions',
      items: [
        'Capitalize on top-performing product categories to expand customer lifetime value.',
        'Address discount margin compression in lagging territories through tier optimization.',
        'Implement rolling re-forecasts to mitigate empirical volatility.',
        'Deploy automated pipeline cleansing to ensure ongoing data health integrity.'
      ]
    }
  ];

  const totalSlides = slides.length;
  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 bg-[#060911] text-white flex flex-col select-none">
      {/* Top Deck Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-glow-brand">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300">DATOVA AI</span>
            <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider block">
              Executive Briefing Mode
            </span>
          </div>
        </div>

        {/* Slide Counter */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-white font-bold">{currentSlide + 1}</span>
          <span>/</span>
          <span>{totalSlides}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">→</kbd>
            <span>navigate</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 ml-2">ESC</kbd>
            <span>exit</span>
          </div>

          <button
            onClick={onClose}
            className="btn-3d-secondary p-2 rounded-xl text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-16 max-w-5xl mx-auto w-full">
        {slide.type === 'title' && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{dataset?.detected_domain} Domain Intelligence</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {slide.title}
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light">
              {slide.subtitle}
            </p>
            <div className="pt-8 flex items-center justify-center gap-8 text-xs text-slate-400 font-mono border-t border-slate-800/60 max-w-md mx-auto">
              <div>
                <span className="block text-slate-500 uppercase text-[10px]">Prepared By</span>
                <strong className="text-slate-200">{slide.author}</strong>
              </div>
              <div>
                <span className="block text-slate-500 uppercase text-[10px]">Date</span>
                <strong className="text-slate-200">{slide.date}</strong>
              </div>
            </div>
          </div>
        )}

        {slide.type === 'summary' && (
          <div className="space-y-6 max-w-3xl w-full animate-fade-in">
            <span className="text-xs text-brand-400 font-bold uppercase tracking-widest block">Executive Briefing</span>
            <h2 className="text-3xl font-black text-white">{slide.title}</h2>
            <div className="glass-3d-card p-8 rounded-3xl border border-slate-700/80 text-base text-slate-300 leading-relaxed space-y-4 shadow-2xl">
              <p>{slide.content}</p>
            </div>
          </div>
        )}

        {slide.type === 'kpis' && (
          <div className="space-y-8 max-w-4xl w-full animate-fade-in">
            <div>
              <span className="text-xs text-brand-400 font-bold uppercase tracking-widest block">Core Measurements</span>
              <h2 className="text-3xl font-black text-white">{slide.title}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {slide.kpis?.map((kpi, idx) => (
                <div key={idx} className="card-3d-interactive glass-3d-card p-6 rounded-3xl border border-slate-700/80 space-y-2 shadow-xl hover:border-cyan-500/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{kpi.display_name}</span>
                  <div className="text-4xl font-black text-white tracking-tight">{kpi.formatted_value}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{kpi.formula_explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.type === 'insights' && (
          <div className="space-y-8 max-w-4xl w-full animate-fade-in">
            <div>
              <span className="text-xs text-brand-400 font-bold uppercase tracking-widest block">Empirical Findings</span>
              <h2 className="text-3xl font-black text-white">{slide.title}</h2>
            </div>

            <div className="space-y-4">
              {slide.insights?.map((ins, idx) => (
                <div key={idx} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl shadow-xl">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white">{ins.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{ins.description}</p>
                    <p className="text-xs text-brand-300 font-medium pt-1">
                      <strong>Takeaway:</strong> {ins.why_it_matters}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.type === 'governance' && (
          <div className="space-y-8 max-w-4xl w-full animate-fade-in">
            <div>
              <span className="text-xs text-brand-400 font-bold uppercase tracking-widest block">Data Governance</span>
              <h2 className="text-3xl font-black text-white">{slide.title}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 text-center space-y-2 flex flex-col justify-center backdrop-blur-xl">
                <span className="text-xs font-bold uppercase text-slate-400">Data Health Score</span>
                <div className="text-5xl font-black text-emerald-400">{slide.healthScore}</div>
                <span className="text-xs text-slate-400">/ 100 Score</span>
              </div>

              <div className="md:col-span-2 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Detected Outliers</h4>
                {slide.anomalies?.length ? (
                  slide.anomalies.map((anom, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-white font-bold">
                        <span>{anom.column_name}</span>
                        <span className="text-rose-400 font-mono">{anom.anomaly_count} outliers</span>
                      </div>
                      <p className="text-slate-400">{anom.explanation}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                    Zero critical statistical anomalies detected.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {slide.type === 'takeaways' && (
          <div className="space-y-8 max-w-3xl w-full animate-fade-in">
            <div>
              <span className="text-xs text-brand-400 font-bold uppercase tracking-widest block">Action Plan</span>
              <h2 className="text-3xl font-black text-white">{slide.title}</h2>
            </div>

            <div className="space-y-3">
              {slide.items?.map((item, idx) => (
                <div key={idx} className="card-3d-interactive glass-3d-card p-5 rounded-2xl border border-slate-700/80 flex items-center gap-3 text-sm text-slate-200 shadow-md">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Slide Controller */}
      <div className="flex items-center justify-between px-8 py-5 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <button
          onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
          disabled={currentSlide === 0}
          className="btn-3d-secondary px-4 py-2 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold text-white flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Slide</span>
        </button>

        {/* Slide Progress Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all ${
                currentSlide === idx ? 'w-8 bg-brand-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1))}
          disabled={currentSlide === totalSlides - 1}
          className="btn-3d-primary px-5 py-2 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-brand-500/20"
        >
          <span>Next Slide</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
