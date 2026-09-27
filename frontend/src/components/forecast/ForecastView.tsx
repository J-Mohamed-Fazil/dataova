import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  SlidersHorizontal,
  Gauge,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Database,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  Download,
  Copy,
  Search,
  Target
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

// Uncertainty Band Width presets (5% to 95%)
export const BANDWIDTH_PRESETS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95];

// Critical normal distribution z-scores for two-sided confidence intervals
const Z_TABLE: Record<number, number> = {
  5: 0.0627,
  10: 0.1257,
  20: 0.2533,
  30: 0.3853,
  40: 0.5244,
  50: 0.6745,
  60: 0.8416,
  70: 1.0364,
  80: 1.2816,
  90: 1.6449,
  95: 1.9600,
  99: 2.5758,
};

// High-precision normal quantile approximation for any percentage
export function getZScore(confidencePct: number): number {
  if (Z_TABLE[confidencePct] !== undefined) return Z_TABLE[confidencePct];
  const p = 0.5 + (confidencePct / 200);
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549738039699688e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return q * (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) /
               (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  }
  const r = p < 0.5 ? p : 1 - p;
  const s = Math.log(-Math.log(r));
  const z = c[0] + s * (c[1] + s * (c[2] + s * (c[3] + s * (c[4] + s * c[5])))) /
            (1 + s * (d[0] + s * (d[1] + s * (d[2] + s * d[3]))));
  return p < 0.5 ? -z : z;
}

