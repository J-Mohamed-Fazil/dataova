import React, { useState, useEffect, useMemo } from 'react';
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
  Target,
  Wand2,
  RefreshCw,
  Database,
  Cpu,
  DollarSign
} from 'lucide-react';
import { Dataset, DashboardSheet, AIDynamicArchetype, AIDiscoveredArchetypesResponse } from '../../types';
import { api } from '../../services/api';

interface GenerateAIDashboardModalProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSheets: DashboardSheet[], message: string) => void;
}

const PALETTES = [
  { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'] },
  { id: 'emerald', name: 'Executive Emerald', colors: ['#10b981', '#059669', '#14b8a6', '#34d399'] },
  { id: 'corporate', name: 'Corporate Indigo', colors: ['#3b82f6', '#4f46e5', '#2563eb', '#6366f1'] },
  { id: 'sunset', name: 'Sunset Amber', colors: ['#f59e0b', '#ea580c', '#f97316', '#e11d48'] }
];

const getArchetypeIcon = (iconType?: string, id?: string) => {
  switch (iconType) {
    case 'Award': return Award;
    case 'TrendingUp': return TrendingUp;
    case 'ShieldAlert': return ShieldAlert;
    case 'Activity': return Activity;
    case 'DollarSign': return DollarSign;
    case 'Users': return Users;
    case 'GitBranch': return GitBranch;
    case 'Zap': return Zap;
    case 'Target': return Target;
    case 'Layers': return Layers;
    default:
      if (id?.includes('scale')) return Award;
      if (id?.includes('frontier') || id?.includes('efficiency')) return TrendingUp;
      if (id?.includes('risk') || id?.includes('variance')) return ShieldAlert;
      if (id?.includes('momentum') || id?.includes('forecast')) return Activity;
      if (id?.includes('cohort')) return Users;
      if (id?.includes('economics')) return DollarSign;
      return Sparkles;
  }
};

export const GenerateAIDashboardModal: React.FC<GenerateAIDashboardModalProps> = ({
  dataset,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [discoveredData, setDiscoveredData] = useState<AIDiscoveredArchetypesResponse | null>(null);
  const [isLoadingArchetypes, setIsLoadingArchetypes] = useState<boolean>(true);
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>('auto');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPalette, setSelectedPalette] = useState<string>('cyberpunk');
  const [mode, setMode] = useState<'add_sheet' | 'replace_all'>('replace_all');
  const [selectedMetricFocus, setSelectedMetricFocus] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Discover dynamic archetypes directly from the dataset
  const fetchArchetypes = () => {
    if (!dataset.id) return;
    setIsLoadingArchetypes(true);
    api.getAIDiscoveredArchetypes(dataset.id)
      .then((data) => {
        setDiscoveredData(data);
        if (data.recommended_archetype_id) {
          setSelectedArchetypeId(data.recommended_archetype_id);
        } else if (data.archetypes && data.archetypes.length > 0) {
          setSelectedArchetypeId(data.archetypes[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not discover dynamic archetypes:', err);
      })
      .finally(() => {
        setIsLoadingArchetypes(false);
      });
  };

  useEffect(() => {
    if (isOpen && dataset.id) {
      fetchArchetypes();
    }
  }, [isOpen, dataset.id]);

  // Extract available columns for quick focus selection
  const availableColumns = dataset.tables?.[0]?.columns || [];
  const numericColumns = availableColumns.filter(c => c.data_type === 'numeric');
  const categoricalColumns = availableColumns.filter(c => c.data_type === 'categorical' || c.data_type === 'text');

  const archetypes = discoveredData?.archetypes || [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(archetypes.map(a => a.category).filter(Boolean)));
    return ['all', ...cats];
  }, [archetypes]);

  const filteredArchetypes = categoryFilter === 'all'
    ? archetypes
    : archetypes.filter(a => a.category === categoryFilter);

  const activeArchetype = archetypes.find(a => a.id === selectedArchetypeId) || archetypes[0] || null;

  // Dynamically generate sample prompts tailored strictly to this dataset's columns
  const dynamicSamplePrompts = useMemo(() => {
    const prompts = [];
    const pNum = numericColumns[0]?.column_name;
    const sNum = numericColumns[1]?.column_name;
    const pCat = categoricalColumns[0]?.column_name;
    const sCat = categoricalColumns[1]?.column_name;

    if (pNum && pCat) {
      prompts.push({
        text: `Analyze ${pNum.replace('_', ' ')} scale & driver concentration across ${pCat.replace('_', ' ')}`,
        cat: 'Scale Driver'
      });
    }
    if (pNum && sNum) {
      prompts.push({
        text: `Examine efficiency trade-offs and non-linear yield between ${pNum.replace('_', ' ')} and ${sNum.replace('_', ' ')}`,
        cat: 'Frontier'
      });
    }
    if (pNum) {
      prompts.push({
        text: `Isolate statistical variance anomalies and risk tails exceeding 2.0x standard deviations in ${pNum.replace('_', ' ')}`,
        cat: 'Anomaly Risk'
      });
    }
    if (pCat && sCat) {
      prompts.push({
        text: `Map cross-dimensional cohort clustering across ${pCat.replace('_', ' ')} and ${sCat.replace('_', ' ')}`,
        cat: 'Demographics'
      });
    }
    prompts.push({
      text: 'Synthesize all possible charts across all tables, connecting all relational foreign keys and single-table dimensions',
      cat: 'All Dashboards'
    });
    return prompts.slice(0, 5);
  }, [numericColumns, categoricalColumns]);

  if (!isOpen) return null;

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
      if (activeArchetype?.suggested_prompt) {
        setCustomPrompt(activeArchetype.suggested_prompt);
      }
      return;
    }
    const focusAdd = selectedMetricFocus.length > 0 ? ` with targeted focus on ${selectedMetricFocus.join(', ')}` : '';
    setCustomPrompt(`Synthesize executive data-backed insights and multi-dimensional composed charts for: ${customPrompt.trim()}${focusAdd}. Highlight key drivers and variance bottlenecks.`);
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setProgressStep(1);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 600);

    try {
      const regenerated = await api.generateAllDashboards(dataset.id);
      clearInterval(stepInterval);
      const totalNewCharts = regenerated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
      onSuccess(
        regenerated,
        `All Dashboards synthesized: ${totalNewCharts} exhaustive visualizations generated across ${regenerated.length} sheets connecting all tables!`
      );
      onClose();
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Failed to generate all dashboards:', err);
      setErrorMsg(err.message || 'Failed to synthesize all dashboards. Please check backend connection.');
    } finally {
      setIsGenerating(false);
      setProgressStep(0);
    }
  };

  const handleGenerate = async () => {
    const targetPreset = selectedArchetypeId || 'auto';
    if (targetPreset === 'all' || targetPreset === 'all_dashboards') {
      return handleGenerateAll();
    }

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

      const regenerated = await api.aiGenerateDashboard(dataset.id, {
        prompt: combinedPrompt,
        preset: targetPreset,
        palette: selectedPalette,
        mode
      });
      clearInterval(stepInterval);
      const totalNewCharts = regenerated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
      onSuccess(
        regenerated,
        `AI Dashboard synthesized successfully: ${totalNewCharts} tailored visualizations and data-backed business insights generated!`
      );
      onClose();
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
                {discoveredData?.domain && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    <span>{discoveredData.domain}</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Zero pre-built templates. The AI examines your columns, data types, and distributions to synthesize data-native archetypes.
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

              {/* AI Dataset Intelligence Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-950/90 via-indigo-950/40 to-slate-950/90 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                    <Database className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide">
                        AI Data Intelligence for <strong className="text-cyan-300">{dataset.name}</strong>
                      </span>
                      {discoveredData && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          {discoveredData.domain}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {discoveredData?.summary || 'Scanning columns and data types...'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchArchetypes}
                  disabled={isLoadingArchetypes}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 text-[10px] text-slate-300 hover:text-cyan-300 transition flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingArchetypes ? 'animate-spin' : ''}`} />
                  <span>Re-scan Data</span>
                </button>
              </div>

              {/* Generate All Dashboards Feature Callout */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-slate-950/70 border border-purple-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                    <Layers className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide">
                        Generate All Dashboards & Connected Tables
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                        ALL POSSIBLE CHARTS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Synthesizes all possible charts across your data—connecting all {dataset.tables?.length || 1} table(s), foreign key joins, single-table metrics, temporal trajectories, and multi-dimensional insights.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAll}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25 border border-purple-400/40 shrink-0 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  title="Generate all possible charts across all tables and relational connections"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-200" />
                  <span>Generate All Dashboards</span>
                </button>
              </div>

              {/* AI Discovered Dynamic Archetypes Selection */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>AI-Generated Archetypes for this Data</span>
                  </label>

                  {/* Dynamic Category Filter Tabs */}
                  {categories.length > 2 && (
                    <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition capitalize ${
                            categoryFilter === cat
                              ? 'bg-indigo-600/40 text-white border border-indigo-500/50 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat === 'all' ? 'All Archetypes' : cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isLoadingArchetypes ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 animate-pulse space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-slate-800" />
                          <div className="w-16 h-4 rounded bg-slate-800" />
                        </div>
                        <div className="w-3/4 h-3.5 rounded bg-slate-800" />
                        <div className="w-full h-10 rounded bg-slate-900" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredArchetypes.map((arch) => {
                      const Icon = getArchetypeIcon(arch.icon_type, arch.id);
                      const isSelected = selectedArchetypeId === arch.id;
                      return (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => setSelectedArchetypeId(arch.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2.5 group relative ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-blue-950/80 border-indigo-400 text-white ring-1 ring-indigo-400/50 shadow-xl shadow-indigo-950/50'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          {arch.recommended && (
                            <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-[9px] font-black tracking-wide border border-cyan-300/40 shadow-sm flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-cyan-200" />
                              <span>AI Recommended</span>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className={`p-2 rounded-xl border ${isSelected ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300' : 'bg-slate-800/80 border-slate-700 text-slate-400'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${arch.badge_class || 'badge-neon-blue'}`}>
                                {arch.badge}
                              </span>
                            </div>
                            <h4 className="font-black text-xs text-white group-hover:text-indigo-200 transition-colors">
                              {arch.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-snug mt-1">{arch.desc}</p>
                          </div>

                          {isSelected ? (
                            <div className="pt-2 border-t border-indigo-500/20 flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Active Archetype</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 pt-1">
                              {arch.charts_planned?.length || 4} charts planned
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                    placeholder="e.g. Highlight primary drivers, identify statistical outliers exceeding 2x standard deviations, and synthesize forward momentum..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/90 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 shadow-inner resize-none"
                  />
                </div>

                {/* Prompt Suggestions */}
                {dynamicSamplePrompts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Data-Tailored Prompts:</span>
                    {dynamicSamplePrompts.map((promptItem, idx) => (
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
                )}
              </div>

              {/* Synthesis Scope Preview Box */}
              {activeArchetype && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Synthesis Scope Blueprint: {activeArchetype.title}</span>
                    </h5>
                    <span className="text-[10px] text-cyan-300 font-mono font-semibold">
                      {dataset.tables?.length || 1} Table(s) • Grounded in {activeArchetype.target_table}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Planned Visualizations:</span>
                      <ul className="space-y-0.5 list-disc list-inside text-slate-300">
                        {activeArchetype.charts_planned?.map((chartName, i) => (
                          <li key={i} className="text-[11px] text-slate-300">{chartName}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Data-Backed Business Insights:</span>
                      <p className="text-[11px] text-slate-300">
                        Synthesizes quantitative findings addressing driver concentration, efficiency trade-off frontiers, and statistical variance tailored to this dataset.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
        <div className="px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={isGenerating || isLoadingArchetypes}
              className="px-4 py-2.5 rounded-xl text-purple-200 hover:text-white bg-purple-950/60 hover:bg-purple-900/70 border border-purple-500/40 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98]"
              title="Exhaustively generate all possible charts and connect all tables"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Generate All Dashboards</span>
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isLoadingArchetypes}
              className="btn-3d-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>{isGenerating ? 'Synthesizing Dashboard...' : 'Synthesize AI Dashboard'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
