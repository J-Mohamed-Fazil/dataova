import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Layers,
  Zap,
  Check,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Plus,
  RefreshCw,
  Activity,
  Award,
  ArrowUpRight,
  Target,
  Database,
  Hash,
  Share2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { api } from '../../services/api';
import { ReportChartItem, ReportSection, ReportDocument } from '../../types';

interface AIBusinessChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string;
  datasetName: string;
  domain?: string;
  sections?: ReportSection[];
  onChartInjected?: (updatedReport: ReportDocument) => void;
}

const PALETTES = [
  '#06b6d4', '#6366f1', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6',
];

const PRESETS = [
  {
    id: 'pareto',
    name: 'Pareto 80/20 Driver Concentration',
    desc: 'Uncovers top commercial drivers commanding 80% of activity or revenue.',
    icon: BarChart3,
    color: 'from-cyan-500/20 via-indigo-500/10 to-transparent text-cyan-300 border-cyan-500/40',
    tag: 'Core Driver',
    stat: '80/20 Rule'
  },
  {
    id: 'velocity',
    name: 'Longitudinal Growth Velocity',
    desc: 'Tracks period-over-period acceleration, run-rate pacing, and peak periods.',
    icon: TrendingUp,
    color: 'from-sky-500/20 via-blue-500/10 to-transparent text-sky-300 border-sky-500/40',
    tag: 'Momentum',
    stat: 'Trajectory'
  },
  {
    id: 'tiers',
    name: 'Value Tier & Cohort Segmentation',
    desc: 'Splits records into High-Value (VIP), Mid-Tier, and Long-Tail volume clusters.',
    icon: Layers,
    color: 'from-purple-500/20 via-pink-500/10 to-transparent text-purple-300 border-purple-500/40',
    tag: 'Segmentation',
    stat: 'Quartiles'
  },
  {
    id: 'efficiency',
    name: 'Operational Unit Economics',
    desc: 'Benchmarks average transaction size and productivity across segments.',
    icon: Zap,
    color: 'from-amber-500/20 via-orange-500/10 to-transparent text-amber-300 border-amber-500/40',
    tag: 'Unit Economics',
    stat: 'Efficiency'
  },
  {
    id: 'actions',
    name: 'Strategic Implementation ROI',
    desc: 'Maps prioritized business recommendations by urgency and value impact score.',
    icon: Award,
    color: 'from-emerald-500/20 via-teal-500/10 to-transparent text-emerald-300 border-emerald-500/40',
    tag: 'Value Realization',
    stat: 'ROI Matrix'
  }
];

const PROMPT_SUGGESTIONS = [
  'Top revenue drivers by category with share %',
  'Monthly transaction velocity & seasonal spikes',
  'Segment distribution of high-value accounts',
  'Compare average ticket size across departments',
  'Analyze commercial concentration & top 20% contributors'
];