// Custom Glassmorphic Tooltip Component for High-Precision Cybernetic Rendering
const ForecastCustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const pt = payload[0]?.payload || {};
  const isForecast = pt.isForecast;

  return (
    <div className="p-3.5 rounded-2xl bg-[#070F22]/95 border border-cyan-500/50 shadow-2xl backdrop-blur-xl text-xs space-y-2 z-50 min-w-[210px]">
      <div className="flex items-center justify-between gap-2 border-b border-blue-900/60 pb-1.5">
        <span className="font-bold text-white font-mono text-[12px]">{label}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
          isForecast ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800' : 'bg-blue-950/80 text-blue-300 border border-blue-800'
        }`}>
          {isForecast ? 'Projection' : 'Historical'}
        </span>
      </div>

      <div className="space-y-1.5 font-mono text-[11px]">
        {pt.actual !== undefined && (
          <div className="flex items-center justify-between text-sky-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Actual:</span>
            </span>
            <span className="font-bold text-white">{pt.actual.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {pt.forecast !== undefined && isForecast && (
          <div className="flex items-center justify-between text-blue-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Baseline:</span>
            </span>
            <span className="font-bold text-white">{pt.forecast.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {pt.upper_bound !== undefined && pt.lower_bound !== undefined && isForecast && (
          <div className="flex items-center justify-between text-cyan-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>CI Envelope:</span>
            </span>
            <span className="font-semibold text-cyan-200">
              [{pt.lower_bound.toLocaleString(undefined, { maximumFractionDigits: 1 })} - {pt.upper_bound.toLocaleString(undefined, { maximumFractionDigits: 1 })}]
            </span>
          </div>
        )}

        {pt.bull_scenario !== undefined && isForecast && (
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Bull Case:</span>
            </span>
            <span className="font-semibold">{pt.bull_scenario.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {pt.bear_scenario !== undefined && isForecast && (
          <div className="flex items-center justify-between text-rose-400">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Bear Case:</span>
            </span>
            <span className="font-semibold">{pt.bear_scenario.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ForecastView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [forecastData, setForecastData] = useState<ForecastResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(6);
  const [selectedBandwidth, setSelectedBandwidth] = useState<number>(95);
  const [scenarioSpread, setScenarioSpread] = useState<number>(15); // default ±15%
  const [activeScenario, setActiveScenario] = useState<'all' | 'baseline' | 'bull' | 'bear'>('all');
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);
  const [isBandPopoverOpen, setIsBandPopoverOpen] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [copiedTakeaways, setCopiedTakeaways] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const bandPopoverRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);

  // Measure chart container width dynamically to guarantee Recharts never mounts with 0 width
  useEffect(() => {
    const updateSize = () => {
      if (chartWrapperRef.current) {
        const w = chartWrapperRef.current.clientWidth || chartWrapperRef.current.getBoundingClientRect().width;
        if (w > 0) {
          setChartWidth(Math.floor(w));
        }
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    if (chartWrapperRef.current) {
      observer.observe(chartWrapperRef.current);
    }
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [forecastData]);

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
    tableName?: string,
    bandwidth: number = selectedBandwidth
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
        table_name: targetTable || undefined,
        confidence_level: bandwidth
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

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bandPopoverRef.current && !bandPopoverRef.current.contains(e.target as Node)) {
        setIsBandPopoverOpen(false);
      }
    };
    if (isBandPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBandPopoverOpen]);

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

  const handleBandwidthSelect = (val: number) => {
    setSelectedBandwidth(val);
    if (!showConfidenceBands) {
      setShowConfidenceBands(true);
    }
  };

  // Compute z-score for the selected bandwidth dynamically
  const zScore = useMemo(() => getZScore(selectedBandwidth), [selectedBandwidth]);

  // Prepare combined timeline dataset for Recharts with native ci_range Area
  const chartData = useMemo(() => {
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

    const bullMultiplier = 1.0 + (scenarioSpread / 100);
    const bearMultiplier = Math.max(0.01, 1.0 - (scenarioSpread / 100));

    // Bridge gap from last historical to first forecast point so line connects smoothly
    if (forecastData.historical.length > 0 && forecastData.forecast.length > 0) {
      const lastHist = forecastData.historical[forecastData.historical.length - 1];
      const lastIdx = combined.length - 1;
      combined[lastIdx].forecast = lastHist.actual;
      combined[lastIdx].bull_scenario = lastHist.actual;
      combined[lastIdx].bear_scenario = lastHist.actual;
      combined[lastIdx].upper_bound = lastHist.actual;
      combined[lastIdx].lower_bound = lastHist.actual;
      combined[lastIdx].ci_range = [lastHist.actual, lastHist.actual];
    }

    // Forecast Points with dynamic bandwidth adjustment
    forecastData.forecast.forEach((f) => {
      const unc = f.uncertainty_growth ?? (f.upper_95 !== undefined && f.forecast !== undefined ? Math.abs(f.upper_95 - f.forecast) / 1.96 : 0);
      const margin = zScore * unc;
      const upperBound = Math.round((f.forecast + margin) * 100) / 100;
      const lowerBound = Math.round(Math.max(0, f.forecast - margin) * 100) / 100;
      const bullVal = Math.round(f.forecast * bullMultiplier * 100) / 100;
      const bearVal = Math.round(f.forecast * bearMultiplier * 100) / 100;

      combined.push({
        period: f.period,
        forecast: f.forecast,
        bull_scenario: bullVal,
        bear_scenario: bearVal,
        upper_bound: upperBound,
        lower_bound: lowerBound,
        ci_range: [lowerBound, upperBound],
        isForecast: true
      });
    });

    return combined;
  }, [forecastData, zScore, scenarioSpread]);

  // Filtered forecast list for detailed table
  const filteredForecast = useMemo(() => {
    if (!forecastData?.forecast) return [];
    if (!tableSearch.trim()) return forecastData.forecast;
    return forecastData.forecast.filter(pt =>
      pt.period.toLowerCase().includes(tableSearch.toLowerCase())
    );
  }, [forecastData, tableSearch]);

  // Export forecast projection data to CSV
  const handleExportCSV = () => {
    if (!forecastData) return;
    const headers = [
      'Period',
      'Step',
      'Baseline Forecast',
      `Bull Case (+${scenarioSpread}%)`,
      `Bear Case (-${scenarioSpread}%)`,
      `Lower Bound (${selectedBandwidth}% CI)`,
      `Upper Bound (${selectedBandwidth}% CI)`
    ];
    const bullMultiplier = 1.0 + (scenarioSpread / 100);
    const bearMultiplier = Math.max(0.01, 1.0 - (scenarioSpread / 100));

    const rows = forecastData.forecast.map((pt) => {
      const unc = pt.uncertainty_growth ?? (pt.upper_95 !== undefined && pt.forecast !== undefined ? Math.abs(pt.upper_95 - pt.forecast) / 1.96 : 0);
      const margin = zScore * unc;
      const rowUpper = Math.round((pt.forecast + margin) * 100) / 100;
      const rowLower = Math.round(Math.max(0, pt.forecast - margin) * 100) / 100;
      const bullVal = Math.round(pt.forecast * bullMultiplier * 100) / 100;
      const bearVal = Math.round(pt.forecast * bearMultiplier * 100) / 100;

      return [
        `"${pt.period}"`,
        pt.step,
        pt.forecast,
        bullVal,
        bearVal,
        rowLower,
        rowUpper
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${forecastData.metric}_forecast_${selectedBandwidth}pct_ci.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTakeaways = () => {
    if (!forecastData) return;
    const text = forecastData.recommendations.map(r => r.replace(/\*\*/g, '')).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedTakeaways(true);
    setTimeout(() => setCopiedTakeaways(false), 2000);
  };

  if (isLoading && !forecastData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center animate-spin shadow-lg shadow-cyan-500/20">
          <RefreshCw className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            Fitting 3D Time-Series Models...
          </h3>
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
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      {/* Header Banner - 3D Cybernetic Theme */}
      <div className="glass-3d-card relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl p-4 sm:p-5 border border-slate-700/80 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
        
        <div className="pt-1.5 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md badge-neon-blue text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              AI Predictive Studio
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Deterministic Trend Extrapolation</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-mono text-[11px] bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                {forecastData?.frequency} Frequency
              </span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            Time-Series Forecasting & Scenario Simulation
          </h1>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl border border-blue-800/80 bg-[#081020] hover:bg-blue-950/80 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition shadow-sm"
            title="Export full forecast and uncertainty matrix to CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          {/* Table Selector */}
          {availableTables.length > 1 && (
            <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedTable}
                onChange={(e) => handleTableChange(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
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
          <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
            <span className="text-slate-400 font-medium">Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
            >
              {candidateMetrics.map(m => (
                <option key={m} value={m} className="bg-[#0B1528] text-white">
                  {m.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1.5 bg-[#081020] border border-blue-900/60 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <select
              data-tour="forecast-horizon-select"
              value={selectedHorizon}
              onChange={(e) => handleHorizonChange(Number(e.target.value))}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value={3} className="bg-[#0B1528] text-white">3 Steps</option>
              <option value={6} className="bg-[#0B1528] text-white">6 Steps</option>
              <option value={12} className="bg-[#0B1528] text-white">12 Steps</option>
              <option value={24} className="bg-[#0B1528] text-white">24 Steps</option>
            </select>
          </div>

          <button
            onClick={() => fetchForecast(selectedMetric, selectedHorizon, selectedTable)}
            disabled={isLoading}
            className="btn-3d-secondary p-2 rounded-xl text-slate-300 hover:text-white"
            title="Re-run forecast computation"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Telemetry Grid in 3D */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Current Baseline */}
          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-4 sm:p-5 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[148px]"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 shadow-sm" />
            
            {/* Header: Title, Badge, and In-Flow Icon */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">Current Baseline</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-300 font-mono font-semibold">Actual</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center text-cyan-300 shadow-sm shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            {/* Metric Value */}
            <div className="my-1.5">
              <div className="text-2xl lg:text-3xl font-black text-white drop-shadow-md font-telemetry">
                {summary.last_actual.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </div>
            </div>

            {/* Footer */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Most recent recorded observation</span>
            </div>
          </Card3D>

          {/* Card 2: Horizon Target */}
          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-4 sm:p-5 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[148px]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 shadow-sm ${
              summary.projected_change_pct >= 0
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                : 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500'
            }`} />
            
            {/* Header: Title and In-Flow Icon */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">Horizon Target</span>
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm shrink-0 ${
                summary.projected_change_pct >= 0
                  ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}>
                {summary.projected_change_pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>

            {/* Metric Value + Delta badge */}
            <div className="my-1.5">
              <div className="text-2xl lg:text-3xl font-black text-white flex items-center flex-wrap gap-2 drop-shadow-md font-telemetry">
                <span>{summary.horizon_target.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-bold flex items-center shadow-sm ${
                  summary.projected_change_pct >= 0 ? 'badge-quantum-emerald' : 'badge-quantum-rose'
                }`}>
                  {summary.projected_change_pct >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {summary.projected_change_pct > 0 ? `+${summary.projected_change_pct}%` : `${summary.projected_change_pct}%`}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${summary.projected_change_pct >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>Target over {forecastData?.horizon} {forecastData?.frequency.toLowerCase()}s</span>
            </div>
          </Card3D>

          {/* Card 3: Trajectory Momentum */}
          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-4 sm:p-5 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[148px]"
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
            
            {/* Header: Title and In-Flow Icon */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Trajectory Momentum</span>
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm shrink-0 ${
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
            </div>

            {/* Metric Value + Volatility Badge */}
            <div className="my-1.5 flex items-baseline justify-between flex-wrap gap-1.5">
              <div className={`text-xl lg:text-2xl font-black drop-shadow-md leading-snug truncate ${
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
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                summary.volatility_cv < 15 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : summary.volatility_cv < 30 ? 'bg-blue-950/80 text-cyan-300 border border-blue-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}>
                {summary.volatility_cv < 15 ? 'Low Volatility' : summary.volatility_cv < 30 ? 'Moderate' : 'High Variance'}
              </span>
            </div>

            {/* Footer */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Historical CV Index: <strong className="text-slate-200 font-mono">{summary.volatility_cv}%</strong></span>
            </div>
          </Card3D>

          {/* Card 4: Model Reliability */}
          <Card3D
            maxTilt={10}
            scale={1.02}
            perspective={900}
            className="p-4 sm:p-5 rounded-2xl glass-3d-card border border-slate-700/70 shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[148px]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 shadow-sm ${
              summary.confidence_score >= 70
                ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400'
                : summary.confidence_score >= 50
                ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
            }`} />
            
            {/* Header: Title and In-Flow Icon */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Model Reliability</span>
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm shrink-0 ${
                summary.confidence_score >= 70
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : summary.confidence_score >= 50
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Metric Value + R² Badge */}
            <div className="my-1.5">
              <div className="text-2xl lg:text-3xl font-black text-blue-200 flex items-center flex-wrap gap-2 drop-shadow-md">
                <span>{summary.confidence_score}%</span>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold bg-slate-800/80 border border-slate-700/60 text-slate-300 shadow-sm">
                  R²: {summary.r_squared}
                </span>
              </div>
            </div>

            {/* Footer with Subtitle and Active CI Pill */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span className="truncate">Holt Damped Linear</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono font-bold shrink-0">
                ±{selectedBandwidth}% CI Active
              </span>
            </div>
          </Card3D>
        </div>
      )}

      {/* Main Interactive Forecast Chart Card */}
      <div data-tour="forecast-chart" className="glass-3d-card relative overflow-hidden rounded-2xl p-3.5 sm:p-5 md:p-6 space-y-4 border border-slate-700/80 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
        
        {/* Chart Header Bar */}
        <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border-b border-blue-950/80 pb-3.5">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 drop-shadow-sm">
              <span>{forecastData?.metric_display} Projections with Uncertainty Intervals</span>
              <span className="text-xs text-cyan-400 font-mono font-normal">
                (z={zScore.toFixed(3)})
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Solid line depicts historical observations; glowing cyan envelope maps ±{selectedBandwidth}% confidence interval over horizon.
            </p>
          </div>

          {/* 3D Chart View Toggles & Bandwidth Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scenario Toggles */}
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
                Bull (+{scenarioSpread}%)
              </button>
              <button
                onClick={() => setActiveScenario('bear')}
                className={`tab-3d-item ${activeScenario === 'bear' ? 'tab-3d-item-active' : ''}`}
              >
                Bear (-{scenarioSpread}%)
              </button>
            </div>

            {/* Scenario Sensitivity Shock Selector */}
            <div className="flex items-center gap-1 bg-[#060c18] border border-blue-950 p-0.5 rounded-xl text-[11px]">
              <span className="text-slate-500 px-1 font-mono text-[10px]">Shock:</span>
              {[8, 15, 25].map(spread => (
                <button
                  key={spread}
                  onClick={() => setScenarioSpread(spread)}
                  className={`px-1.5 py-0.5 rounded-lg font-mono font-bold transition ${
                    scenarioSpread === spread
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Set scenario shock spread to ±${spread}%`}
                >
                  ±{spread}%
                </button>
              ))}
            </div>

            {/* Quick Bandwidth Presets Toolbar Chips */}
            <div className="hidden xl:flex items-center gap-1 bg-[#060c18] p-0.5 rounded-xl border border-blue-950">
              {[20, 50, 80, 95].map(bw => (
                <button
                  key={bw}
                  onClick={() => handleBandwidthSelect(bw)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                    selectedBandwidth === bw
                      ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-400/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {bw}%
                </button>
              ))}
            </div>

            {/* Confidence Band Visibility Toggle */}
            <button
              onClick={() => setShowConfidenceBands(!showConfidenceBands)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                showConfidenceBands
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-500/10'
                  : 'bg-[#081020] border-blue-950 text-slate-400 hover:text-white'
              }`}
              title="Toggle confidence band area on/off"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Band: {showConfidenceBands ? 'On' : 'Off'}</span>
            </button>

            {/* Change Band Width Button & Interactive Popover */}
            <div className="relative" ref={bandPopoverRef}>
              <button
                onClick={() => setIsBandPopoverOpen(!isBandPopoverOpen)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                  isBandPopoverOpen
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                    : 'bg-[#081020] hover:bg-blue-950/70 border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                }`}
                title="Change prediction confidence interval bandwidth (5%, 10%, 20%, 30%, ..., 95%)"
              >
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-300 font-normal hidden sm:inline">Band Width:</span>
                <span className="font-mono font-black text-cyan-300 bg-cyan-950/70 border border-cyan-700/60 px-1.5 py-0.5 rounded text-[11px]">
                  {selectedBandwidth}%
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isBandPopoverOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Menu Card */}
              {isBandPopoverOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 p-4 rounded-2xl glass-card-premium border border-cyan-500/50 bg-[#070F22]/98 backdrop-blur-2xl shadow-2xl shadow-black/80 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-blue-950/80">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">Uncertainty Band Width</h4>
                        <p className="text-[10px] text-slate-400">Confidence interval width (z-score envelope)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsBandPopoverOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                      aria-label="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Active Value Metric & Visual Scale */}
                  <div className="p-2.5 rounded-xl bg-[#0B1528] border border-blue-900/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Selected Confidence Band</div>
                      <div className="text-lg font-black text-cyan-300 font-mono flex items-center gap-1.5">
                        <span>±{selectedBandwidth}%</span>
                        <span className="text-[11px] font-normal text-slate-400 font-sans">
                          (z-score = <strong className="text-cyan-400 font-mono">{zScore.toFixed(3)}</strong>)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBandwidthSelect(95)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1 transition"
                      title="Reset to 95% standard"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset 95%</span>
                    </button>
                  </div>

                  {/* Preset Buttons Grid (5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-300">Band Width Presets</span>
                      <span className="text-[10px] text-cyan-400 font-mono">5% to 95%</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                      {BANDWIDTH_PRESETS.map((val) => {
                        const isActive = selectedBandwidth === val;
                        return (
                          <button
                            key={val}
                            onClick={() => handleBandwidthSelect(val)}
                            className={`py-1.5 px-1 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center border ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                                : 'bg-[#091322] hover:bg-blue-950/80 border-blue-900/60 text-slate-300 hover:text-white hover:border-slate-600'
                            }`}
                          >
                            {val}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Range Slider for Fine-Tuning */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-medium">Continuous Slider</span>
                      <span className="font-mono text-cyan-400 font-bold">{selectedBandwidth}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={selectedBandwidth}
                      onChange={(e) => handleBandwidthSelect(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                      <span>5% (Strict / Narrow)</span>
                      <span>50% (Balanced)</span>
                      <span>95% (Safe Envelope)</span>
                    </div>
                  </div>

                  {/* Dynamic Explanation Box */}
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/50 text-[11px] text-slate-300 leading-relaxed">
                    <span className="font-bold text-cyan-400">
                      {selectedBandwidth <= 25 ? '🎯 High Precision Margin: ' : selectedBandwidth <= 75 ? '⚖️ Balanced Uncertainty: ' : '🛡️ Enterprise Safety Envelope: '}
                    </span>
                    {selectedBandwidth <= 25
                      ? `Very tight confidence width. Focuses strictly on core trajectory, assuming minimal external variance.`
                      : selectedBandwidth <= 75
                      ? `Moderate variance tolerance. Captures realistic operational swings without over-expanding bounds.`
                      : `Standard statistical safety band (z = ${zScore.toFixed(2)}). Encompasses 95% of probabilistic future outcomes.`}
                  </div>

                  {/* Footer Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-blue-950/80">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Live Recharts update
                    </span>
                    <button
                      onClick={() => setIsBandPopoverOpen(false)}
                      className="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recharts Container - Fully Reactive, Crash-Proof, Guaranteed Non-Zero Dimensions */}
        <div 
          ref={chartWrapperRef} 
          className="w-full min-w-0 relative pt-2" 
          style={{ height: 420, minHeight: 420 }}
        >
          {chartData.length > 0 && chartWidth > 0 ? (
            <ResponsiveContainer width="100%" height={400} minWidth={100} debounce={30}>
              <ComposedChart data={chartData} margin={{ top: 16, right: 28, left: 14, bottom: 24 }}>
                <defs>
                  <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#2563EB" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.08} />
                  </linearGradient>
                  <filter id="neonGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38BDF8" floodOpacity="0.6" />
                  </filter>
                  <filter id="neonGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.5" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                <XAxis 
                  dataKey="period" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  tickMargin={8} 
                  axisLine={{ stroke: '#1E293B' }}
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  tickMargin={8} 
                  width={58}
                  axisLine={{ stroke: '#1E293B' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} 
                />
                <Tooltip content={<ForecastCustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />

                {/* Native Range Confidence Ribbon between lower_bound and upper_bound */}
                {showConfidenceBands && (
                  <Area
                    type="monotone"
                    dataKey="ci_range"
                    stroke="transparent"
                    fill="url(#confidenceBand)"
                    connectNulls={false}
                    name={`±${selectedBandwidth}% Confidence Band`}
                  />
                )}

                {/* Upper Bound Boundary Line */}
                {showConfidenceBands && (
                  <Line
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#06B6D4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    activeDot={false}
                    name={`Upper Bound (±${selectedBandwidth}%)`}
                  />
                )}

                {/* Lower Bound Boundary Line */}
                {showConfidenceBands && (
                  <Line
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#06B6D4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    activeDot={false}
                    name={`Lower Bound (±${selectedBandwidth}%)`}
                  />
                )}

                {/* Historical Actuals */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#38BDF8"
                  strokeWidth={3}
                  filter="url(#neonGlowCyan)"
                  dot={{ r: 4, fill: '#0284C7', stroke: '#38BDF8', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#38BDF8', stroke: '#FFFFFF', strokeWidth: 2 }}
                  connectNulls={false}
                  name="Historical Actual"
                />

                {/* Baseline Forecast Line */}
                {(activeScenario === 'all' || activeScenario === 'baseline') && (
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    strokeDasharray="6 6"
                    filter="url(#neonGlowBlue)"
                    dot={{ r: 4, fill: '#1D4ED8', stroke: '#60A5FA', strokeWidth: 1.5 }}
                    activeDot={{ r: 7, fill: '#60A5FA', stroke: '#FFFFFF', strokeWidth: 2 }}
                    connectNulls={false}
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
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: '#10B981' }}
                    connectNulls={false}
                    name={`Bull Case (+${scenarioSpread}%)`}
                  />
                )}

                {/* Bear Case */}
                {(activeScenario === 'all' || activeScenario === 'bear') && (
                  <Line
                    type="monotone"
                    dataKey="bear_scenario"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: '#F43F5E' }}
                    connectNulls={false}
                    name={`Bear Case (-${scenarioSpread}%)`}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-[400px] flex flex-col items-center justify-center space-y-3 bg-[#060D1E]/40 rounded-xl border border-blue-900/30">
              <div className="w-8 h-8 rounded-xl border-2 border-cyan-400 border-t-transparent animate-spin" />
              <div className="text-xs text-cyan-300 font-mono tracking-wider">Calibrating Vector Projection Canvas...</div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column: Prescriptive Recommendations & Forecast Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescriptive Strategic Outlook */}
        <div className="lg:col-span-1 glass-card-premium relative overflow-hidden rounded-2xl p-5 space-y-4 border border-slate-700/70 shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-blue-950/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Strategic Takeaways
              </h3>
              <button
                onClick={handleCopyTakeaways}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex items-center gap-1 transition"
                title="Copy strategic takeaways to clipboard"
              >
                {copiedTakeaways ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedTakeaways ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {forecastData?.recommendations.map((rec, idx) => {
                const isBaseline = rec.includes('Baseline Target');
                const isScenario = rec.includes('Scenario Planning');
                const isFidelity = rec.includes('Model Fidelity');
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border space-y-1.5 transition ${
                      isBaseline
                        ? 'bg-blue-950/30 border-blue-900/60 hover:border-blue-700/80'
                        : isScenario
                        ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700/60'
                        : isFidelity
                        ? 'bg-cyan-950/20 border-cyan-900/40 hover:border-cyan-700/60'
                        : 'bg-[#081020] border-blue-950'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                      {isBaseline && <span className="text-blue-400 flex items-center gap-1"><Target className="w-3 h-3" /> Baseline Projection</span>}
                      {isScenario && <span className="text-emerald-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Scenario Trajectory</span>}
                      {isFidelity && <span className="text-cyan-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Model Fidelity</span>}
                    </div>
                    <div dangerouslySetInnerHTML={{
                      __html: rec.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                    }} />
                  </div>
                );
              })}
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
          
          {/* Table Header & Controls */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Detailed Horizon Matrix</span>
                <span className="text-xs text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  {forecastData?.forecast.length} Steps
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Granular path projections with dynamic ±{selectedBandwidth}% confidence envelope</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search step..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-[#081020] border border-blue-950 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-32 sm:w-40 transition"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* CSV Download in Table Header */}
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#081020] hover:bg-blue-950 border border-blue-900/60 flex items-center gap-1 transition"
                title="Export table data to CSV"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="table-3d-header text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 rounded-l-lg">Period</th>
                  <th className="px-3 py-2.5 text-right font-bold text-white">Baseline Forecast</th>
                  <th className="px-3 py-2.5 text-right font-bold text-emerald-400">Bull Case (+{scenarioSpread}%)</th>
                  <th className="px-3 py-2.5 text-right font-bold text-rose-400">Bear Case (-{scenarioSpread}%)</th>
                  <th className="px-3 py-2.5 text-right rounded-r-lg font-bold text-cyan-300">
                    <span className="flex items-center justify-end gap-1.5">
                      <span>±{selectedBandwidth}% CI Range</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 font-mono">
                        z={zScore.toFixed(2)}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-950/60">
                {filteredForecast.map((pt, i) => {
                  const unc = pt.uncertainty_growth ?? (pt.upper_95 !== undefined && pt.forecast !== undefined ? Math.abs(pt.upper_95 - pt.forecast) / 1.96 : 0);
                  const margin = zScore * unc;
                  const rowUpper = Math.round((pt.forecast + margin) * 10) / 10;
                  const rowLower = Math.round(Math.max(0, pt.forecast - margin) * 10) / 10;
                  const bullVal = Math.round(pt.forecast * (1 + scenarioSpread / 100) * 10) / 10;
                  const bearVal = Math.round(pt.forecast * Math.max(0.01, 1 - scenarioSpread / 100) * 10) / 10;
                  const spreadPct = pt.forecast > 0 ? Math.round(((rowUpper - rowLower) / pt.forecast) * 100) : 0;

                  return (
                    <tr key={i} className="hover:bg-blue-950/30 transition group">
                      <td className="px-3 py-2.5 font-semibold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:scale-125 transition-transform" />
                        <span>{pt.period}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-blue-200 font-semibold">
                        {pt.forecast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-300">
                        {bullVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-300">
                        {bearVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-cyan-300/90 font-medium">
                        <div className="flex flex-col items-end gap-0.5">
                          <span>
                            [{rowLower.toLocaleString(undefined, { maximumFractionDigits: 1 })} - {rowUpper.toLocaleString(undefined, { maximumFractionDigits: 1 })}]
                          </span>
                          <span className="text-[9px] text-slate-500 font-sans">
                            Spread: ±{spreadPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
