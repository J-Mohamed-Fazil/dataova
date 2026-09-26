import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Award,
  TrendingUp,
  Users,
  ShieldAlert,
  GitBranch,
  Layers,
  Palette,
  CheckCircle2,
  ArrowRight,
  Bot,
  Zap,
  Activity,
  Lightbulb,
  Radio,
  BarChart3,
  Target,
  Sliders,
  DollarSign,
  PieChart,
  HelpCircle,
  Wand2
} from 'lucide-react';
import { Dataset, DashboardSheet } from '../../types';
import { api } from '../../services/api';

interface GenerateAIDashboardModalProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSheets: DashboardSheet[], message: string) => void;
}

interface PresetOption {
  id: string;
  category: 'executive' | 'growth' | 'operations' | 'relational';
  title: string;
  badge: string;
  badgeClass: string;
  desc: string;
  icon: any;
  suggestedPrompt: string;
  chartsPlanned: string[];
}

const PRESETS: PresetOption[] = [
  {
    id: 'executive',
    category: 'executive',
    title: 'Executive Pulse & KPI Synthesis',
    badge: 'Executive',
    badgeClass: 'badge-neon-blue',
    desc: 'Core volume metrics, Pareto drivers, longitudinal trajectory, and benchmark spreads.',
    icon: Award,
    suggestedPrompt: 'Executive leadership overview highlighting core drivers, momentum, and high-leverage opportunities.',
    chartsPlanned: ['Dual-Axis Primary Driver Composed', 'Macro Trajectory Area Gradient', 'Demographic Polar Radar Profile', 'Driver Dispersion Scatter Matrix']
  },
  {
    id: 'revenue_growth',
    category: 'growth',
    title: 'Revenue, Margin & Growth Intelligence',
    badge: 'Financials',
    badgeClass: 'badge-neon-emerald',
    desc: 'Dual-axis volume vs margins, chronological pacing, pricing elasticity, and territory splits.',
    icon: TrendingUp,
    suggestedPrompt: 'Contrasting volume scale against efficiency margins with growth pacing and territory contribution.',
    chartsPlanned: ['Revenue vs Margin Composed Dual-Axis', 'Territory Profitability Horizontal Bar', 'Chronological Growth Pacing Area', 'Pricing Elasticity Scatter', 'Revenue Portfolio Share Donut']
  },
  {
    id: 'customer_cohort',
    category: 'growth',
    title: 'Customer Cohort & Demographic Segmentation',
    badge: 'Demographics',
    badgeClass: 'badge-neon-purple',
    desc: 'Cohort distributions, frequency vs monetary scatter, and multi-entity radar profiles.',
    icon: Users,
    suggestedPrompt: 'Customer segmentation matrix analyzing cohort behavior, frequency concentration, and retention.',
    chartsPlanned: ['Cohort Proportional Area Treemap', 'Demographic Polar Radar Profile', 'RFM Value vs Frequency Scatter Matrix', 'Account Tier Density Horizontal Bar', 'Cohort Onboarding Velocity Area']
  },
  {
    id: 'operations_risk',
    category: 'operations',
    title: 'Operational Velocity & Risk Exposure',
    badge: 'Operations',
    badgeClass: 'badge-neon-amber',
    desc: 'Anomaly distributions, concentration exposure, peak spread variance, and cycle velocity.',
    icon: ShieldAlert,
    suggestedPrompt: 'Identify operational bottlenecks, concentration risk, and outlier deviations exceeding 2.5x standard deviations.',
    chartsPlanned: ['2D Operational Bottleneck Heatmap Matrix', 'Outlier Variance & Risk Tails Histogram', 'Operational Velocity Horizontal Bar', 'Concentration Risk Polar Radar', 'Chronological Volatility Spikes Line']
  },
  {
    id: 'profitability_frontier',
    category: 'executive',
    title: 'Unit Economics & Profitability Frontier',
    badge: 'Unit Economics',
    badgeClass: 'badge-neon-cyan',
    desc: 'Segment gross margin spreads, unit contribution rankings, and dynamic pricing leverage.',
    icon: DollarSign,
    suggestedPrompt: 'Analyze gross margin spreads across product tiers to locate highest-yield contribution cohorts.',
    chartsPlanned: ['Unit Contribution Margin Horizontal Ranking', 'Price vs Cost Yield Composed Spread', 'Break-Even Frontier Scatter Matrix', 'Gross Margin Velocity Area Gradient', 'Profit Contribution Share Donut']
  },
  {
    id: 'predictive_momentum',
    category: 'operations',
    title: 'Predictive Forecast & Longitudinal Momentum',
    badge: 'Forecast',
    badgeClass: 'badge-neon-pink',
    desc: 'Time-series momentum, velocity acceleration, run-rate projection, and cyclicality inflection.',
    icon: Activity,
    suggestedPrompt: 'Evaluate period-over-period run-rate velocity and project forward momentum with confidence bounds.',
    chartsPlanned: ['Longitudinal Momentum & ARIMA Forecast Area', 'Period-over-Period Velocity Pacing Bar', 'Cyclical Rhythm & Wave Seasonality Line', 'Velocity Acceleration vs Volume Scatter']
  },
  {
    id: 'comprehensive',
    category: 'relational',
    title: 'Universal Multi-Table Discovery',
    badge: 'All Tables',
    badgeClass: 'badge-neon-blue',
    desc: 'Exhaustively connects all relational spanning trees across every single and joined table.',
    icon: GitBranch,
    suggestedPrompt: 'Full automated synthesis across all relational tables, cross-joins, and dimensions.',
    chartsPlanned: ['Cross-Table Relational Entity Bridges', 'Universal Spanning Trees', 'Multi-Dimensional Categoricals', 'Correlation Scatters']
  }
];

