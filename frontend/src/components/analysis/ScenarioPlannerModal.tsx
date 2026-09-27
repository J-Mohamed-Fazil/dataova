import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sliders,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RotateCcw,
  Shield,
  Rocket,
  Gem,
  ArrowRight,
  Search,
  BarChart3,
  Layers,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Activity,
  Grid,
  Bookmark,
  ChevronRight,
  Gauge,
  HelpCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { api } from '../../services/api';
import {
  ScenarioConfig,
  ScenarioSimulationResult,
  SavedScenarioSnapshot
} from '../../types';

interface ScenarioPlannerModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helpers
const formatCompactNumber = (num: number, isCurrency = true): string => {
  if (num === null || num === undefined || isNaN(num)) return isCurrency ? '$0' : '0';
  const prefix = isCurrency ? '$' : '';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e8) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
};

const formatColumnName = (col: string): string => {
  if (!col) return '';
  return col
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatSegmentId = (seg: string): string => {
  if (!seg) return 'All';
  if (seg.length > 18 && /^[0-9a-fA-F-]+$/.test(seg)) {
    return `#${seg.slice(0, 6)}...${seg.slice(-4)}`;
  }
  return seg;
};

export const ScenarioPlannerModal: React.FC<ScenarioPlannerModalProps> = ({
  datasetId,
  datasetName,
  isOpen,
  onClose
}) => {
  const [config, setConfig] = useState<ScenarioConfig | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedDim, setSelectedDim] = useState<string>('');
  const [levers, setLevers] = useState<Array<{ column: string; shift_pct: number; correlation?: number }>>([]);
  const [result, setResult] = useState<ScenarioSimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [segmentSearch, setSegmentSearch] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'growth' | 'defense' | 'margin' | 'stress' | 'custom'>('custom');
  const [activeTab, setActiveTab] = useState<'waterfall' | 'comparison' | 'segments' | 'matrix'>('waterfall');

  // New Lever dropdown
  const [selectedNewLever, setSelectedNewLever] = useState<string>('');

  // Saved Snapshots state
  const [savedSnapshots, setSavedSnapshots] = useState<SavedScenarioSnapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  // Load configuration
  useEffect(() => {
    if (!isOpen) return;
    const loadConfig = async () => {
      try {
        setLoading(true);
        const data = await api.getScenarioConfig(datasetId);
        setConfig(data);
        setSelectedTarget(data.target_metric || data.all_numeric_columns[0] || '');
        setSelectedDim(data.default_dimension || data.all_dimension_columns[0] || '');

        const initialLevers = data.recommended_drivers.map((d) => ({
          column: d.column,
          shift_pct: 0,
          correlation: d.correlation
        }));
        if (initialLevers.length === 0 && data.target_metric) {
          initialLevers.push({ column: data.target_metric, shift_pct: 0, correlation: 1.0 });
        }
        setLevers(initialLevers);
        setActivePreset('custom');

        // Load saved snapshots from localStorage if available
        const storageKey = `datanova_scenarios_${datasetId}`;
        const localSaved = localStorage.getItem(storageKey);
        if (localSaved) {
          try {
            setSavedSnapshots(JSON.parse(localSaved));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Failed to load scenario config:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [isOpen, datasetId]);

  // Run simulation whenever levers, target, or dimension change
  useEffect(() => {
    if (!selectedTarget || levers.length === 0) return;

    const runSim = async () => {
      try {
        setSimulating(true);
        const simRes = await api.simulateScenario(datasetId, {
          target_metric: selectedTarget,
          drivers: levers.map((l) => ({ column: l.column, shift_pct: l.shift_pct })),
          dimension_col: selectedDim || undefined,
          table_name: config?.table_name
        });
        setResult(simRes);
      } catch (err) {
        console.error('Simulation failed:', err);
      } finally {
        setSimulating(false);
      }
    };

    const timer = setTimeout(runSim, 100);
    return () => clearTimeout(timer);
  }, [levers, selectedTarget, selectedDim, datasetId, config]);

  const handleSliderChange = (idx: number, val: number) => {
    setActivePreset('custom');
    setLevers((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], shift_pct: val };
      return updated;
    });
  };

  const adjustLeverDelta = (idx: number, delta: number) => {
    setActivePreset('custom');
    setLevers((prev) => {
      const updated = [...prev];
      const newPct = Math.max(-50, Math.min(50, updated[idx].shift_pct + delta));
      updated[idx] = { ...updated[idx], shift_pct: newPct };
      return updated;
    });
  };

  const handleRemoveLever = (idx: number) => {
    setActivePreset('custom');
    setLevers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddLever = () => {
    if (!selectedNewLever) return;
    if (levers.some((l) => l.column === selectedNewLever)) return;

    // Check correlation if known
    const rec = config?.recommended_drivers.find((d) => d.column === selectedNewLever);
    const corr = rec ? rec.correlation : 0.5;

    setLevers((prev) => [
      ...prev,
      { column: selectedNewLever, shift_pct: 0, correlation: corr }
    ]);
    setSelectedNewLever('');
  };

  const applyPreset = (preset: 'growth' | 'defense' | 'margin' | 'stress' | 'reset') => {
    if (preset === 'reset') {
      setActivePreset('custom');
      setLevers((prev) => prev.map((l) => ({ ...l, shift_pct: 0 })));
      return;
    }
    if (preset === 'growth') {
      setActivePreset('growth');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i === 0 ? 15 : (i === 1 ? 10 : 5)
        }))
      );
    } else if (preset === 'defense') {
      setActivePreset('defense');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i === 0 ? -15 : (i === 1 ? -10 : -5)
        }))
      );
    } else if (preset === 'margin') {
      setActivePreset('margin');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i === 0 ? 12 : -6
        }))
      );
    } else if (preset === 'stress') {
      setActivePreset('stress');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i % 2 === 0 ? 30 : -20
        }))
      );
    }
  };

  // Save current scenario snapshot
  const handleSaveSnapshot = () => {
    if (!result) return;
    const name = snapshotName.trim() || `Scenario #${savedSnapshots.length + 1} (${result.variance_pct >= 0 ? '+' : ''}${result.variance_pct}%)`;
    const newSnapshot: SavedScenarioSnapshot = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      target_metric: selectedTarget,
      dimension_col: selectedDim,
      levers: [...levers],
      projected_total: result.projected_total,
      net_delta: result.net_delta,
      variance_pct: result.variance_pct
    };

    const updated = [newSnapshot, ...savedSnapshots.slice(0, 7)];
    setSavedSnapshots(updated);
    setSnapshotName('');
    setIsSavingSnapshot(false);
    localStorage.setItem(`datanova_scenarios_${datasetId}`, JSON.stringify(updated));
  };

  const handleLoadSnapshot = (snapshot: SavedScenarioSnapshot) => {
    setSelectedTarget(snapshot.target_metric);
    if (snapshot.dimension_col) setSelectedDim(snapshot.dimension_col);
    setLevers(snapshot.levers);
    setActivePreset('custom');
  };

  const handleDeleteSnapshot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSnapshots.filter((s) => s.id !== id);
    setSavedSnapshots(updated);
    localStorage.setItem(`datanova_scenarios_${datasetId}`, JSON.stringify(updated));
  };

  // Copy Executive Brief to Clipboard
  const handleCopyBrief = () => {
    if (!result) return;
    const briefText = `
=== WHAT-IF SCENARIO EXECUTIVE BRIEF ===
Dataset: ${datasetName}
Target Metric: ${formatColumnName(result.target_metric)}
Baseline Total: $${result.baseline_total.toLocaleString()}
Projected Total: $${result.projected_total.toLocaleString()}
Net Variance: ${result.variance_pct >= 0 ? '+' : ''}${result.variance_pct}% (${result.net_delta >= 0 ? '+' : ''}$${result.net_delta.toLocaleString()})
Sensitivity Risk: ${result.risk_index}

Drivers Applied:
${levers.map((l) => ` • ${formatColumnName(l.column)}: ${l.shift_pct >= 0 ? '+' : ''}${l.shift_pct}%`).join('\n')}

AI Strategic Implications:
${result.ai_summary?.strategic_implications.map((imp) => ` • ${imp}`).join('\n') || 'N/A'}
`.trim();

    navigator.clipboard.writeText(briefText);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2500);
  };

  // Export JSON
  const handleExportData = () => {
    if (!result) return;
    const exportObj = {
      dataset: datasetName,
      dataset_id: datasetId,
      timestamp: new Date().toISOString(),
      scenario_simulation: result,
      levers_configured: levers
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `what-if-scenario-${datasetName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSegments = useMemo(() => {
    if (!result?.segment_breakdown) return [];
    if (!segmentSearch.trim()) return result.segment_breakdown;
    const q = segmentSearch.toLowerCase();
    return result.segment_breakdown.filter((s) =>
      s.segment.toLowerCase().includes(q)
    );
  }, [result, segmentSearch]);

  const candidateAvailableLevers = useMemo(() => {
    if (!config?.all_numeric_columns) return [];
    const activeCols = new Set(levers.map((l) => l.column));
    return config.all_numeric_columns.filter((c) => !activeCols.has(c));
  }, [config, levers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-2xl p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fadeIn min-h-screen">
      <div className="glass-3d-card border border-cyan-500/30 rounded-3xl w-full max-w-6xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(6,182,212,0.15)] flex flex-col max-h-[92vh] relative bg-[#070D1E]/95">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-blue-900/40 flex items-center justify-between bg-[#081020]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  What-If Scenario Sandbox
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30 font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  MULTIVARIATE ELASTICITY
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-mono border border-indigo-500/30 font-semibold">
                  MONTE CARLO READY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                Stress-test business drivers and simulate financial & volume outcomes for{' '}
                <span className="text-cyan-300 font-medium">{datasetName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {simulating && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Simulating...
              </span>
            )}

            {/* Export & Copy Brief */}
            <button
              type="button"
              onClick={handleCopyBrief}
              className="p-1.5 rounded-xl bg-slate-900/80 border border-blue-900/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
              title="Copy Executive Brief"
            >
              {copiedBrief ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleExportData}
              className="p-1.5 rounded-xl bg-slate-900/80 border border-blue-900/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
              title="Export Scenario JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition border border-transparent hover:border-slate-700 ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Discovering driver sensitivities & correlation matrix...</p>
          </div>
        ) : config ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Target Metric, Dimension Selectors & Strategic Presets */}
            <div className="p-4 rounded-2xl bg-[#0B152B]/80 border border-blue-900/50 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Target Metric
                  </label>
                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="bg-[#070D1E] border border-blue-800/70 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-cyan-400 focus:outline-none shadow-inner"
                  >
                    {config.all_numeric_columns.map((c) => (
                      <option key={c} value={c}>
                        {formatColumnName(c)} ({c})
                      </option>
                    ))}
                  </select>
                </div>

                {config.all_dimension_columns.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Breakdown Cohort
                    </label>
                    <select
                      value={selectedDim}
                      onChange={(e) => setSelectedDim(e.target.value)}
                      className="bg-[#070D1E] border border-blue-800/70 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:border-cyan-400 focus:outline-none shadow-inner"
                    >
                      {config.all_dimension_columns.map((d) => (
                        <option key={d} value={d}>
                          {formatColumnName(d)} ({d})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Strategic Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('growth')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    activePreset === 'growth'
                      ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'btn-3d-emerald text-emerald-300'
                  }`}
                  title="Expand volume and revenue drivers by +15%"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Expansion (+15%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('defense')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    activePreset === 'defense'
                      ? 'bg-rose-500/25 border-rose-400/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                      : 'btn-3d-danger text-rose-300'
                  }`}
                  title="Contraction stress test (-15%)"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Defensive (-15%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('margin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    activePreset === 'margin'
                      ? 'bg-cyan-500/25 border-cyan-400/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'btn-3d-cyan text-cyan-300'
                  }`}
                  title="Optimize price and compress cost drivers"
                >
                  <Gem className="w-3.5 h-3.5" />
                  <span>Margin Boost</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('stress')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    activePreset === 'stress'
                      ? 'bg-purple-500/25 border-purple-400/80 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                      : 'bg-purple-900/30 text-purple-300 border border-purple-800 hover:border-purple-600'
                  }`}
                  title="Extreme divergence scenario"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Stress Test</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('reset')}
                  title="Reset all levers to baseline (0%)"
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Impact Metric Summary Cards */}
            {result && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/40" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Current Baseline</span>
                  <div className="text-xl font-black text-white font-mono mt-1">
                    {formatCompactNumber(result.baseline_total)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">
                    Actual ${result.baseline_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${result.net_delta >= 0 ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`} />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Simulated Output</span>
                  <div
                    className={`text-xl font-black font-mono mt-1 ${
                      result.net_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatCompactNumber(result.projected_total)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">
                    Simulated ${result.projected_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${result.net_delta >= 0 ? 'bg-cyan-500/60' : 'bg-rose-500/60'}`} />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Net Delta (Δ)</span>
                  <div
                    className={`text-xl font-black font-mono mt-1 flex items-center gap-1.5 ${
                      result.net_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {result.net_delta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>
                      {result.net_delta >= 0 ? '+' : ''}{formatCompactNumber(result.net_delta)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                    {result.variance_pct >= 0 ? '+' : ''}{result.variance_pct}% variance
                  </span>
                </div>

                {/* Confidence Interval Card */}
                <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/40" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Confidence Band (P10-P90)</span>
                  <div className="text-sm font-black text-indigo-300 font-mono mt-1.5 flex items-center gap-1">
                    <span>{formatCompactNumber(result.confidence_intervals?.p10 ?? result.projected_total * 0.95)}</span>
                    <span className="text-slate-500">↔</span>
                    <span>{formatCompactNumber(result.confidence_intervals?.p90 ?? result.projected_total * 1.05)}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden flex">
                    <div className="bg-indigo-500/50 h-full w-full rounded-full" />
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono block mt-1">Monte Carlo 80% CI</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500/40" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sensitivity Risk</span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                        result.risk_index === 'Low'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : result.risk_index === 'Moderate'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {result.risk_index}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      {Math.abs(result.variance_pct)}% swing
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Stress threshold rating</span>
                </div>
              </div>
            )}

            {/* Split Layout: Driver Levers Deck (Left) & Analytics Visualization Hub (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Levers Slider Panel */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#081020]/80 border border-blue-900/50 space-y-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Operational Levers ({levers.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {levers.filter((l) => l.shift_pct !== 0).length} active shift(s)
                    </span>
                  </div>

                  {/* Add New Driver Dropdown */}
                  {candidateAvailableLevers.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 p-2 rounded-xl bg-[#0B152B]/60 border border-blue-900/40">
                      <select
                        value={selectedNewLever}
                        onChange={(e) => setSelectedNewLever(e.target.value)}
                        className="bg-[#070D1E] border border-blue-800/60 rounded-lg px-2.5 py-1 text-xs text-slate-200 flex-1 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="">+ Add numeric driver column...</option>
                        {candidateAvailableLevers.map((col) => (
                          <option key={col} value={col}>
                            {formatColumnName(col)} ({col})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddLever}
                        disabled={!selectedNewLever}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition disabled:opacity-40 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}

                  {/* Levers List */}
                  <div className="space-y-3 mt-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {levers.map((lever, idx) => {
                      const driverResult = result?.drivers_applied.find((d) => d.column === lever.column);
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#0D1B36]/70 border border-blue-800/50 space-y-2 hover:border-cyan-500/40 transition group relative"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white tracking-tight">
                                  {formatColumnName(lever.column)}
                                </span>
                                {lever.correlation !== undefined && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-cyan-300 border border-blue-500/20">
                                    r={lever.correlation > 0 ? '+' : ''}{lever.correlation}
                                  </span>
                                )}
                              </div>
                              {driverResult && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  Impact: <span className={driverResult.dollar_delta >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                    {driverResult.dollar_delta >= 0 ? '+' : ''}{formatCompactNumber(driverResult.dollar_delta)}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Direct Numeric Input */}
                              <div className="flex items-center bg-[#070D1E] border border-blue-900 rounded-lg px-1.5 py-0.5">
                                <input
                                  type="number"
                                  min="-50"
                                  max="50"
                                  step="1"
                                  value={lever.shift_pct}
                                  onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                                  className="bg-transparent text-xs font-mono font-bold text-cyan-300 w-10 text-right focus:outline-none"
                                />
                                <span className="text-[10px] font-mono text-slate-400 ml-0.5">%</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => adjustLeverDelta(idx, -5)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                                title="-5%"
                              >
                                -5%
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustLeverDelta(idx, 5)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                                title="+5%"
                              >
                                +5%
                              </button>

                              {/* Remove lever */}
                              {levers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLever(idx)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition ml-0.5"
                                  title="Remove lever"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <input
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              value={lever.shift_pct}
                              onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                              className="w-full accent-cyan-400 h-2 bg-slate-900 rounded-lg cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
                              <span>-50%</span>
                              <span className="text-slate-500 cursor-pointer hover:text-slate-300" onClick={() => handleSliderChange(idx, 0)}>
                                0% (Reset)
                              </span>
                              <span>+50%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scenario Snapshot Bar */}
                <div className="pt-3 border-t border-blue-900/40 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-cyan-400" />
                      <span>Snapshots</span>
                    </span>

                    {!isSavingSnapshot ? (
                      <button
                        type="button"
                        onClick={() => setIsSavingSnapshot(true)}
                        className="text-[10px] font-medium text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Save Current State</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <input
                          type="text"
                          placeholder="Snapshot name..."
                          value={snapshotName}
                          onChange={(e) => setSnapshotName(e.target.value)}
                          className="bg-[#070D1E] border border-blue-800 rounded-lg px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-cyan-400 w-32"
                        />
                        <button
                          type="button"
                          onClick={handleSaveSnapshot}
                          className="px-2 py-0.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-[10px]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSavingSnapshot(false)}
                          className="text-slate-400 hover:text-white text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {savedSnapshots.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 mt-1 no-scrollbar">
                      {savedSnapshots.map((snap) => (
                        <div
                          key={snap.id}
                          onClick={() => handleLoadSnapshot(snap)}
                          className="px-2 py-1 rounded-lg bg-[#070D1E] border border-blue-900/60 hover:border-cyan-500/40 cursor-pointer text-[10px] flex items-center gap-1.5 shrink-0 group transition"
                        >
                          <span className="font-medium text-slate-300 group-hover:text-cyan-300">
                            {snap.name}
                          </span>
                          <span className={`font-mono font-bold ${snap.variance_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {snap.variance_pct >= 0 ? '+' : ''}{snap.variance_pct}%
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                            className="text-slate-600 hover:text-rose-400 ml-0.5"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Analytics Visualization Hub (Right) */}
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#081020]/80 border border-blue-900/50 flex flex-col justify-between shadow-sm space-y-4">
                <div>
                  {/* Visualization Tabs */}
                  <div className="flex items-center justify-between border-b border-blue-900/40 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-[#070D1E] p-1 rounded-xl border border-blue-900/50">
                      <button
                        type="button"
                        onClick={() => setActiveTab('waterfall')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                          activeTab === 'waterfall'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Waterfall Attribution</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('comparison')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                          activeTab === 'comparison'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Scenario vs Baseline</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('segments')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                          activeTab === 'segments'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Cohort Impact</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('matrix')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                          activeTab === 'matrix'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5" />
                        <span>Sensitivity Matrix</span>
                      </button>
                    </div>

                    {result && (
                      <span className={`text-[11px] font-mono font-bold ${result.net_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result.net_delta >= 0 ? '+' : ''}{result.variance_pct}% Net
                      </span>
                    )}
                  </div>

                  {/* Tab Content Display */}
                  <div className="mt-3">
                    {/* TAB 1: Waterfall Attribution Chart */}
                    {activeTab === 'waterfall' && result && (
                      <div className="space-y-2">
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={result.waterfall_steps}
                              margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                            >
                              <defs>
                                <linearGradient id="baseBar" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="posBar" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                                </linearGradient>
                                <linearGradient id="negBar" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                                </linearGradient>
                                <linearGradient id="totalBar" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.7} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                              <XAxis
                                dataKey="step"
                                stroke="#64748b"
                                tickMargin={6}
                                tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }}
                              />
                              <YAxis
                                stroke="#64748b"
                                width={65}
                                tickFormatter={(val) => formatCompactNumber(val)}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                              />
                              <Tooltip
                                formatter={(value: any) => [formatCompactNumber(Number(value)), 'Contribution']}
                                contentStyle={{
                                  backgroundColor: 'rgba(7, 13, 30, 0.96)',
                                  borderColor: 'rgba(6, 182, 212, 0.4)',
                                  borderRadius: '14px',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                                  color: '#fff',
                                  fontSize: '12px'
                                }}
                              />
                              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {result.waterfall_steps.map((entry, index) => {
                                  let fill = 'url(#baseBar)';
                                  if (entry.type === 'positive') fill = 'url(#posBar)';
                                  else if (entry.type === 'negative') fill = 'url(#negBar)';
                                  else if (entry.type === 'total') fill = 'url(#totalBar)';
                                  return <Cell key={`cell-${index}`} fill={fill} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Baseline
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Positive Lever
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Drag Lever
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" /> Projected Total
                          </span>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Direct Comparison Chart */}
                    {activeTab === 'comparison' && result && (
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={result.comparison_chart}
                            margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                          >
                            <defs>
                              <linearGradient id="baselineBar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                              </linearGradient>
                              <linearGradient id="simulatedBarGreen" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7} />
                              </linearGradient>
                              <linearGradient id="simulatedBarRed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="#64748b"
                              tickMargin={6}
                              tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 500 }}
                            />
                            <YAxis
                              stroke="#64748b"
                              width={65}
                              tickFormatter={(val) => formatCompactNumber(val)}
                              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [formatCompactNumber(Number(value)), 'Total Output']}
                              contentStyle={{
                                backgroundColor: 'rgba(7, 13, 30, 0.96)',
                                borderColor: 'rgba(6, 182, 212, 0.4)',
                                borderRadius: '14px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                                color: '#fff',
                                fontSize: '12px'
                              }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                              {result.comparison_chart.map((entry, index) => {
                                const fill =
                                  index === 0
                                    ? 'url(#baselineBar)'
                                    : result.net_delta >= 0
                                    ? 'url(#simulatedBarGreen)'
                                    : 'url(#simulatedBarRed)';
                                return <Cell key={`cell-${index}`} fill={fill} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* TAB 3: Cohort & Segment Breakdown */}
                    {activeTab === 'segments' && result && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                            Impact across {formatColumnName(selectedDim)}
                          </span>
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search segments..."
                              value={segmentSearch}
                              onChange={(e) => setSegmentSearch(e.target.value)}
                              className="bg-[#070D1E] border border-blue-900/80 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-400 w-36"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                          {filteredSegments.map((seg, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#070D1E] border border-blue-900/40 hover:border-blue-700/60 transition"
                            >
                              <span className="font-medium text-slate-200 truncate max-w-[150px]" title={seg.segment}>
                                {formatSegmentId(seg.segment)}
                              </span>
                              <div className="flex items-center gap-3 font-mono text-[11px]">
                                <span className="text-slate-400">
                                  {formatCompactNumber(seg.baseline)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <span className={seg.delta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                  {formatCompactNumber(seg.projected)}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                    seg.delta >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {seg.variance_pct >= 0 ? '+' : ''}{seg.variance_pct}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 4: 2D Sensitivity Matrix Heatmap */}
                    {activeTab === 'matrix' && result?.sensitivity_matrix && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>
                            X: <strong className="text-cyan-300">{formatColumnName(result.sensitivity_matrix.lever_x)}</strong>
                          </span>
                          <span>
                            Y: <strong className="text-indigo-300">{formatColumnName(result.sensitivity_matrix.lever_y)}</strong>
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-center border-collapse text-[10px] font-mono">
                            <thead>
                              <tr>
                                <th className="p-1.5 text-slate-500 text-left">Y \ X</th>
                                {result.sensitivity_matrix.x_shifts.map((x) => (
                                  <th key={x} className="p-1.5 text-cyan-300 font-bold">
                                    {x >= 0 ? '+' : ''}{x}%
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.sensitivity_matrix.grid.map((row, rowIdx) => {
                                const yVal = result.sensitivity_matrix?.y_shifts[rowIdx];
                                return (
                                  <tr key={rowIdx}>
                                    <td className="p-1.5 text-indigo-300 font-bold text-left">
                                      {yVal !== undefined && yVal >= 0 ? '+' : ''}{yVal}%
                                    </td>
                                    {row.map((cell, colIdx) => {
                                      const isPos = cell.variance_pct >= 0;
                                      const intensity = Math.min(1, Math.abs(cell.variance_pct) / 25);
                                      const bg = isPos
                                        ? `rgba(16, 185, 129, ${0.12 + intensity * 0.35})`
                                        : `rgba(244, 63, 94, ${0.12 + intensity * 0.35})`;
                                      const textCol = isPos ? '#6ee7b7' : '#fda4af';

                                      return (
                                        <td
                                          key={colIdx}
                                          className="p-1.5 rounded border border-blue-900/30 transition hover:scale-105"
                                          style={{ backgroundColor: bg, color: textCol }}
                                          title={`Projected: $${cell.projected.toLocaleString()} (${cell.variance_pct >= 0 ? '+' : ''}${cell.variance_pct}%)`}
                                        >
                                          <div className="font-bold">{formatCompactNumber(cell.projected)}</div>
                                          <div className="text-[9px] opacity-80">
                                            {cell.variance_pct >= 0 ? '+' : ''}{cell.variance_pct}%
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Executive Synthesis Box */}
                {result?.ai_summary && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#070D1E] to-cyan-950/30 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <h5 className="text-xs font-bold text-white">
                          {result.ai_summary.headline}
                        </h5>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-300 font-semibold">
                        AI SYNTHESIS
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-300">
                      {result.ai_summary.strategic_implications.map((imp, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{imp}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-blue-900/30 flex items-center justify-between">
                      <span>{result.ai_summary.risk_assessment}</span>
                      <button
                        type="button"
                        onClick={handleCopyBrief}
                        className="text-cyan-400 hover:text-cyan-300 font-medium underline flex items-center gap-1"
                      >
                        {copiedBrief ? 'Copied!' : 'Copy Summary'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
