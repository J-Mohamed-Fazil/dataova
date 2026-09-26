import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  GitBranch,
  Layers,
  Table as TableIcon,
  Plus,
  Play,
  CheckCircle2,
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  Compass,
  ArrowRight,
  Database,
  Palette,
  TrendingUp,
  Cpu,
  RefreshCw,
  Send,
  Eye,
  Sliders,
  Award,
  Brain,
  Zap,
  Activity,
  Lightbulb,
  Target,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Grid,
  LayoutGrid
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as ReLineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Treemap
} from 'recharts';
import { api } from '../../services/api';
import {
  Dataset,
  DashboardSheet,
  DashboardChart,
  StudioPreviewResult,
  AIChartBlueprint,
  CognitiveThoughtStep,
  MindSpark,
  DeepDiagnosticResult,
  WhatIfSimulationResult
} from '../../types';

interface AIDashboardStudioModalProps {
  dataset: Dataset;
  sheets: DashboardSheet[];
  isOpen: boolean;
  onClose: () => void;
  onChartCreated: () => Promise<void>;
  onSheetCreated?: (title: string) => Promise<void>;
}

// Color Palette Configurations
const STUDIO_PALETTES: Record<string, { name: string; colors: string[]; badgeClass: string }> = {
  cyberpunk: {
    name: 'Cyberpunk Neon',
    colors: ['#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'],
    badgeClass: 'badge-neon-blue'
  },
  emerald: {
    name: 'Executive Emerald',
    colors: ['#10b981', '#059669', '#14b8a6', '#0d9488', '#34d399'],
    badgeClass: 'badge-neon-emerald'
  },
  corporate: {
    name: 'Corporate Indigo',
    colors: ['#3b82f6', '#1d4ed8', '#4f46e5', '#4338ca', '#2563eb'],
    badgeClass: 'badge-neon-purple'
  },
  sunset: {
    name: 'Sunset Amber',
    colors: ['#f59e0b', '#ea580c', '#f97316', '#e11d48', '#fbbf24'],
    badgeClass: 'badge-neon-amber'
  },
  purple: {
    name: 'Royal Violet',
    colors: ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#c084fc'],
    badgeClass: 'badge-neon-purple'
  }
};

interface JoinStep {
  id: string;
  table: string;
  primaryKey: string;
  joinKey: string;
}