const PALETTES = [
  { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'] },
  { id: 'emerald', name: 'Executive Emerald', colors: ['#10b981', '#059669', '#14b8a6', '#34d399'] },
  { id: 'corporate', name: 'Corporate Indigo', colors: ['#3b82f6', '#4f46e5', '#2563eb', '#6366f1'] },
  { id: 'sunset', name: 'Sunset Amber', colors: ['#f59e0b', '#ea580c', '#f97316', '#e11d48'] }
];

const SAMPLE_PROMPTS = [
  { text: 'Regional profit margins & delivery risk alerts', cat: 'Finance & Risk' },
  { text: 'Product category profitability matrix vs volume scale', cat: 'Margins' },
  { text: 'High-value customer retention & monetary velocity', cat: 'Cohorts' },
  { text: 'Quarterly sales growth trajectory with anomaly flags', cat: 'Growth' },
  { text: 'Operational bottleneck variance exceeding 2.5x mean', cat: 'Operations' }
];

export const GenerateAIDashboardModal: React.FC<GenerateAIDashboardModalProps> = ({
  dataset,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('executive');
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('all');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPalette, setSelectedPalette] = useState<string>('cyberpunk');
  const [mode, setMode] = useState<'add_sheet' | 'replace_all'>('replace_all');
  const [selectedMetricFocus, setSelectedMetricFocus] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract available columns for quick focus selection
  const availableColumns = dataset.tables?.[0]?.columns || [];
  const numericColumns = availableColumns.filter(c => c.data_type === 'numeric');
  const categoricalColumns = availableColumns.filter(c => c.data_type === 'categorical' || c.data_type === 'text');

  const filteredPresets = presetCategoryFilter === 'all'
    ? PRESETS
    : PRESETS.filter(p => p.category === presetCategoryFilter);

  const activePresetObj = PRESETS.find(p => p.id === selectedPreset) || PRESETS[0];

  const toggleMetricFocus = (colName: string) => {
    setSelectedMetricFocus(prev =>
      prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
    );
  };

  const handleApplySamplePrompt = (promptText: string) => {
    setCustomPrompt(promptText);
  };

  const handleEnhancePrompt = () => {
    if (!customPrompt.trim()) {
      setCustomPrompt(activePresetObj.suggestedPrompt);
      return;
    }
    const focusAdd = selectedMetricFocus.length > 0 ? ` with targeted focus on ${selectedMetricFocus.join(', ')}` : '';
    setCustomPrompt(`Synthesize executive business insights and multi-dimensional composed charts for: ${customPrompt.trim()}${focusAdd}. Highlight key Pareto drivers and risk exposure.`);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setProgressStep(1);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 600);

    try {
      const userTypedPrompt = customPrompt.trim();
      const combinedPrompt = userTypedPrompt
        ? (selectedMetricFocus.length > 0
            ? `${userTypedPrompt} [Focus metrics: ${selectedMetricFocus.join(', ')}]`.trim()
            : userTypedPrompt)
        : (selectedMetricFocus.length > 0 ? `Focus metrics: ${selectedMetricFocus.join(', ')}` : undefined);

      if (selectedPreset === 'comprehensive' && !customPrompt.trim()) {
        const regenerated = await api.generateAllDashboards(dataset.id);
        clearInterval(stepInterval);
        const totalNewCharts = regenerated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
        onSuccess(
          regenerated,
          `Synthesized all possible visualizations: ${totalNewCharts} charts across ${regenerated.length} sheets!`
        );
        onClose();
      } else {
        const regenerated = await api.aiGenerateDashboard(dataset.id, {
          prompt: combinedPrompt,
          preset: selectedPreset,
          palette: selectedPalette,
          mode
        });
        clearInterval(stepInterval);
        const totalNewCharts = regenerated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
        onSuccess(
          regenerated,
          `AI Dashboard synthesized successfully: ${totalNewCharts} tailored visualizations and executive business insights generated!`
        );
        onClose();
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Failed to generate AI dashboard:', err);
      setErrorMsg(err.message || 'Failed to synthesize AI dashboard. Please check backend connection.');
    } finally {
      setIsGenerating(false);
      setProgressStep(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-4 animate-fadeIn">
      <div className="glass-3d-card border border-indigo-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* Top Gradient Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 via-cyan-400 to-purple-500 shadow-md" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-cyan-500/20 to-blue-600/30 border border-indigo-400/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>AI Business Insight Studio & Dashboard Synthesis</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold">
                  Cognitive v3.0
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Synthesize dual-axis charts, area gradients, radar profiles, and data-backed business insights.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Generation Progress Display */}
          {isGenerating ? (
            <div className="p-10 text-center space-y-6 bg-slate-950/70 border border-cyan-500/30 rounded-2xl animate-fadeIn">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
                <div className="w-20 h-20 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Bot className="w-9 h-9 text-cyan-300" />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-white tracking-tight">
                  Synthesizing Business Insights & Visualizations...
                </h4>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  {progressStep === 1 && 'Scanning multi-table relational schema and mapping semantic roles...'}
                  {progressStep === 2 && 'Executing Pareto distribution analysis, moment estimates, and anomaly flags...'}
                  {progressStep === 3 && 'Constructing dual-axis composed charts, area gradients, and radar profiles...'}
                  {progressStep >= 4 && 'Deducing executive business questions, recommendations, and confidence benchmarks...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800 shadow-inner">
                <div
                  className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, progressStep * 25)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Error Alert Banner */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    onClick={() => setErrorMsg(null)}
                    className="text-rose-400 hover:text-white p-1 rounded transition text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Archetype Filter Tabs & Preset Selection */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Choose Analytical Archetype & Insight Focus</span>
                  </label>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                    {[
                      { id: 'all', label: 'All Presets' },
                      { id: 'executive', label: 'Executive' },
                      { id: 'growth', label: 'Growth' },
                      { id: 'operations', label: 'Operations' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPresetCategoryFilter(tab.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                          presetCategoryFilter === tab.id
                            ? 'bg-indigo-600/40 text-white border border-indigo-500/50 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPresets.map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPreset(p.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2.5 group ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-blue-950/70 border-indigo-400 text-white ring-1 ring-indigo-400/50 shadow-xl shadow-indigo-950/50'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`p-2 rounded-xl border ${isSelected ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300' : 'bg-slate-800/80 border-slate-700 text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.badgeClass}`}>
                              {p.badge}
                            </span>
                          </div>
                          <h4 className="font-black text-xs text-white group-hover:text-indigo-200 transition-colors">
                            {p.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-snug mt-1">{p.desc}</p>
                        </div>

                        {isSelected && (
                          <div className="pt-2 border-t border-indigo-500/20 flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Active Selection</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Metric / Column Spotlight Selector */}
              {(numericColumns.length > 0 || categoricalColumns.length > 0) && (
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Spotlight Specific Metrics & Dimensions (Optional)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {selectedMetricFocus.length > 0 ? `${selectedMetricFocus.length} selected` : 'Auto-synthesizes all columns'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {numericColumns.slice(0, 6).map(col => {
                      const colName = col.column_name;
                      const isChosen = selectedMetricFocus.includes(colName);
                      return (
                        <button
                          key={colName}
                          type="button"
                          onClick={() => toggleMetricFocus(colName)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-semibold transition border ${
                            isChosen
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          # {colName}
                        </button>
                      );
                    })}
                    {categoricalColumns.slice(0, 4).map(col => {
                      const colName = col.column_name;
                      const isChosen = selectedMetricFocus.includes(colName);
                      return (
                        <button
                          key={colName}
                          type="button"
                          onClick={() => toggleMetricFocus(colName)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-semibold transition border ${
                            isChosen
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          @ {colName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Natural Language Prompt Input */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Custom Intent or Strategic Prompt (Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>AI Enhance Prompt</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="e.g. Highlight regional profit margin spreads, identify high-volume transaction outliers, and evaluate 6-month growth velocity..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/90 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 shadow-inner resize-none"
                  />
                </div>

                {/* Prompt Suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick Prompts:</span>
                  {SAMPLE_PROMPTS.map((promptItem, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplySamplePrompt(promptItem.text)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-cyan-300 transition flex items-center gap-1.5"
                    >
                      <span className="text-[9px] text-indigo-400 font-mono font-bold">[{promptItem.cat}]</span>
                      <span>+ {promptItem.text}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Synthesis Scope Preview Box */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Synthesis Scope Blueprint: {activePresetObj.title}</span>
                  </h5>
                  <span className="text-[10px] text-cyan-300 font-mono font-semibold">
                    {dataset.tables?.length || 1} Table(s) • Ready for Synthesis
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Planned Visualizations:</span>
                    <ul className="space-y-0.5 list-disc list-inside text-slate-300">
                      {activePresetObj.chartsPlanned.map((chartName, i) => (
                        <li key={i} className="text-[11px] text-slate-300">{chartName}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Executive Insights Module:</span>
                    <p className="text-[11px] text-slate-300">
                      Synthesizes 4-6 quantitative findings answering driver contribution, risk tails, efficiency margins, and strategic next steps.
                    </p>
                  </div>
                </div>
              </div>

              {/* Theme Palette & Sheet Mode Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                {/* Visual Palette */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    <span>Visual Palette & Styling</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PALETTES.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setSelectedPalette(pal.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          selectedPalette === pal.id
                            ? 'bg-indigo-950/50 border-indigo-400 text-white ring-1 ring-indigo-400/40'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-medium">{pal.name}</span>
                        <div className="flex items-center gap-1">
                          {pal.colors.map((c, i) => (
                            <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generation Scope */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dashboard Destination Scope</span>
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setMode('add_sheet')}
                      className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                        mode === 'add_sheet'
                          ? 'bg-indigo-950/50 border-indigo-400 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">Add as New Analytical Sheet</div>
                        <div className="text-[10px] text-slate-400">Preserves existing sheets and appends new synthesis</div>
                      </div>
                      {mode === 'add_sheet' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('replace_all')}
                      className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                        mode === 'replace_all'
                          ? 'bg-purple-950/50 border-purple-400 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">Regenerate Entire Dashboard Workspace</div>
                        <div className="text-[10px] text-slate-400">Overwrites and rebuilds workspace from scratch</div>
                      </div>
                      {mode === 'replace_all' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-3d-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>{isGenerating ? 'Synthesizing Dashboard...' : 'Synthesize AI Dashboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
