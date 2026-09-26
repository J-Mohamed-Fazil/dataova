import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Sliders,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Database
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { ForecastResult } from '../../types';

import { Card3D } from '../common/Card3D';

export const ForecastView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [forecastData, setForecastData] = useState<ForecastResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(6);
  const [activeScenario, setActiveScenario] = useState<'all' | 'baseline' | 'bull' | 'bear'>('all');
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const availableTables = forecastData?.available_tables || currentDataset?.tables?.map(t => ({
    table_name: t.table_name,
    row_count: t.row_count,
    columns: t.columns.map(c => c.column_name),
    numeric_columns: t.columns.filter(c => c.data_type === 'numeric' && !c.is_identifier).map(c => c.column_name)
  })) || [];

  // Find active table metadata to derive candidate metrics
  const activeTableMeta = availableTables.find(t => t.table_name === (selectedTable || forecastData?.table_name)) 
    || availableTables[0];

  const candidateMetrics = activeTableMeta?.numeric_columns && activeTableMeta.numeric_columns.length > 0
    ? activeTableMeta.numeric_columns
    : (currentDataset?.tables?.find(t => t.table_name === (selectedTable || forecastData?.table_name))?.columns
        .filter(c => c.data_type === 'numeric' && !c.is_identifier)
        .map(c => c.column_name) || []);

  const fetchForecast = async (
    metric?: string, 
    horizon: number = selectedHorizon,
    tableName?: string
  ) => {
    if (!currentDataset) return;
    try {
      setIsLoading(true);
      setError(null);
      const targetTable = tableName !== undefined ? tableName : selectedTable;
      const targetMetric = metric !== undefined ? metric : selectedMetric;

      const res = await api.getForecast(currentDataset.id, {
        metric: targetMetric || undefined,
        horizon: horizon,
        table_name: targetTable || undefined
      });
      setForecastData(res);
      if (res.table_name) {
        setSelectedTable(res.table_name);
      }
      if (res.metric) {
        setSelectedMetric(res.metric);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate forecast projection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [currentDataset?.id]);

  const handleTableChange = (table: string) => {
    setSelectedTable(table);
    setSelectedMetric('');
    fetchForecast(undefined, selectedHorizon, table);
  };

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric);
    fetchForecast(metric, selectedHorizon, selectedTable);
  };

  const handleHorizonChange = (horizon: number) => {
    setSelectedHorizon(horizon);
    fetchForecast(selectedMetric, horizon, selectedTable);
  };

  // Prepare combined timeline dataset for Recharts
  const chartData = React.useMemo(() => {
    if (!forecastData || !forecastData.historical) return [];
    const combined: any[] = [];

    // Historical Points
    forecastData.historical.forEach((h) => {
      combined.push({
        period: h.period,
        actual: h.actual,
        trend: h.trend,
        isForecast: false
      });
    });

    // Bridge gap from last historical to first forecast point
    if (forecastData.historical.length > 0 && forecastData.forecast.length > 0) {
      const lastHist = forecastData.historical[forecastData.historical.length - 1];
      combined[combined.length - 1].forecast = lastHist.actual;
      combined[combined.length - 1].bull_scenario = lastHist.actual;
      combined[combined.length - 1].bear_scenario = lastHist.actual;
      combined[combined.length - 1].upper_95 = lastHist.actual;
      combined[combined.length - 1].lower_95 = lastHist.actual;
    }

    // Forecast Points
    forecastData.forecast.forEach((f) => {
      combined.push({
        period: f.period,
        forecast: f.forecast,
        bull_scenario: f.bull_scenario,
        bear_scenario: f.bear_scenario,
        upper_95: f.upper_95,
        lower_95: f.lower_95,
        isForecast: true
      });
    });

    return combined;
  }, [forecastData]);

  if (isLoading && !forecastData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center animate-spin">
          <RefreshCw className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Fitting 3D Time-Series Models...</h3>
          <p className="text-xs text-slate-400 mt-1">Calibrating Holt-Winters damped linear trend & statistical uncertainty bounds</p>
        </div>
      </div>
    );
  }

  if (error && !forecastData) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Predictive Studio Notice</h3>
        <p className="text-sm text-slate-300 leading-relaxed">{error}</p>

        {availableTables.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-xs text-slate-400">Select a table with numeric metrics:</span>
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              className="bg-[#0B1528] border border-blue-900/60 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              {availableTables.map(t => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.numeric_columns.length} numeric metrics)
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => fetchForecast()}
          className="btn-3d-primary px-4 py-2 text-white text-xs font-semibold rounded-xl"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  const summary = forecastData?.summary;

  return (
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full overflow-y-auto perspective-1000">
      {/* Header Banner - 3D Cybernetic Theme */}
      <div className="glass-3d-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl p-4 sm:p-5 border border-slate-700/80 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
        
        <div className="pt-2 space-y-1 translate-z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md badge-neon-blue text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              AI Predictive Studio
            </span>
            <span className="text-xs text-slate-400">
              Deterministic Trend Extrapolation & Uncertainty Bounds
            </span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            Time-Series Forecasting & Scenario Simulation
          </h1>
        </div>

        {/* Control Selectors */}
        <div className="flex flex-wrap items-center gap-3 translate-z-15">
          {/* Table Selector */}
          {availableTables.length > 1 && (
            <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-3 py-1.5 text-xs shadow-inner">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 font-medium">Table:</span>
              <select
                value={selectedTable}
                onChange={(e) => handleTableChange(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                {availableTables.map(t => (
                  <option key={t.table_name} value={t.table_name} className="bg-[#0B1528] text-white">
                    {t.table_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Metric Selector */}
          <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-3 py-1.5 text-xs shadow-inner">
            <span className="text-slate-400 font-medium">Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              {candidateMetrics.map(m => (
                <option key={m} value={m} className="bg-[#0B1528] text-white">
                  {m.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-3 py-1.5 text-xs shadow-inner">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Horizon:</span>
            <select
              data-tour="forecast-horizon-select"
              value={selectedHorizon}
              onChange={(e) => handleHorizonChange(Number(e.target.value))}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value={3} className="bg-[#0B1528] text-white">3 Periods</option>
              <option value={6} className="bg-[#0B1528] text-white">6 Periods</option>
              <option value={12} className="bg-[#0B1528] text-white">12 Periods</option>
              <option value={24} className="bg-[#0B1528] text-white">24 Periods</option>
            </select>
          </div>

          <button
            onClick={() => fetchForecast(selectedMetric, selectedHorizon, selectedTable)}
            disabled={isLoading}
            className="btn-3d-secondary p-2 rounded-xl text-slate-300 hover:text-white"
            title="Re-run forecast"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Telemetry Grid in 3D */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-4 sm:p-5 pt-5 sm:pt-6 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[135px]"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 shadow-sm" />
            <div className="pt-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono translate-z-10 block">Current Baseline</span>
              <div className="text-2xl lg:text-3xl font-black text-white translate-z-30 drop-shadow-md font-telemetry">
                {summary.last_actual.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 translate-z-10 mt-auto">Most recent observation</p>
            <div className="absolute top-4.5 right-3.5 w-8 h-8 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center text-cyan-300 translate-z-20 shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
          </Card3D>

          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-5 pt-6 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[142px]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 shadow-sm ${
              summary.projected_change_pct >= 0
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                : 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500'
            }`} />
            <div className="pt-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono translate-z-10 block">Horizon Target</span>
              <div className="text-2xl lg:text-3xl font-black text-white flex items-center flex-wrap gap-2 translate-z-30 drop-shadow-md font-telemetry">
                <span>{summary.horizon_target.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-bold flex items-center shadow-sm ${
                  summary.projected_change_pct >= 0 ? 'badge-quantum-emerald' : 'badge-quantum-rose'
                }`}>
                  {summary.projected_change_pct >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {summary.projected_change_pct > 0 ? `+${summary.projected_change_pct}%` : `${summary.projected_change_pct}%`}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 translate-z-10 mt-auto">Target over {forecastData?.horizon} {forecastData?.frequency.toLowerCase()}s</p>
            <div className={`absolute top-4.5 right-3.5 w-8 h-8 rounded-xl border flex items-center justify-center translate-z-20 shadow-sm ${
              summary.projected_change_pct >= 0
                ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}>
              {summary.projected_change_pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </Card3D>

          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-5 pt-6 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[142px]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 shadow-sm ${
              summary.status_color === 'rose'
                ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500'
                : summary.status_color === 'amber'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500'
                : summary.status_color === 'emerald'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                : 'bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-500'
            }`} />
            <div className="pt-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono translate-z-10 block">Trajectory Momentum</span>
              <div className={`text-lg lg:text-xl font-black translate-z-25 drop-shadow-md leading-snug truncate ${
                summary.status_color === 'rose'
                  ? 'text-rose-400'
                  : summary.status_color === 'amber'
                  ? 'text-amber-400'
                  : summary.status_color === 'emerald'
                  ? 'text-emerald-400'
                  : summary.status_color === 'teal'
                  ? 'text-teal-300'
                  : 'text-cyan-300'
              }`} title={summary.trajectory}>
                {summary.trajectory}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 translate-z-10 mt-auto">Volatility Index: {summary.volatility_cv}%</p>
            <div className={`absolute top-4.5 right-3.5 w-8 h-8 rounded-xl border flex items-center justify-center translate-z-20 shadow-sm ${
              summary.status_color === 'rose'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : summary.status_color === 'amber'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : summary.status_color === 'emerald'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
            }`}>
              <Zap className="w-4 h-4" />
            </div>
          </Card3D>

          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-5 pt-6 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[142px]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 shadow-sm ${
              summary.confidence_score >= 70
                ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400'
                : summary.confidence_score >= 50
                ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
            }`} />
            <div className="pt-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 translate-z-10 block">Model Reliability</span>
              <div className="text-2xl lg:text-3xl font-black text-blue-200 flex items-center flex-wrap gap-2 translate-z-30 drop-shadow-md">
                <span>{summary.confidence_score}%</span>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold bg-slate-800/80 border border-slate-700/60 text-slate-300 shadow-sm">
                  R²: {summary.r_squared}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 translate-z-10 mt-auto">Holt Damped Linear Smoothing</p>
            <div className={`absolute top-4.5 right-3.5 w-8 h-8 rounded-xl border flex items-center justify-center translate-z-20 shadow-sm ${
              summary.confidence_score >= 70
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : summary.confidence_score >= 50
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </Card3D>
        </div>
      )}

      {/* Main Interactive Forecast Chart Card */}
      <div data-tour="forecast-chart" className="glass-3d-card relative overflow-hidden rounded-2xl p-3.5 sm:p-5 md:p-6 space-y-4 border border-slate-700/80 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-950/80 pb-3.5">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 drop-shadow-sm">
              <span>{forecastData?.metric_display} Projections with Uncertainty Intervals</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Solid line displays verified historical actuals; dashed lines show projected model scenarios.
            </p>
          </div>

          {/* 3D Chart View Toggles */}
          <div className="flex items-center gap-2">
            <div data-tour="forecast-scenarios" className="tabs-3d-rail">
              <button
                onClick={() => setActiveScenario('all')}
                className={`tab-3d-item ${activeScenario === 'all' ? 'tab-3d-item-active' : ''}`}
              >
                All Paths
              </button>
              <button
                onClick={() => setActiveScenario('baseline')}
                className={`tab-3d-item ${activeScenario === 'baseline' ? 'tab-3d-item-active' : ''}`}
              >
                Baseline
              </button>
              <button
                onClick={() => setActiveScenario('bull')}
                className={`tab-3d-item ${activeScenario === 'bull' ? 'tab-3d-item-active' : ''}`}
              >
                Bull (+15%)
              </button>
              <button
                onClick={() => setActiveScenario('bear')}
                className={`tab-3d-item ${activeScenario === 'bear' ? 'tab-3d-item-active' : ''}`}
              >
                Bear (-15%)
              </button>
            </div>

            <button
              onClick={() => setShowConfidenceBands(!showConfidenceBands)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                showConfidenceBands
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-[#081020] border-blue-950 text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>95% Band</span>
            </button>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
              <defs>
                <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis dataKey="period" stroke="#64748B" fontSize={11} tickLine={false} tickMargin={8} />
              <YAxis 
                stroke="#64748B" 
                fontSize={11} 
                tickLine={false}
                tickMargin={8}
                width={48}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#070F22',
                  borderColor: '#1E3A8A',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  fontSize: '12px',
                  color: '#FFFFFF'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />

              {/* Confidence Band Area */}
              {showConfidenceBands && (
                <Area
                  type="monotone"
                  dataKey="upper_95"
                  stroke="none"
                  fill="url(#confidenceBand)"
                  name="95% Upper Bound"
                />
              )}

              {/* Historical Actuals */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#38BDF8"
                strokeWidth={3}
                dot={{ r: 4, fill: '#0284C7', stroke: '#38BDF8', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Historical Actual"
              />

              {/* Baseline Forecast Line */}
              {(activeScenario === 'all' || activeScenario === 'baseline') && (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#1D4ED8', stroke: '#60A5FA', strokeWidth: 1.5 }}
                  name="Baseline Forecast"
                />
              )}

              {/* Bull Case */}
              {(activeScenario === 'all' || activeScenario === 'bull') && (
                <Line
                  type="monotone"
                  dataKey="bull_scenario"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Bull Case (+15%)"
                />
              )}

              {/* Bear Case */}
              {(activeScenario === 'all' || activeScenario === 'bear') && (
                <Line
                  type="monotone"
                  dataKey="bear_scenario"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Bear Case (-15%)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Prescriptive Recommendations & Forecast Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescriptive Strategic Outlook */}
        <div className="lg:col-span-1 glass-card-premium relative overflow-hidden rounded-2xl p-5 space-y-4 border border-slate-700/70 shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Strategic Model Takeaways
            </h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {forecastData?.recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#081020] border border-blue-950 space-y-1">
                  <div dangerouslySetInnerHTML={{
                    __html: rec.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                  }} />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-blue-950/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                Computed from {forecastData?.historical_count} observations in table <strong>{forecastData?.table_name}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Granular Projection Table */}
        <div className="lg:col-span-2 glass-3d-card table-3d-container relative overflow-hidden rounded-2xl p-3.5 sm:p-5 space-y-3 border border-slate-700/80 shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
          <div className="pt-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white tracking-tight">Detailed Horizon Matrix</h3>
            <span className="text-xs text-cyan-400 font-mono font-bold">{forecastData?.forecast.length} Projected Steps</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="table-3d-header text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 rounded-l-lg">Period</th>
                  <th className="px-3 py-2.5 text-right font-bold text-white">Baseline Forecast</th>
                  <th className="px-3 py-2.5 text-right font-bold text-emerald-400">Bull Case</th>
                  <th className="px-3 py-2.5 text-right font-bold text-rose-400">Bear Case</th>
                  <th className="px-3 py-2.5 text-right rounded-r-lg font-bold text-blue-300">95% Uncertainty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-950/60">
                {forecastData?.forecast.map((pt, i) => (
                  <tr key={i} className="hover:bg-blue-950/30 transition">
                    <td className="px-3 py-2.5 font-semibold text-white">{pt.period}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-200">
                      {pt.forecast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-300">
                      {pt.bull_scenario.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-300">
                      {pt.bear_scenario.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                      [{pt.lower_95.toLocaleString(undefined, { maximumFractionDigits: 1 })} - {pt.upper_95.toLocaleString(undefined, { maximumFractionDigits: 1 })}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