export const AIDashboardStudioModal: React.FC<AIDashboardStudioModalProps> = ({
  dataset,
  sheets,
  isOpen,
  onClose,
  onChartCreated,
  onSheetCreated
}) => {
  const tables = dataset.tables || [];
  const [activeTab, setActiveTab] = useState<'prompt' | 'composer' | 'blueprints' | 'tables'>('prompt');
  const [canvasView, setCanvasView] = useState<'chart' | 'data'>('chart');

  // AI Prompt Studio State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Studio Chart Configuration
  const [chartTitle, setChartTitle] = useState<string>('');
  const [chartDescription, setChartDescription] = useState<string>('');
  const [chartType, setChartType] = useState<DashboardChart['chart_type']>('bar');
  const [primaryTable, setPrimaryTable] = useState<string>(tables[0]?.table_name || '');
  const [joinSteps, setJoinSteps] = useState<JoinStep[]>([]);
  const [xField, setXField] = useState<string>('');
  const [yField, setYField] = useState<string>('');
  const [secondaryYField, setSecondaryYField] = useState<string>('');
  const [aggregation, setAggregation] = useState<string>('sum');
  const [selectedPalette, setSelectedPalette] = useState<string>('cyberpunk');
  const [targetSheetId, setTargetSheetId] = useState<string>(sheets[0]?.id || '');
  const [newSheetName, setNewSheetName] = useState<string>('');
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState<boolean>(false);

  // Live Canvas Preview & Blueprints State
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<StudioPreviewResult | null>(null);
  const [blueprints, setBlueprints] = useState<AIChartBlueprint[]>([]);
  const [blueprintsLoading, setBlueprintsLoading] = useState<boolean>(false);
  const [isSavingChart, setIsSavingChart] = useState<boolean>(false);

  // Cognitive Reasoning & Deep Diagnostics State
  const [thoughtExpanded, setThoughtExpanded] = useState<boolean>(true);
  const [activeDiagnostic, setActiveDiagnostic] = useState<DeepDiagnosticResult | null>(null);
  const [isDeepening, setIsDeepening] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [whatIfDelta, setWhatIfDelta] = useState<number>(0);
  const [whatIfCohort, setWhatIfCohort] = useState<string>('ALL');
  const [simulatedPoints, setSimulatedPoints] = useState<any[] | null>(null);

  // Available column lists from current merged preview
  const availableColumns = previewResult?.columns || (tables.find(t => t.table_name === primaryTable)?.columns?.map(c => c.column_name) || []);

  // Detect join keys helper
  const detectJoinKeys = (connectedTableNames: string[], targetTable: string): { primaryKey: string; joinKey: string } => {
    const rels = dataset.relationships || [];
    for (const src of connectedTableNames) {
      const rel = rels.find(
        (r) =>
          (r.source_table === src && r.target_table === targetTable) ||
          (r.target_table === src && r.source_table === targetTable)
      );
      if (rel) {
        return rel.source_table === targetTable
          ? { primaryKey: rel.target_column, joinKey: rel.source_column }
          : { primaryKey: rel.source_column, joinKey: rel.target_column };
      }
    }
    const targetCols = tables.find((t) => t.table_name === targetTable)?.columns || [];
    for (const src of connectedTableNames) {
      const srcCols = tables.find((t) => t.table_name === src)?.columns || [];
      const common = srcCols.find((c1) =>
        targetCols.some((c2) => c2.column_name.toLowerCase() === c1.column_name.toLowerCase())
      );
      if (common) {
        return { primaryKey: common.column_name, joinKey: common.column_name };
      }
    }
    return { primaryKey: '', joinKey: '' };
  };

  // 1-Click Auto-Connect All Tables
  const handleAutoConnectAll = () => {
    if (!primaryTable || tables.length <= 1) return;
    const visited = [primaryTable];
    const newSteps: JoinStep[] = [];
    const queue = [primaryTable];

    while (queue.length > 0 && visited.length < tables.length) {
      const current = queue.shift()!;
      for (const t of tables) {
        if (visited.includes(t.table_name)) continue;
        const keys = detectJoinKeys(visited, t.table_name);
        if (keys.primaryKey && keys.joinKey) {
          visited.push(t.table_name);
          queue.push(t.table_name);
          newSteps.push({
            id: `join-${Date.now()}-${t.table_name}`,
            table: t.table_name,
            primaryKey: keys.primaryKey,
            joinKey: keys.joinKey
          });
        }
      }
    }
    setJoinSteps(newSteps);
  };

  // Load Blueprints
  const loadBlueprints = async () => {
    setBlueprintsLoading(true);
    try {
      const res = await api.getStudioBlueprints(dataset.id);
      setBlueprints(res.blueprints || []);
    } catch (err) {
      console.error('Failed to fetch blueprints:', err);
    } finally {
      setBlueprintsLoading(false);
    }
  };

  // Execute Live Chart Preview
  const refreshLivePreview = useCallback(async (
    targetTbl = primaryTable,
    targetX = xField,
    targetY = yField,
    targetCtype = chartType,
    targetAgg = aggregation,
    targetSecY = secondaryYField,
    targetSteps = joinSteps
  ) => {
    if (!targetTbl) return;
    setPreviewLoading(true);
    try {
      const payload: any = {
        table_name: targetTbl,
        x_field: targetX || 'category',
        y_field: targetY || 'value',
        chart_type: targetCtype,
        aggregation: targetAgg,
        secondary_y_field: targetSecY || undefined,
        palette: selectedPalette
      };

      if (targetSteps.length > 0) {
        payload.joins = targetSteps.map(s => ({
          table: s.table,
          primary_key: s.primaryKey,
          join_key: s.joinKey
        }));
      }

      const res = await api.previewStudioChart(dataset.id, payload);
      setPreviewResult(res);

      if (!targetX && res.columns.length > 0) {
        setXField(res.columns[0]);
      }
      if (!targetY && res.columns.length > 1) {
        setYField(res.columns[1]);
      }
    } catch (err) {
      console.error('Failed to preview studio chart:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [dataset.id, primaryTable, xField, yField, chartType, aggregation, secondaryYField, joinSteps, selectedPalette]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBlueprints();
      if (tables.length > 0) {
        const initialPrimary = tables[0].table_name;
        setPrimaryTable(initialPrimary);
        const cols = tables[0].columns || [];
        const numCol = cols.find(c => c.data_type === 'numeric');
        const catCol = cols.find(c => c.data_type !== 'numeric' && !c.column_name.toLowerCase().endsWith('id'));
        const initialX = catCol ? catCol.column_name : (cols[0]?.column_name || '');
        const initialY = numCol ? numCol.column_name : (cols[1]?.column_name || initialX);
        setXField(initialX);
        setYField(initialY);
        setChartTitle(`${initialY.replace(/_/g, ' ')} by ${initialX.replace(/_/g, ' ')}`);
        refreshLivePreview(initialPrimary, initialX, initialY, 'bar', 'sum');
      }
    }
  }, [isOpen]);

  // Natural Language AI Synthesize
  const handleAISynthesize = async (promptToUse?: string) => {
    const query = (promptToUse || aiPrompt).trim();
    if (!query) return;
    setIsSynthesizing(true);
    try {
      const res = await api.aiSynthesizeChart(dataset.id, {
        prompt: query,
        target_table: primaryTable
      });

      setChartTitle(res.title);
      setChartDescription(res.description);
      setChartType(res.chart_type);
      setPrimaryTable(res.table_name);
      setXField(res.x_field);
      setYField(res.y_field);
      setSecondaryYField(res.secondary_y_field || '');
      setAggregation(res.aggregation);
      setSelectedPalette(res.palette || 'cyberpunk');

      setPreviewResult({
        chart_data: res.chart_data,
        summary: res.summary,
        ai_insight: res.ai_insight,
        strategic_directive: res.strategic_directive,
        thought_process: res.thought_process,
        mind_sparks: res.mind_sparks,
        columns: res.columns,
        total_rows: res.total_rows
      });

      // Reset scenario simulation and diagnostics for fresh insight
      setSimulatedPoints(null);
      setWhatIfDelta(0);
      setActiveDiagnostic(null);
    } catch (err) {
      console.error('Failed to AI-synthesize chart:', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // What-If Dynamic Simulation
  const handleWhatIfChange = (delta: number, cohort: string = whatIfCohort) => {
    setWhatIfDelta(delta);
    setWhatIfCohort(cohort);
    if (!previewResult || !previewResult.chart_data || delta === 0) {
      setSimulatedPoints(null);
      return;
    }
    const mult = 1.0 + (delta / 100.0);
    const updated = previewResult.chart_data.map(p => {
      const orig = Number(p.value) || 0;
      if (cohort === 'ALL' || cohort === p.label) {
        const newVal = Math.round(orig * mult * 100) / 100;
        return {
          ...p,
          value: newVal,
          original_value: orig,
          delta: Math.round((newVal - orig) * 100) / 100
        };
      }
      return {
        ...p,
        original_value: orig,
        delta: 0
      };
    });
    setSimulatedPoints(updated);
  };

  // Deepen AI Thinking Handler
  const handleDeepenThinking = async () => {
    if (!primaryTable || !xField || !yField) return;
    setIsDeepening(true);
    setShowDiagnosticModal(true);
    try {
      const res = await api.deepenStudioThinking(dataset.id, {
        table_name: primaryTable,
        x_field: xField,
        y_field: yField,
        chart_type: chartType,
        aggregation: aggregation
      });
      setActiveDiagnostic(res);
    } catch (err) {
      console.error('Failed to deepen thinking:', err);
    } finally {
      setIsDeepening(false);
    }
  };

  // Apply Blueprint
  const handleApplyBlueprint = (bp: AIChartBlueprint) => {
    setChartTitle(bp.title);
    setChartDescription(bp.description);
    setChartType(bp.chart_type);
    setPrimaryTable(bp.table_name);
    setXField(bp.x_field);
    setYField(bp.y_field);
    setSecondaryYField(bp.secondary_y_field || '');
    setAggregation(bp.aggregation);
    setSelectedPalette(bp.palette || 'cyberpunk');
    setActiveTab('composer');
    refreshLivePreview(bp.table_name, bp.x_field, bp.y_field, bp.chart_type, bp.aggregation, bp.secondary_y_field);
  };

  // Add Chart to Dashboard Sheet
  const handleProduceChart = async () => {
    let sheetId = targetSheetId;
    if (isCreatingNewSheet && newSheetName.trim()) {
      try {
        const newSheet = await api.createSheet(dataset.id, newSheetName.trim());
        sheetId = newSheet.id;
      } catch (err) {
        console.error('Failed to create sheet:', err);
        return;
      }
    }

    if (!sheetId || !chartTitle.trim()) return;
    setIsSavingChart(true);

    try {
      const config: any = {
        palette: selectedPalette,
        ai_insight: previewResult?.ai_insight
      };

      if (joinSteps.length > 0) {
        config.joins = joinSteps.map(s => ({
          table: s.table,
          primary_key: s.primaryKey,
          join_key: s.joinKey
        }));
      }

      await api.createChart({
        sheet_id: sheetId,
        title: chartTitle.trim(),
        description: chartDescription || `AI-Synthesized visualization of ${yField} by ${xField}`,
        chart_type: chartType,
        table_name: primaryTable,
        join_table: joinSteps[0]?.table || undefined,
        primary_key: joinSteps[0]?.primaryKey || undefined,
        join_key: joinSteps[0]?.joinKey || undefined,
        x_field: xField,
        y_field: yField,
        secondary_y_field: chartType === 'composed' ? (secondaryYField || undefined) : undefined,
        aggregation,
        config,
        grid_w: 6,
        grid_h: 4
      });

      await onChartCreated();
      onClose();
    } catch (err) {
      console.error('Failed to save studio chart:', err);
    } finally {
      setIsSavingChart(false);
    }
  };

  if (!isOpen) return null;

  const currentColors = STUDIO_PALETTES[selectedPalette]?.colors || STUDIO_PALETTES.cyberpunk.colors;
  const chartPoints = previewResult?.chart_data || [];
  const displayPoints = simulatedPoints || chartPoints;
  const summary = previewResult?.summary;

  const quickPromptChips = [
    'Top 5 sales categories by revenue',
    'Monthly trend of order volume',
    'Customer segment share of total sales',
    'Compare volume vs return rate across product tiers',
    'Performance spread across regional branches'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-5 animate-fadeIn">
      <div className="glass-3d-card border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden shadow-[0_35px_100px_rgba(0,0,0,0.95),0_0_50px_rgba(59,130,246,0.2)] relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-sm" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 text-cyan-300 flex items-center justify-center border border-cyan-500/40 shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <span>AI Dashboard Studio</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full badge-neon-blue font-mono font-bold">
                    PRO BUILDER
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Natural-language synthesis, visual multi-table relational chaining, and live interactive canvas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition active:translate-y-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Mode Tabs Bar */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2">
          <div className="tabs-3d-rail">
            <button
              onClick={() => setActiveTab('prompt')}
              className={`tab-3d-item flex items-center gap-2 ${activeTab === 'prompt' ? 'tab-3d-item-active' : ''}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>🔮 AI Prompt Studio</span>
            </button>
            <button
              onClick={() => setActiveTab('composer')}
              className={`tab-3d-item flex items-center gap-2 ${activeTab === 'composer' ? 'tab-3d-item-active' : ''}`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>📐 Visual Composer</span>
            </button>
            <button
              onClick={() => setActiveTab('blueprints')}
              className={`tab-3d-item flex items-center gap-2 ${activeTab === 'blueprints' ? 'tab-3d-item-active' : ''}`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>📋 AI Blueprints ({blueprints.length})</span>
            </button>
            {tables.length > 1 && (
              <button
                onClick={() => setActiveTab('tables')}
                className={`tab-3d-item flex items-center gap-2 ${activeTab === 'tables' ? 'tab-3d-item-active' : ''}`}
              >
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                <span>🗄️ Relational Schema ({tables.length} Tables)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshLivePreview()}
              disabled={previewLoading}
              className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${previewLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Canvas</span>
            </button>
          </div>
        </div>

        {/* Modal Main Split Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel: Studio Controls */}
          <div className="lg:col-span-5 border-r border-slate-800/80 p-5 overflow-y-auto space-y-4 bg-slate-950/40">
            {/* TAB 1: AI PROMPT STUDIO */}
            {activeTab === 'prompt' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/30 to-blue-950/30 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Prompt-to-Visualization AI Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Type what you want to analyze in plain English. The AI agent inspects your tables, selects dimensions, metrics, and chart architectures, and computes live results immediately.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    What business question do you want to visualize?
                  </label>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Compare total revenue by category and highlight the top 3 drivers with an emerald palette..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner resize-none font-sans"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAISynthesize();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAISynthesize()}
                      disabled={isSynthesizing || !aiPrompt.trim()}
                      className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg btn-3d-primary text-white text-xs font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-40"
                    >
                      <Send className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                      <span>{isSynthesizing ? 'Synthesizing...' : 'Generate'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Inspiration Chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">💡 Quick Prompts:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPromptChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setAiPrompt(chip);
                          handleAISynthesize(chip);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 transition text-left"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5-Step Cognitive Chain of Thought */}
                {previewResult?.thought_process && previewResult.thought_process.length > 0 && (
                  <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-cyan-950/20 overflow-hidden shadow-lg mt-3">
                    <button
                      type="button"
                      onClick={() => setThoughtExpanded(!thoughtExpanded)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-cyan-500/10 transition border-b border-cyan-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                          <Brain className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            AI Cognitive Reasoning Stream
                            <span className="text-[10px] px-2 py-0.2 rounded-full badge-neon-blue font-mono">
                              5 STEPS
                            </span>
                          </span>
                          <span className="text-[10px] text-cyan-400/80 block">
                            Deep distribution profiling & schema reasoning
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        {thoughtExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {thoughtExpanded && (
                      <div className="p-3 space-y-2.5 text-xs bg-slate-950/60">
                        {previewResult.thought_process.map((step) => (
                          <div key={step.step} className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-[11px]">
                                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">
                                  {step.step}
                                </span>
                                <span>{step.title}</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono">
                                {(step.confidence * 100).toFixed(0)}% Conf
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 pl-5 leading-relaxed font-sans">
                              {step.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Autonomous Mind Sparks */}
                {previewResult?.mind_sparks && previewResult.mind_sparks.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span>Autonomous Mind Sparks (Proactive Discoveries)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {previewResult.mind_sparks.map((spark) => (
                        <button
                          key={spark.id}
                          type="button"
                          onClick={() => {
                            setAiPrompt(spark.suggested_prompt);
                            handleAISynthesize(spark.suggested_prompt);
                          }}
                          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850/80 text-left transition group space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-400" />
                              {spark.title}
                            </span>
                            <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition font-mono flex items-center gap-0.5">
                              Apply <ArrowRight className="w-2.5 h-2.5" />
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {spark.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VISUAL COMPOSER */}
            {activeTab === 'composer' && (
              <div className="space-y-3.5">
                {/* Chart Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Visualization Title</label>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="e.g. Sales Volume by Segment"
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Chart Type Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chart Architecture</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {[
                      { type: 'bar', label: 'Bar', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                      { type: 'line', label: 'Line', icon: <LineChart className="w-3.5 h-3.5" /> },
                      { type: 'area', label: 'Area', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                      { type: 'pie', label: 'Pie', icon: <PieChart className="w-3.5 h-3.5" /> },
                      { type: 'heatmap', label: 'Heatmap', icon: <Grid className="w-3.5 h-3.5 text-orange-400" /> },
                      { type: 'treemap', label: 'Treemap', icon: <LayoutGrid className="w-3.5 h-3.5 text-teal-400" /> },
                      { type: 'composed', label: 'Dual-Axis', icon: <Layers className="w-3.5 h-3.5" /> },
                      { type: 'radar', label: 'Radar', icon: <Compass className="w-3.5 h-3.5" /> },
                      { type: 'scatter', label: 'Scatter', icon: <ScatterChart className="w-3.5 h-3.5" /> },
                      { type: 'horizontal_bar', label: 'Rank', icon: <BarChart3 className="w-3.5 h-3.5 rotate-90" /> }
                    ].map((t) => (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => {
                          setChartType(t.type as any);
                          refreshLivePreview(primaryTable, xField, yField, t.type as any);
                        }}
                        className={`p-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition ${
                          chartType === t.type
                            ? 'bg-cyan-600/25 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table & Relational Joins */}
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Data Source Table</span>
                    </span>
                    {tables.length > 1 && (
                      <button
                        onClick={handleAutoConnectAll}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono font-bold"
                      >
                        ⚡ Connect All
                      </button>
                    )}
                  </div>
                  <select
                    value={primaryTable}
                    onChange={(e) => {
                      setPrimaryTable(e.target.value);
                      refreshLivePreview(e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none font-mono"
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.table_name}>
                        {t.table_name} ({t.row_count} rows)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dimension & Metric Axis Mapping */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      X-Axis (Dimension)
                    </label>
                    <select
                      value={xField}
                      onChange={(e) => {
                        setXField(e.target.value);
                        refreshLivePreview(primaryTable, e.target.value, yField);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none font-mono"
                    >
                      {availableColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Y-Axis (Primary Metric)
                    </label>
                    <select
                      value={yField}
                      onChange={(e) => {
                        setYField(e.target.value);
                        refreshLivePreview(primaryTable, xField, e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none font-mono"
                    >
                      {availableColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional Secondary Axis for Composed Chart */}
                {chartType === 'composed' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Secondary Metric (Dual-Axis Line)
                    </label>
                    <select
                      value={secondaryYField}
                      onChange={(e) => {
                        setSecondaryYField(e.target.value);
                        refreshLivePreview(primaryTable, xField, yField, chartType, aggregation, e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none font-mono"
                    >
                      <option value="">-- Auto-Select Alternate Numeric --</option>
                      {availableColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Aggregation & Aesthetic Palette */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Aggregation</label>
                    <select
                      value={aggregation}
                      onChange={(e) => {
                        setAggregation(e.target.value);
                        refreshLivePreview(primaryTable, xField, yField, chartType, e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="sum">SUM (Total)</option>
                      <option value="avg">AVG (Mean)</option>
                      <option value="count">COUNT (Frequency)</option>
                      <option value="max">MAX (Peak)</option>
                      <option value="min">MIN (Floor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Palette Theme</label>
                    <select
                      value={selectedPalette}
                      onChange={(e) => setSelectedPalette(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-cyan-400 focus:outline-none"
                    >
                      {Object.entries(STUDIO_PALETTES).map(([key, pal]) => (
                        <option key={key} value={key}>
                          {pal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: AI BLUEPRINTS GALLERY */}
            {activeTab === 'blueprints' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pre-engineered executive blueprints tailored to your dataset:</span>
                  <span className="font-mono text-cyan-400 font-bold">{blueprints.length} Templates</span>
                </div>

                {blueprintsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Discovering dataset schema and engineering blueprints...
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
                    {blueprints.map((bp) => (
                      <div
                        key={bp.id}
                        onClick={() => handleApplyBlueprint(bp)}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 cursor-pointer transition space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                              {bp.title}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full badge-neon-blue font-mono font-bold">
                            {bp.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{bp.description}</p>
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
                          <span>
                            {bp.x_field} ➔ {bp.y_field} ({bp.aggregation.toUpperCase()})
                          </span>
                          <span className="text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                            Apply Blueprint <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: RELATIONAL SCHEMA */}
            {activeTab === 'tables' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Relational Table Joins</span>
                  <button
                    onClick={handleAutoConnectAll}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                  >
                    <span>⚡ Auto-Connect All Tables</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-mono">Root Table:</span>
                    <div className="font-bold text-xs text-white">{primaryTable}</div>
                  </div>

                  {joinSteps.map((s, idx) => (
                    <div key={s.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-cyan-300">Join #{idx + 1}: {s.table}</span>
                        <span className="text-[10px] font-mono text-slate-400">{s.joinKey}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Live Interactive Preview Canvas */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between bg-slate-950/20 overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Canvas Header & Mode Switcher */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Real-Time Studio Canvas</span>
                    <span className="text-[10px] text-slate-400 font-normal">({chartType.toUpperCase()})</span>
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeepenThinking}
                    disabled={isDeepening || chartPoints.length === 0}
                    className="btn-3d-secondary px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-300 border-purple-500/40 hover:border-purple-400 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Brain className={`w-3.5 h-3.5 text-purple-400 ${isDeepening ? 'animate-spin' : ''}`} />
                    <span>Deepen AI Thinking</span>
                  </button>

                  <div className="tabs-3d-rail text-xs">
                    <button
                      onClick={() => setCanvasView('chart')}
                      className={`tab-3d-item ${canvasView === 'chart' ? 'tab-3d-item-active' : ''}`}
                    >
                      Visual Chart
                    </button>
                    <button
                      onClick={() => setCanvasView('data')}
                      className={`tab-3d-item ${canvasView === 'data' ? 'tab-3d-item-active' : ''}`}
                    >
                      Data Grid ({previewResult?.total_rows || 0})
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistical KPI Ribbon */}
              {summary && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Cohorts</span>
                    <strong className="text-sm font-black text-white">{summary.total_points}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Total {yField}</span>
                    <strong className="text-sm font-black text-cyan-300">
                      {summary.sum >= 1e6 ? `${(summary.sum / 1e6).toFixed(1)}M` : summary.sum >= 1e3 ? `${(summary.sum / 1e3).toFixed(1)}K` : summary.sum.toFixed(0)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">Mean</span>
                    <strong className="text-sm font-black text-white">
                      {summary.mean >= 1e3 ? `${(summary.mean / 1e3).toFixed(1)}K` : summary.mean.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center truncate">
                    <span className="text-[10px] text-slate-400 block font-mono">Peak Driver</span>
                    <strong className="text-xs font-bold text-amber-300 truncate block" title={summary.peak_label}>
                      {summary.peak_label}
                    </strong>
                  </div>
                </div>
              )}

              {/* Active AI Insight Card */}
              {previewResult?.ai_insight && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-indigo-950/40 border border-cyan-500/30 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-200 leading-relaxed">
                    {previewResult.ai_insight}
                  </p>
                </div>
              )}

              {/* Strategic Directive */}
              {previewResult?.strategic_directive && (
                <div className="p-2.5 rounded-xl bg-purple-950/25 border border-purple-500/30 flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-purple-200 leading-snug font-sans">
                    {previewResult.strategic_directive}
                  </p>
                </div>
              )}

              {/* What-If Scenario Levers Toolbar */}
              {chartPoints.length > 0 && canvasView === 'chart' && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-bold text-white">What-If Scenario Simulation Lever</span>
                      {whatIfDelta !== 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50 font-mono">
                          {whatIfDelta > 0 ? `+${whatIfDelta}%` : `${whatIfDelta}%`} on {whatIfCohort}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[-20, -10, 0, 10, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleWhatIfChange(pct)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition ${
                            whatIfDelta === pct
                              ? 'bg-purple-600 border-purple-400 text-white font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pct === 0 ? 'Reset' : pct > 0 ? `+${pct}%` : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4">
                      <select
                        value={whatIfCohort}
                        onChange={(e) => handleWhatIfChange(whatIfDelta, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded-lg p-1.5 focus:border-purple-400 focus:outline-none font-mono"
                      >
                        <option value="ALL">Apply to ALL Cohorts</option>
                        {chartPoints.map((p) => (
                          <option key={p.label} value={p.label}>
                            Cohort: {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-8 flex items-center gap-3">
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        step="1"
                        value={whatIfDelta}
                        onChange={(e) => handleWhatIfChange(Number(e.target.value))}
                        className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <span className={`text-xs font-mono font-bold min-w-[50px] text-right ${
                        whatIfDelta > 0 ? 'text-emerald-400' : whatIfDelta < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {whatIfDelta > 0 ? `+${whatIfDelta}%` : `${whatIfDelta}%`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Render Visualization or Tabular Data */}
              <div className="h-64 sm:h-72 w-full p-2 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-center relative overflow-hidden">
                {previewLoading ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Computing live preview...</span>
                  </div>
                ) : canvasView === 'data' ? (
                  <div className="w-full h-full overflow-auto table-3d-container">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="table-3d-header">
                        <tr>
                          {previewResult?.columns?.slice(0, 8).map((c) => (
                            <th key={c} className="py-2 px-3 truncate max-w-xs">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {previewResult?.sample_data?.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-850/40">
                            {previewResult?.columns?.slice(0, 8).map((c) => (
                              <td key={c} className="py-2 px-3 font-mono text-[10px] truncate max-w-xs">
                                {String(r[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : displayPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'line' ? (
                      <ReLineChart data={displayPoints} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="value" stroke={currentColors[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                      </ReLineChart>
                    ) : chartType === 'area' ? (
                      <AreaChart data={displayPoints} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="value" stroke={currentColors[0]} fill={currentColors[0]} fillOpacity={0.25} />
                      </AreaChart>
                    ) : chartType === 'pie' ? (
                      <RePieChart>
                        <Pie data={displayPoints} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                          {displayPoints.map((_, i) => (
                            <Cell key={i} fill={currentColors[i % currentColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                      </RePieChart>
                    ) : chartType === 'composed' ? (
                      <ComposedChart data={displayPoints} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="value" fill={currentColors[0]} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="secondary_value" stroke={currentColors[2]} strokeWidth={2} />
                      </ComposedChart>
                    ) : chartType === 'radar' ? (
                      <RadarChart cx="50%" cy="50%" outerRadius={75} data={displayPoints.slice(0, 8)}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                        <PolarRadiusAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                        <Radar name="Metric" dataKey="value" stroke={currentColors[0]} fill={currentColors[0]} fillOpacity={0.4} />
                      </RadarChart>
                    ) : chartType === 'treemap' ? (
                      <Treemap
                        data={displayPoints.map((d, i) => ({
                          name: d.label || d.name || `Cohort ${i + 1}`,
                          value: typeof d.value === 'number' ? d.value : 1,
                          size: typeof d.value === 'number' ? d.value : 1
                        }))}
                        dataKey="value"
                        stroke="#0B1120"
                        isAnimationActive={true}
                      >
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                      </Treemap>
                    ) : chartType === 'heatmap' ? (
                      <BarChart data={displayPoints.slice(0, 12)} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {displayPoints.slice(0, 12).map((_, i) => (
                            <Cell key={i} fill={currentColors[i % currentColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === 'horizontal_bar' ? (
                      <BarChart layout="vertical" data={displayPoints.slice(0, 10)} margin={{ top: 10, right: 20, left: 30, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="value" fill={currentColors[0]} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={displayPoints} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="value" fill={currentColors[0]} radius={[4, 4, 0, 0]}>
                          {displayPoints.map((_, i) => (
                            <Cell key={i} fill={currentColors[i % currentColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-500">
                    Configure dimension and metric on the left to render visualization
                  </div>
                )}
              </div>
            </div>

            {/* Studio Action Footer */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Add to Sheet:</span>
                {isCreatingNewSheet ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="New sheet name..."
                      value={newSheetName}
                      onChange={(e) => setNewSheetName(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-400 w-36"
                    />
                    <button
                      onClick={() => setIsCreatingNewSheet(false)}
                      className="text-xs text-slate-400 hover:text-white px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={targetSheetId}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsCreatingNewSheet(true);
                        } else {
                          setTargetSheetId(e.target.value);
                        }
                      }}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:border-cyan-400 focus:outline-none"
                    >
                      {sheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.sheet_type})
                        </option>
                      ))}
                      <option value="__new__">➕ Create New Sheet...</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProduceChart}
                  disabled={isSavingChart || !chartTitle.trim()}
                  className="btn-3d-primary px-5 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingChart ? 'Deploying Chart...' : 'Add Visualization to Dashboard'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deepened AI Thinking Diagnostic Drawer / Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="glass-3d-card border border-purple-500/40 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.25)] relative">
            <div className="px-5 py-3.5 border-b border-purple-500/20 bg-purple-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Deepened AI Cognitive Diagnosis</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full badge-neon-purple font-mono">
                      2ND-ORDER REASONING
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Root-cause driver decomposition, statistical outlier detection, and elasticity projections
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-purple-900/40 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isDeepening ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                  <span>Computing 2nd-order variance, z-score outlier tests, and elasticity models...</span>
                </div>
              ) : activeDiagnostic ? (
                <div className="space-y-4">
                  {/* Top Driver & Baseline */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-mono">Top Driver Cohort</span>
                      <div className="text-sm font-black text-purple-300 truncate">
                        {activeDiagnostic.top_driver?.label || 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {activeDiagnostic.top_driver?.share_pct}% of total {yField}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-mono">Total Observed Volume</span>
                      <div className="text-sm font-black text-cyan-300">
                        {activeDiagnostic.total_portfolio?.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Baseline Mean: {activeDiagnostic.mean_baseline?.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-mono">Outlier Anomalies</span>
                      <div className="text-sm font-black text-amber-300">
                        {activeDiagnostic.anomalies?.length || 0} Cohorts (|z| ≥ 1.8)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Statistically significant deviations
                      </div>
                    </div>
                  </div>

                  {/* Anomalies Detected */}
                  {activeDiagnostic.anomalies && activeDiagnostic.anomalies.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Detected Statistical Anomalies (|z| ≥ 1.8)</span>
                      </div>
                      <div className="space-y-1.5">
                        {activeDiagnostic.anomalies.map((anom, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span className="font-semibold text-white">{anom.cohort}</span>
                              <span className="text-slate-400 font-mono">Val: {anom.value.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-amber-400">z = {anom.z_score}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50">
                                {anom.deviation_pct > 0 ? `+${anom.deviation_pct}%` : `${anom.deviation_pct}%`} vs Mean
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Elasticity Sensitivity Projection */}
                  {activeDiagnostic.sensitivity && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-purple-300">
                          <Target className="w-4 h-4 text-purple-400" />
                          <span>Sensitivity & Elasticity Projection</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-700/50">
                          {activeDiagnostic.sensitivity.scenario_label}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Projected Driver Val</span>
                          <strong className="text-white font-mono text-xs">
                            {activeDiagnostic.sensitivity.projected_top_value?.toLocaleString()}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Net Impact Gain</span>
                          <strong className="text-emerald-400 font-mono text-xs">
                            +{activeDiagnostic.sensitivity.net_gain?.toLocaleString()}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Portfolio Share Shift</span>
                          <strong className="text-cyan-300 font-mono text-xs">
                            {activeDiagnostic.sensitivity.portfolio_share_change}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3-Phase Strategic Action Playbook */}
                  {activeDiagnostic.playbook && activeDiagnostic.playbook.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-cyan-300">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>3-Phase Executive Playbook</span>
                      </div>
                      <div className="space-y-2">
                        {activeDiagnostic.playbook.map((step, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                            <span className="text-[10px] font-bold text-cyan-400 font-mono tracking-wide">
                              {step.phase}
                            </span>
                            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                              {step.action}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  Click Deepen AI Thinking to compute analytical decomposition.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-purple-500/20 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Powered by DATOVA Cognitive Intelligence Engine
              </span>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="btn-3d-secondary px-4 py-1.5 rounded-xl text-xs text-white"
              >
                Close Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
