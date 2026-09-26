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
  Percent,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { api } from '../../services/api';
import { ScenarioConfig, ScenarioSimulationResult } from '../../types';

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
  const [levers, setLevers] = useState<Array<{ column: string; shift_pct: number }>>([]);
  const [result, setResult] = useState<ScenarioSimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [segmentSearch, setSegmentSearch] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'growth' | 'defense' | 'margin' | 'custom'>('custom');

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
          shift_pct: 0
        }));
        if (initialLevers.length === 0 && data.target_metric) {
          initialLevers.push({ column: data.target_metric, shift_pct: 0 });
        }
        setLevers(initialLevers);
        setActivePreset('custom');
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
          drivers: levers,
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

    const timer = setTimeout(runSim, 120);
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

  const applyPreset = (preset: 'growth' | 'defense' | 'margin' | 'reset') => {
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
          shift_pct: i === 0 ? 15 : 8
        }))
      );
    } else if (preset === 'defense') {
      setActivePreset('defense');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i === 0 ? -15 : -8
        }))
      );
    } else if (preset === 'margin') {
      setActivePreset('margin');
      setLevers((prev) =>
        prev.map((l, i) => ({
          ...l,
          shift_pct: i === 0 ? 10 : -5
        }))
      );
    }
  };

  const filteredSegments = useMemo(() => {
    if (!result?.segment_breakdown) return [];
    if (!segmentSearch.trim()) return result.segment_breakdown;
    const q = segmentSearch.toLowerCase();
    return result.segment_breakdown.filter((s) =>
      s.segment.toLowerCase().includes(q)
    );
  }, [result, segmentSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-2xl p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fadeIn min-h-screen">
      <div className="glass-3d-card border border-cyan-500/30 rounded-3xl w-full max-w-5xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(6,182,212,0.15)] flex flex-col max-h-[90vh] relative bg-[#070D1E]/95">
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
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                Stress-test business drivers and simulate financial & volume outcomes for <span className="text-cyan-300 font-medium">{datasetName}</span>
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition border border-transparent hover:border-slate-700"
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
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
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
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Strategic Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('growth')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    activePreset === 'growth'
                      ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'btn-3d-emerald text-emerald-300'
                  }`}
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
                >
                  <Gem className="w-3.5 h-3.5" />
                  <span>Margin Optimization</span>
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                      {result.risk_index} Risk
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      {Math.abs(result.variance_pct)}% swing
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Stress threshold rating</span>
                </div>
              </div>
            )}

            {/* Split Layout: Driver Levers (Left) & Scenario Impact Visualization (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Levers Slider Panel */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-[#081020]/80 border border-blue-900/50 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Interactive Elasticity Levers</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {levers.filter((l) => l.shift_pct !== 0).length} active shift(s)
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                  {levers.map((lever, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#0D1B36]/70 border border-blue-800/50 space-y-2.5 hover:border-cyan-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white tracking-tight block">
                            {formatColumnName(lever.column)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            column: {lever.column}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustLeverDelta(idx, -5)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                            title="-5%"
                          >
                            -5%
                          </button>
                          <span
                            className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border ${
                              lever.shift_pct > 0
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : lever.shift_pct < 0
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            {lever.shift_pct >= 0 ? '+' : ''}{lever.shift_pct}%
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustLeverDelta(idx, 5)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                            title="+5%"
                          >
                            +5%
                          </button>
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
                          <span className="text-slate-500">0% Baseline</span>
                          <span>+50%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Comparison Panel */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-[#081020]/80 border border-blue-900/50 flex flex-col justify-between shadow-sm space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-blue-900/40 pb-2.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Scenario Impact Comparison</span>
                    </h4>
                    {result && (
                      <span className={`text-[11px] font-mono font-bold ${result.net_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result.net_delta >= 0 ? '+' : ''}{result.variance_pct}% Net
                      </span>
                    )}
                  </div>

                  <div className="h-52 w-full mt-3">
                    {result && (
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
                    )}
                  </div>
                </div>

                {/* Sub-segment Breakdown Table */}
                {result && result.segment_breakdown.length > 0 && (
                  <div className="pt-3 border-t border-blue-900/40">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <span>Cohort Impact by {formatColumnName(selectedDim)}</span>
                      </span>

                      {result.segment_breakdown.length > 4 && (
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={segmentSearch}
                            onChange={(e) => setSegmentSearch(e.target.value)}
                            className="bg-[#070D1E] border border-blue-900/80 rounded-lg pl-6 pr-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-cyan-400 w-24"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {filteredSegments.slice(0, 10).map((seg, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-[#070D1E] border border-blue-900/40 hover:border-blue-700/60 transition"
                        >
                          <span className="font-medium text-slate-200 truncate max-w-[130px]" title={seg.segment}>
                            {formatSegmentId(seg.segment)}
                          </span>
                          <div className="flex items-center gap-2.5 font-mono text-[11px]">
                            <span className="text-slate-400">
                              {formatCompactNumber(seg.baseline)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className={seg.delta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {formatCompactNumber(seg.projected)}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
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
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