export const AIBusinessChartModal: React.FC<AIBusinessChartModalProps> = ({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  domain = 'Business Intelligence',
  sections = [],
  onChartInjected
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('pareto');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedCharts, setGeneratedCharts] = useState<ReportChartItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [displayType, setDisplayType] = useState<'bar' | 'pie' | 'area'>('bar');

  // Trigger initial generation when modal opens
  useEffect(() => {
    if (isOpen && generatedCharts.length === 0) {
      handleGenerateSuite('pareto', '');
    }
  }, [isOpen]);

  useEffect(() => {
    if (sections && sections.length > 0 && !targetSectionId) {
      const pref = sections.find(s => s.section_type === 'insights' || s.section_type === 'executive_summary') || sections[0];
      if (pref) setTargetSectionId(pref.id);
    }
  }, [sections]);

  if (!isOpen) return null;

  const handleGenerateSuite = async (cat?: string, promptOverride?: string) => {
    setIsGenerating(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const payload: any = {};
      const catToUse = cat !== undefined ? cat : activeCategory;
      const promptToUse = promptOverride !== undefined ? promptOverride : customPrompt;

      if (promptToUse && promptToUse.trim()) {
        payload.prompt = promptToUse.trim();
      } else if (catToUse && catToUse !== 'custom') {
        payload.chart_category = catToUse;
      }

      const res = await api.generateBusinessCharts(datasetId, payload);
      if (res && res.charts && res.charts.length > 0) {
        setGeneratedCharts(res.charts);
        setSelectedIndex(0);
        const firstType = res.charts[0].chart_type || 'bar';
        if (firstType === 'line' || firstType === 'area') setDisplayType('area');
        else if (firstType === 'pie') setDisplayType('pie');
        else setDisplayType('bar');
      } else {
        setErrorMessage('No quantitative chart could be computed for this dataset. Please select another blueprint or question.');
      }
    } catch (err: any) {
      console.error('Failed to generate AI business charts:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Failed to synthesize business charts.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setActiveCategory(presetId);
    setCustomPrompt('');
    handleGenerateSuite(presetId, '');
  };

  const handleGenerateClick = () => {
    if (customPrompt.trim()) {
      handleGenerateSuite('custom', customPrompt.trim());
    } else {
      handleGenerateSuite(activeCategory, '');
    }
  };

  const handleInjectChart = async () => {
    const curChart = generatedCharts[selectedIndex];
    if (!curChart) return;

    setIsInjecting(true);
    try {
      const updated = await api.injectBusinessChart(datasetId, {
        section_id: targetSectionId || undefined,
        chart: {
          ...curChart,
          chart_type: displayType === 'pie' ? 'pie' : displayType === 'area' ? 'area' : 'bar'
        }
      });
      if (onChartInjected) {
        onChartInjected(updated);
      }
      setSuccessMessage('Chart injected directly into executive report!');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to inject chart:', err);
      alert('Failed to add chart to report.');
    } finally {
      setIsInjecting(false);
    }
  };

  const curChart = generatedCharts[selectedIndex];
  const chartData = curChart?.data || [];

  // Summary Metrics calculations
  const totalVolume = chartData.reduce((acc, curr) => acc + (typeof curr.value === 'number' ? curr.value : 0), 0);
  const formattedVolume = totalVolume >= 1_000_000
    ? `$${(totalVolume / 1_000_000).toFixed(1)}M`
    : totalVolume >= 1_000
    ? totalVolume.toLocaleString()
    : totalVolume.toFixed(1);

  // Custom Glassmorphic Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const val = typeof d.value === 'number' ? d.value : payload[0].value;
      const formattedVal = typeof val === 'number'
        ? (val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(2)}M` : val >= 1_000 ? val.toLocaleString() : val.toFixed(2))
        : val;
      return (
        <div className="bg-[#090F24]/95 border border-cyan-500/40 p-3 rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.85)] backdrop-blur-sm text-xs space-y-1.5 z-50 min-w-[160px] pointer-events-none select-none">
          <div className="font-extrabold text-white flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span className="truncate">{d.label}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Value / Vol:</span>
            <span className="font-mono font-bold text-cyan-300">{formattedVal}</span>
          </div>
          {d.share_pct !== undefined && (
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Portfolio Share:</span>
              <span className="font-mono font-bold text-amber-300">{d.share_pct}%</span>
            </div>
          )}
          {d.cumulative_share !== undefined && (
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cumulative:</span>
              <span className="font-mono text-purple-300">{d.cumulative_share}%</span>
            </div>
          )}
          {d.avg_ticket !== undefined && (
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Ticket Size:</span>
              <span className="font-mono text-emerald-300">{d.avg_ticket}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-sm animate-fadeIn" style={{ willChange: 'opacity' }}>
      <div className="relative w-full max-w-6xl bg-gradient-to-b from-[#0B132B]/98 via-[#080D1D]/98 to-[#050814]/98 border border-cyan-500/30 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col max-h-[94vh]" style={{ transform: 'translateZ(0)' }}>
        
        {/* Animated Cyber Ambient Highlight Bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 via-indigo-400 to-transparent animate-pulse" />

        {/* Modal Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#0B1226]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 via-indigo-500/20 to-purple-500/25 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)] shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 truncate">
                  <span>AI Business Chart Studio</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                  {domain}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700/70 truncate max-w-[200px] flex items-center gap-1">
                  <Database className="w-3 h-3 text-slate-400" />
                  {datasetName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Domain-grounded business visualizations, Pareto driver analyses, and quantitative action directives.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/90 transition-all duration-200 border border-transparent hover:border-slate-700 hover:scale-105"
            title="Close Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split into Left Blueprint Controls & Right Visual Canvas */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Panel: Preset Selectors & Custom Prompt Input */}
          <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#070D1E]/95 p-4 sm:p-5 overflow-y-auto space-y-4 shrink-0 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Select Business Blueprint
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">5 Algorithmic Models</span>
                </label>
                <div className="space-y-2">
                  {PRESETS.map((p) => {
                    const Icon = p.icon;
                    const isActive = activeCategory === p.id && !customPrompt.trim();
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPreset(p.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group relative ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-950/50 via-indigo-950/40 to-slate-900/60 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.18)] ring-1 ring-cyan-400/40'
                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80 hover:translate-x-0.5'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r" />
                        )}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                              isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400 group-hover:text-white'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                              {p.name}
                            </span>
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                            isActive ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {p.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight pl-8">
                          {p.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Business Prompt Box */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Or Ask AI for Custom Chart
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">Natural Language</span>
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., Top product revenue by city or monthly order velocity..."
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition pr-7"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerateClick();
                      }
                    }}
                  />
                  {customPrompt && (
                    <button
                      onClick={() => setCustomPrompt('')}
                      className="absolute right-2 top-2 p-1 text-slate-500 hover:text-white rounded-md transition"
                      title="Clear Prompt"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Suggestions Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>Quick Suggestions</span>
                    <span className="font-mono">Press ↵ to run</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.slice(0, 3).map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => {
                          setCustomPrompt(sug);
                          handleGenerateSuite('custom', sug);
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-slate-800/80 transition flex items-center gap-1 text-left"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        <span className="truncate max-w-[200px]">{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Synthesize Action Button */}
            <div className="pt-3 border-t border-slate-800/80">
              <button
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="w-full btn-3d-cyan py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.25)] disabled:opacity-50 transition active:scale-[0.98]"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Quantitative Chart...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI Business Chart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Live Executive Visual Chart Canvas */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-[#070E20]/50 space-y-4">
            
            {/* Generated Chart Tabs & View Switcher (when charts exist) */}
            {generatedCharts.length > 0 && !isGenerating && (
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {generatedCharts.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedIndex(idx);
                        const t = ch.chart_type || 'bar';
                        if (t === 'line' || t === 'area') setDisplayType('area');
                        else if (t === 'pie') setDisplayType('pie');
                        else setDisplayType('bar');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                        selectedIndex === idx
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                          : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="truncate max-w-[170px]">{ch.title.split(':')[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Display Type Switcher Controls */}
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setDisplayType('bar')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      displayType === 'bar' ? 'bg-cyan-500/30 text-cyan-200 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Bar Visualization"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="text-[11px] hidden sm:inline">Bar</span>
                  </button>
                  <button
                    onClick={() => setDisplayType('pie')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      displayType === 'pie' ? 'bg-cyan-500/30 text-cyan-200 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Donut / Contribution %"
                  >
                    <PieChartIcon className="w-3.5 h-3.5" />
                    <span className="text-[11px] hidden sm:inline">Donut %</span>
                  </button>
                  <button
                    onClick={() => setDisplayType('area')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      displayType === 'area' ? 'bg-cyan-500/30 text-cyan-200 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Area / Trendline"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[11px] hidden sm:inline">Trendline</span>
                  </button>
                </div>
              </div>
            )}

            {/* Visual Chart Card */}
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-6 min-h-[360px] bg-slate-900/20 rounded-2xl border border-slate-800/80">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-sm -z-10 animate-pulse" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <h4 className="text-sm font-bold text-white tracking-tight">Synthesizing Business Intelligence...</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Querying multi-table fact store, ranking Pareto driver concentrations, and distilling strategic takeaways.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            ) : errorMessage ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[340px] bg-slate-900/40 rounded-2xl border border-rose-500/30">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h4 className="text-sm font-bold text-white">Chart Generation Notice</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => handleGenerateSuite('pareto', '')}
                    className="btn-3d-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate Pareto Drivers</span>
                  </button>
                  <button
                    onClick={() => handleGenerateSuite('tiers', '')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    Try Value Tier Segments
                  </button>
                </div>
              </div>
            ) : curChart ? (
              <div className="space-y-4">
                
                {/* Hero Summary KPI Ribbon */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Key Highlight</span>
                      <span className="text-xs font-extrabold text-amber-300 truncate block">
                        {curChart.metric_highlight || 'Driver Analysis'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Aggregated Volume</span>
                      <span className="text-xs font-extrabold text-white truncate block">
                        {formattedVolume}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Observed Clusters</span>
                      <span className="text-xs font-extrabold text-indigo-200 truncate block">
                        {chartData.length} Data Segments
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Information */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {curChart.chart_type?.toUpperCase() || 'BUSINESS CHART'}
                      </span>
                      {curChart.metric_highlight && (
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {curChart.metric_highlight}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-extrabold text-white mt-1.5 tracking-tight truncate">
                      {curChart.title}
                    </h4>
                    {curChart.subtitle && (
                      <p className="text-xs text-slate-400 mt-0.5">{curChart.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Recharts Canvas */}
                <div className="w-full h-72 p-4 rounded-2xl bg-[#090F23] border border-slate-800/90 shadow-inner flex flex-col justify-center">
                  {chartData.length === 0 ? (
                    <div className="text-xs text-slate-500 italic text-center">No data points available</div>
                  ) : displayType === 'pie' ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-full">
                      <div className="w-48 h-48 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              isAnimationActive={false}
                            >
                              {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PALETTES[index % PALETTES.length]} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend with Share % */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 text-xs w-full max-w-xs">
                        {chartData.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-slate-300 p-1 rounded-lg hover:bg-slate-900/50 transition">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTES[i % PALETTES.length] }} />
                              <span className="truncate max-w-[140px] font-medium">{d.label}</span>
                            </div>
                            <span className="font-mono font-bold text-white shrink-0">
                              {d.share_pct !== undefined ? `${d.share_pct}%` : d.value?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : displayType === 'area' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 15, right: 25, left: 15, bottom: 25 }}>
                        <defs>
                          <linearGradient id="ai-chart-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} width={45} tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} fill="url(#ai-chart-gradient)" dot={{ fill: '#06b6d4', r: 3 }} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 15, right: 25, left: 15, bottom: 25 }}>
                        <defs>
                          <linearGradient id="ai-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} width={45} tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#ai-bar-gradient)" isAnimationActive={false}>
                          {chartData.map((_, index) => (
                            <Cell key={`bar-${index}`} fill={PALETTES[index % PALETTES.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Strategic Executive Takeaway Callout */}
                {curChart.insight && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/20 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                      <h6 className="font-bold text-xs text-white tracking-tight flex items-center gap-2">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/30">
                          Strategic Takeaway
                        </span>
                        <span>{curChart.insight.headline}</span>
                      </h6>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-6">
                      {curChart.insight.description}
                    </p>
                    {curChart.insight.impact && (
                      <div className="pl-6 pt-1 text-[11px] text-cyan-300 font-medium flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Action Directive: {curChart.insight.impact}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Inject into Report Section Controls */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-semibold text-slate-300 shrink-0">Inject into Section:</span>
                    <select
                      value={targetSectionId}
                      onChange={(e) => setTargetSectionId(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 truncate max-w-xs"
                    >
                      {sections.map((sec, idx) => (
                        <option key={sec.id} value={sec.id}>
                          {idx + 1}. {sec.title.split('•')[0].trim()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {successMessage && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-fadeIn">
                        <Check className="w-3.5 h-3.5" />
                        {successMessage}
                      </span>
                    )}
                    <button
                      onClick={handleInjectChart}
                      disabled={isInjecting}
                      className="btn-3d-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isInjecting ? 'Adding...' : 'Add Chart to Report'}</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              /* State-of-the-Art Blueprint Matrix (Welcome / Fallback) */
              <div className="flex-1 flex flex-col justify-center p-4 sm:p-6 space-y-5 bg-slate-900/20 rounded-2xl border border-slate-800/80">
                <div className="text-center space-y-1.5 max-w-md mx-auto">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Executive Intelligence Blueprints</span>
                  </div>
                  <h4 className="text-base font-extrabold text-white">Select a Business Blueprint to Synthesize</h4>
                  <p className="text-xs text-slate-400">
                    Pre-configured domain algorithms calculate commercial concentration, run-rate velocity, and unit economics on your data.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    onClick={() => handleGenerateSuite('pareto', '')}
                    className="p-4 rounded-xl text-left bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-900/40 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        80/20 DRIVERS
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 transition">Pareto Driver Concentration</h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Reveals the top commercial segments commanding 80% of aggregate volume or revenue.
                    </p>
                  </button>

                  <button
                    onClick={() => handleGenerateSuite('velocity', '')}
                    className="p-4 rounded-xl text-left bg-gradient-to-br from-sky-950/30 via-slate-900/60 to-slate-900/40 border border-sky-500/30 hover:border-sky-400 hover:shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        MOMENTUM
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white group-hover:text-sky-300 transition">Longitudinal Growth Velocity</h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Tracks period-over-period run-rate acceleration, trajectory shifts, and seasonal volume.
                    </p>
                  </button>

                  <button
                    onClick={() => handleGenerateSuite('tiers', '')}
                    className="p-4 rounded-xl text-left bg-gradient-to-br from-purple-950/30 via-slate-900/60 to-slate-900/40 border border-purple-500/30 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        COHORT TIERS
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white group-hover:text-purple-300 transition">Value Tier Segmentation</h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Splits records into High-Value VIP, Mid-Tier, and Long-Tail volume clusters.
                    </p>
                  </button>

                  <button
                    onClick={() => handleGenerateSuite('efficiency', '')}
                    className="p-4 rounded-xl text-left bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-900/40 border border-amber-500/30 hover:border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PRODUCTIVITY
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white group-hover:text-amber-300 transition">Operational Unit Economics</h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Benchmarks transaction productivity and average ticket size against dataset averages.
                    </p>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
