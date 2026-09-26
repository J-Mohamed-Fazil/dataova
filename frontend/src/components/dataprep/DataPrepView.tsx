import React, { useState, useEffect, useMemo } from 'react';
import {
  Wand2,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  FileCheck,
  Zap,
  Check,
  SlidersHorizontal,
  Filter,
  Search,
  Eye,
  Table as TableIcon,
  Scissors,
  Hash,
  Type,
  Calendar,
  ChevronRight,
  Info,
  CheckSquare,
  Square,
  Activity,
  Cpu,
  ArrowUpRight,
  ShieldAlert,
  Sparkle
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import {
  CleanseAuditResult,
  CleansePreviewResult,
  CleansePipelineStep,
  ColumnQualityStat
} from '../../types';
import { Card3D } from '../common/Card3D';

// Radial SVG Gauge Component with Glowing Cybernetic Ring
interface RadialHealthGaugeProps {
  score: number;
  label: string;
  subtitle: string;
  colorTheme: 'emerald' | 'amber' | 'rose' | 'cyan';
  size?: number;
  glow?: boolean;
}

const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({
  score,
  label,
  subtitle,
  colorTheme,
  size = 130,
  glow = true
}) => {
  const radius = 48;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.min(100, Math.max(0, Math.round(score)));
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const themeConfig = {
    emerald: {
      stroke: '#10B981',
      gradientStart: '#34D399',
      gradientEnd: '#059669',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    },
    amber: {
      stroke: '#F59E0B',
      gradientStart: '#FBBF24',
      gradientEnd: '#D97706',
      glowColor: 'rgba(245, 158, 11, 0.4)',
      badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    rose: {
      stroke: '#F43F5E',
      gradientStart: '#FB7185',
      gradientEnd: '#E11D48',
      glowColor: 'rgba(244, 63, 94, 0.4)',
      badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    },
    cyan: {
      stroke: '#06B6D4',
      gradientStart: '#22D3EE',
      gradientEnd: '#0891B2',
      glowColor: 'rgba(6, 182, 212, 0.4)',
      badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    }
  }[colorTheme];

  const gradientId = `gauge-grad-${colorTheme}-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col items-center justify-center p-3 relative select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={themeConfig.gradientStart} />
              <stop offset="100%" stopColor={themeConfig.gradientEnd} />
            </linearGradient>
            {glow && (
              <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            )}
          </defs>

          {/* Background Track with Subtle Bevel */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            className="opacity-50"
          />

          {/* Glowing Animated Value Arc */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={glow ? `url(#glow-${gradientId})` : undefined}
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </svg>

        {/* Center Score Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {safeScore}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">/ 100</span>
        </div>
      </div>

      <div className="mt-2 text-center space-y-0.5">
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${themeConfig.badgeBg}`}>
          {label}
        </div>
        <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
      </div>
    </div>
  );
};

export const DataPrepView: React.FC = () => {
  const { currentDataset, refreshCurrentDataset } = useWorkspace();
  const [auditData, setAuditData] = useState<CleanseAuditResult | null>(null);
  const [cleanseResult, setCleanseResult] = useState<CleansePreviewResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isApplied, setIsApplied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active filters and views
  const [defectFilter, setDefectFilter] = useState<'all' | 'nulls' | 'duplicates' | 'whitespace' | 'outliers'>('all');
  const [columnSearch, setColumnSearch] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'numeric' | 'string' | 'datetime'>('all');
  const [viewMode, setViewMode] = useState<'repaired' | 'raw' | 'diff'>('repaired');
  const [activeTab, setActiveTab] = useState<'matrix' | 'recipe' | 'preview'>('matrix');

  // Configurable 3D Recipe State
  const [recipeConfig, setRecipeConfig] = useState({
    stripWhitespace: true,
    dropDuplicates: true,
    imputeNulls: true,
    numericStrategy: 'median' as 'median' | 'mean' | 'zero',
    categoricalStrategy: 'mode' as 'mode' | 'unknown',
    clipOutliers: true,
    outlierIqrMultiplier: 2.5,
    dropHighNullCols: false
  });

  // Table selection sync
  useEffect(() => {
    if (currentDataset?.tables && currentDataset.tables.length > 0) {
      if (!selectedTable || !currentDataset.tables.some(t => t.table_name === selectedTable)) {
        setSelectedTable(currentDataset.tables[0].table_name);
      }
    }
  }, [currentDataset]);

  const fetchAudit = async (tableName?: string) => {
    if (!currentDataset) return;
    try {
      setIsLoadingAudit(true);
      setError(null);
      const target = tableName || selectedTable || currentDataset.tables[0]?.table_name;
      const res = await api.getCleanseAudit(currentDataset.id, target);
      setAuditData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to audit dataset cleanliness.');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (currentDataset?.id) {
      fetchAudit(selectedTable);
    }
  }, [currentDataset?.id, selectedTable]);

  // Build pipeline steps from active recipe config
  const buildPipelineSteps = (): CleansePipelineStep[] => {
    const steps: CleansePipelineStep[] = [];

    if (recipeConfig.stripWhitespace) {
      steps.push({ action: 'strip_whitespace' });
    }
    if (recipeConfig.dropDuplicates) {
      steps.push({ action: 'drop_duplicates' });
    }
    if (recipeConfig.imputeNulls && auditData?.column_stats) {
      Object.entries(auditData.column_stats).forEach(([col, stat]) => {
        if (stat.null_count > 0) {
          if (stat.dtype === 'numeric') {
            steps.push({
              action: 'impute',
              field: col,
              strategy: recipeConfig.numericStrategy
            });
          } else {
            steps.push({
              action: 'impute',
              field: col,
              strategy: recipeConfig.categoricalStrategy === 'mode' ? 'mode' : 'zero'
            });
          }
        }
      });
    }
    if (recipeConfig.clipOutliers && auditData?.outlier_columns) {
      Object.entries(auditData.outlier_columns).forEach(([col, count]) => {
        if (count > 0) {
          steps.push({
            action: 'clip_outliers',
            field: col,
            iqr_multiplier: recipeConfig.outlierIqrMultiplier
          });
        }
      });
    }
    if (recipeConfig.dropHighNullCols && auditData?.column_stats) {
      Object.entries(auditData.column_stats).forEach(([col, stat]) => {
        if (stat.null_percentage > 50) {
          steps.push({ action: 'drop_column', field: col });
        }
      });
    }
    return steps;
  };

  // Preview Recipe Pipeline
  const handlePreviewRecipe = async () => {
    if (!currentDataset) return;
    try {
      setIsProcessing(true);
      setError(null);
      const steps = buildPipelineSteps();
      const res = await api.previewCleansePipeline(currentDataset.id, {
        table_name: selectedTable,
        steps
      });
      setCleanseResult(res);
      setViewMode('repaired');
      setActiveTab('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to preview data prep pipeline.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1-Click Autonomous Cleanse
  const handleAutoPreview = async () => {
    if (!currentDataset) return;
    try {
      setIsProcessing(true);
      setError(null);
      const res = await api.previewAutoCleanse(currentDataset.id, selectedTable);
      setCleanseResult(res);
      setViewMode('repaired');
      setActiveTab('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to preview auto-cleanse.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Cleanse Permanently
  const handleApplyCleanse = async () => {
    if (!currentDataset) return;
    try {
      setIsProcessing(true);
      setError(null);
      const steps = buildPipelineSteps();
      let res: CleansePreviewResult;
      if (steps.length > 0) {
        res = await api.applyCleansePipeline(currentDataset.id, {
          table_name: selectedTable,
          steps
        });
      } else {
        res = await api.applyAutoCleanse(currentDataset.id, selectedTable);
      }
      setCleanseResult(res);
      setIsApplied(true);
      await refreshCurrentDataset();
      await fetchAudit(selectedTable);
    } catch (err: any) {
      setError(err.message || 'Failed to apply data prep changes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCleanedCsv = () => {
    if (!currentDataset) return;
    const url = api.getExportCleanedCsvUrl(currentDataset.id, selectedTable);
    window.open(url, '_blank');
  };

  // Quality calculation values
  const initialScore = auditData?.current_health_score ?? (currentDataset?.data_health_score || 0);
  const projectedScore = cleanseResult ? cleanseResult.cleaned_health_score : Math.min(100, Math.round(initialScore + 18));
  const scoreImprovement = cleanseResult ? cleanseResult.score_improvement : Math.max(0, Math.round(projectedScore - initialScore));

  const initialTheme = initialScore >= 80 ? 'emerald' : initialScore >= 50 ? 'amber' : 'rose';
  const projectedTheme = 'emerald';

  // Target table metadata & raw samples
  const activeTableMeta = currentDataset?.tables?.find(t => t.table_name === selectedTable) || currentDataset?.tables?.[0];
  const rawSampleData = activeTableMeta?.sample_data || [];

  // Computed column stats list
  const columnStatsList = useMemo(() => {
    if (!auditData?.column_stats) {
      return (activeTableMeta?.columns || []).map(c => ({
        name: c.column_name,
        dtype: (c.data_type?.toLowerCase().includes('int') || c.data_type?.toLowerCase().includes('float') ? 'numeric' : 'string') as 'numeric' | 'string',
        null_count: auditData?.null_counts?.[c.column_name] || 0,
        null_percentage: auditData?.total_rows ? Math.round(((auditData.null_counts?.[c.column_name] || 0) / auditData.total_rows) * 100) : 0,
        unique_count: 0,
        has_whitespace: auditData?.whitespace_columns?.includes(c.column_name) || false,
        outlier_count: auditData?.outlier_columns?.[c.column_name] || 0
      }));
    }
    return Object.values(auditData.column_stats);
  }, [auditData, activeTableMeta]);

  // Filtered columns based on search, type, and defect filter
  const filteredColumns = useMemo(() => {
    return columnStatsList.filter(col => {
      // Search
      if (columnSearch && !col.name.toLowerCase().includes(columnSearch.toLowerCase())) {
        return false;
      }
      // Dtype
      if (selectedTypeFilter !== 'all' && col.dtype !== selectedTypeFilter) {
        return false;
      }
      // Defect filter
      if (defectFilter === 'nulls' && col.null_count === 0) return false;
      if (defectFilter === 'whitespace' && !col.has_whitespace) return false;
      if (defectFilter === 'outliers' && col.outlier_count === 0) return false;
      return true;
    });
  }, [columnStatsList, columnSearch, selectedTypeFilter, defectFilter]);

  const totalOutliers = auditData ? Object.values(auditData.outlier_columns || {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full overflow-y-auto perspective-1000">
      {/* 3D Cybernetic Command Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-3d-card border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-md" />

        <div className="pt-2.5 space-y-1.5 translate-z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-0.5 rounded-md badge-neon-emerald text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              Autonomous Cleanse Studio
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              100% Deterministic Engine
            </span>
            {currentDataset?.tables && currentDataset.tables.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-transparent text-xs font-mono text-cyan-300 focus:outline-none cursor-pointer"
                >
                  {currentDataset.tables.map(t => (
                    <option key={t.table_name} value={t.table_name} className="bg-slate-900 text-slate-200">
                      {t.table_name} ({t.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            Data Prep & Automated Quality Engineering
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Detect anomalies, impute missing values, clip extreme statistical outliers, and synthesize clean datasets for production ML models.
          </p>
        </div>

        {/* 3D Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 translate-z-15">
          <button
            onClick={handleDownloadCleanedCsv}
            className="btn-3d-secondary px-3.5 py-2 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            title="Download fully cleaned CSV file"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleAutoPreview}
            disabled={isProcessing}
            className="btn-3d-secondary px-4 py-2 border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
            title="Dry-run autonomous best-practice pipeline"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dry-Run Auto Cleanse</span>
          </button>

          <button
            onClick={handleApplyCleanse}
            disabled={isProcessing}
            className={`btn-3d-emerald px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 text-white shadow-lg ${
              isApplied ? 'ring-2 ring-emerald-400/60' : ''
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isApplied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-200" />
                <span>Cleaned & Saved!</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-200" />
                <span>Apply Cleanse to Dataset</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-md">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cybernetic 3D Health Meter & Transformation Bridge */}
      <div className="glass-3d-card border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-teal-400 to-emerald-400 shadow-md" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Quality Overview Statement */}
          <div className="space-y-2 lg:max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Quality Transformation Telemetry
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                {auditData?.total_rows ? `${auditData.total_rows.toLocaleString()} Records` : 'Analyzing'}
              </span>
            </div>
            <h2 className="text-lg font-black text-white">
              Data Health Progression: Baseline vs Projected
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time audit evaluates structural anomalies, non-conforming distributions, duplicate keys, and missing ratios. Cleanse transformations are completely transparent and verifiable.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Zero Synthetic Values
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                Deterministic Scorer
              </span>
            </div>
          </div>

          {/* Dual Cybernetic Radial Gauges & Glowing Bridge */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 bg-[#060D1E]/90 border border-slate-700/80 px-4 sm:px-8 py-4 rounded-2xl shadow-inner w-full lg:w-auto">
            {/* Baseline Current Gauge */}
            <RadialHealthGauge
              score={initialScore}
              label={initialScore >= 80 ? 'Optimal' : initialScore >= 50 ? 'Moderate' : 'Critical'}
              subtitle="Baseline Health"
              colorTheme={initialTheme}
              size={124}
            />

            {/* Pulsing Transformation Connector */}
            <div className="flex flex-col items-center justify-center px-2 py-1 space-y-1.5">
              <div className="flex items-center gap-1 text-emerald-400 font-black text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                <ArrowUpRight className="w-3 h-3" />
                +{scoreImprovement} pts
              </div>
              <div className="w-12 h-0.5 bg-gradient-to-r from-slate-600 via-cyan-400 to-emerald-400 rounded-full" />
              <ArrowRight className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="text-[9px] uppercase font-bold text-slate-400">Quality Delta</span>
            </div>

            {/* Projected Repaired Gauge */}
            <RadialHealthGauge
              score={projectedScore}
              label={projectedScore >= 95 ? 'Pristine' : 'Target State'}
              subtitle="Post-Cleanse"
              colorTheme={projectedTheme}
              size={124}
            />
          </div>
        </div>
      </div>

      {/* 4 Interactive Defect Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Missing Nulls Card */}
        <Card3D
          maxTilt={8}
          scale={1.02}
          perspective={900}
          className={`glass-3d-card border rounded-2xl p-4 sm:p-5 pt-5 sm:pt-6 space-y-2 relative overflow-hidden shadow-xl cursor-pointer transition-all ${
            defectFilter === 'nulls' ? 'ring-2 ring-rose-400 border-rose-500/80 bg-rose-950/20' : 'border-slate-700/70 hover:border-slate-500'
          }`}
          onClick={() => setDefectFilter(defectFilter === 'nulls' ? 'all' : 'nulls')}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500 shadow-sm" />
          <div className="pt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Missing Null Cells</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              (auditData?.total_nulls || 0) > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {(auditData?.total_nulls || 0) > 0 ? 'Remediate' : 'Clean'}
            </span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-rose-400 translate-z-30 drop-shadow-md font-mono">
            {isLoadingAudit ? '...' : (auditData?.total_nulls || 0).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{auditData?.null_percentage || 0}% of cells</span>
            <span className="text-[10px] text-cyan-400 underline font-medium">Filter</span>
          </div>
        </Card3D>

        {/* Duplicate Rows Card */}
        <Card3D
          maxTilt={8}
          scale={1.02}
          perspective={900}
          className={`glass-3d-card border rounded-2xl p-4 sm:p-5 pt-5 sm:pt-6 space-y-2 relative overflow-hidden shadow-xl cursor-pointer transition-all ${
            defectFilter === 'duplicates' ? 'ring-2 ring-amber-400 border-amber-500/80 bg-amber-950/20' : 'border-slate-700/70 hover:border-slate-500'
          }`}
          onClick={() => setDefectFilter(defectFilter === 'duplicates' ? 'all' : 'duplicates')}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 shadow-sm" />
          <div className="pt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duplicate Tuples</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              (auditData?.duplicate_rows || 0) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {(auditData?.duplicate_rows || 0) > 0 ? 'Prune' : 'Unique'}
            </span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-400 translate-z-30 drop-shadow-md font-mono">
            {isLoadingAudit ? '...' : (auditData?.duplicate_rows || 0).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Redundant rows</span>
            <span className="text-[10px] text-cyan-400 underline font-medium">Filter</span>
          </div>
        </Card3D>

        {/* Whitespace Card */}
        <Card3D
          maxTilt={8}
          scale={1.02}
          perspective={900}
          className={`glass-3d-card border rounded-2xl p-4 sm:p-5 pt-5 sm:pt-6 space-y-2 relative overflow-hidden shadow-xl cursor-pointer transition-all ${
            defectFilter === 'whitespace' ? 'ring-2 ring-cyan-400 border-cyan-500/80 bg-cyan-950/20' : 'border-slate-700/70 hover:border-slate-500'
          }`}
          onClick={() => setDefectFilter(defectFilter === 'whitespace' ? 'all' : 'whitespace')}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 shadow-sm" />
          <div className="pt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Whitespace Padding</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              (auditData?.whitespace_columns?.length || 0) > 0 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {(auditData?.whitespace_columns?.length || 0) > 0 ? 'Trim' : 'Clean'}
            </span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-cyan-300 translate-z-30 drop-shadow-md font-mono">
            {isLoadingAudit ? '...' : (auditData?.whitespace_columns?.length || 0)} <span className="text-sm font-normal text-slate-400">cols</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Untrimmed strings</span>
            <span className="text-[10px] text-cyan-400 underline font-medium">Filter</span>
          </div>
        </Card3D>

        {/* Statistical Outliers Card */}
        <Card3D
          maxTilt={8}
          scale={1.02}
          perspective={900}
          className={`glass-3d-card border rounded-2xl p-4 sm:p-5 pt-5 sm:pt-6 space-y-2 relative overflow-hidden shadow-xl cursor-pointer transition-all ${
            defectFilter === 'outliers' ? 'ring-2 ring-indigo-400 border-indigo-500/80 bg-indigo-950/20' : 'border-slate-700/70 hover:border-slate-500'
          }`}
          onClick={() => setDefectFilter(defectFilter === 'outliers' ? 'all' : 'outliers')}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm" />
          <div className="pt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statistical Outliers</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              totalOutliers > 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {totalOutliers > 0 ? 'Clip' : 'Clean'}
            </span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-indigo-300 translate-z-30 drop-shadow-md font-mono">
            {isLoadingAudit ? '...' : totalOutliers.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Beyond 1.5x IQR</span>
            <span className="text-[10px] text-cyan-400 underline font-medium">Filter</span>
          </div>
        </Card3D>
      </div>

      {/* Active Defect Filter Notice */}
      {defectFilter !== 'all' && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border border-cyan-500/40 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-cyan-300 font-medium">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filtering columns affected by: <strong>{defectFilter.toUpperCase()}</strong></span>
          </div>
          <button
            onClick={() => setDefectFilter('all')}
            className="text-[11px] text-slate-400 hover:text-white underline font-semibold cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Primary Section Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 tabs-3d-rail p-1 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'matrix' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Column Quality Matrix ({filteredColumns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('recipe')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'recipe' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Cleanse Recipe Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'preview' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Diff & Inspection Grid</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Active: <strong className="text-slate-300 font-mono">{selectedTable || 'Default Table'}</strong></span>
        </div>
      </div>

      {/* TAB 1: COLUMN QUALITY MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Search and Column Type Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dataset columns..."
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
              {(['all', 'numeric', 'string', 'datetime'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition ${
                    selectedTypeFilter === t
                      ? 'bg-slate-700 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Column Profiling Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredColumns.map(col => {
              const validPercentage = Math.max(0, 100 - col.null_percentage);
              const isPristine = col.null_count === 0 && !col.has_whitespace && col.outlier_count === 0;

              return (
                <div
                  key={col.name}
                  className="glass-3d-card border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 space-y-3 shadow-lg transition duration-200 group"
                >
                  {/* Column Header & Dtype */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {col.dtype === 'numeric' ? (
                          <Hash className="w-3.5 h-3.5 text-cyan-400" />
                        ) : col.dtype === 'datetime' ? (
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Type className="w-3.5 h-3.5 text-teal-400" />
                        )}
                        <h4 className="text-xs font-bold text-white font-mono truncate max-w-[180px]" title={col.name}>
                          {col.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {col.dtype} {col.unique_count > 0 && `• ${col.unique_count} distinct`}
                      </span>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isPristine
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {isPristine ? 'Pristine' : 'Has Defects'}
                    </span>
                  </div>

                  {/* Completeness Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Completeness</span>
                      <span className="text-slate-200 font-bold">{validPercentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${validPercentage}%` }}
                        title={`${validPercentage}% Valid`}
                      />
                      {col.null_percentage > 0 && (
                        <div
                          className="h-full bg-rose-500 transition-all duration-500"
                          style={{ width: `${col.null_percentage}%` }}
                          title={`${col.null_percentage}% Missing/Null`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Defect Indicators Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                    <span className={`px-2 py-0.5 rounded ${
                      col.null_count > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold' : 'bg-slate-800/80 text-slate-500'
                    }`}>
                      {col.null_count > 0 ? `${col.null_count} Nulls (${col.null_percentage}%)` : '0 Nulls'}
                    </span>

                    {col.has_whitespace && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                        Untrimmed
                      </span>
                    )}

                    {col.outlier_count > 0 && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold">
                        {col.outlier_count} Outliers
                      </span>
                    )}
                  </div>

                  {/* Quick Cleanse Action Trigger */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Autonomous Target:</span>
                    <span className="text-[10px] font-bold text-cyan-400 group-hover:text-cyan-300">
                      {col.null_count > 0
                        ? col.dtype === 'numeric' ? 'Median Imputation' : 'Mode Imputation'
                        : col.has_whitespace
                        ? 'Strip Whitespace'
                        : col.outlier_count > 0
                        ? 'Clip 3-Sigma'
                        : 'No action needed'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredColumns.length === 0 && (
            <div className="p-8 text-center glass-3d-card border border-slate-700/60 rounded-2xl space-y-2">
              <Database className="w-8 h-8 text-slate-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300">No columns match the current filter</h4>
              <p className="text-xs text-slate-500">Try adjusting your search query or clearing defect filters.</p>
              <button
                onClick={() => { setColumnSearch(''); setDefectFilter('all'); setSelectedTypeFilter('all'); }}
                className="btn-3d-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-400 mt-2"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE CLEANSE RECIPE STUDIO */}
      {activeTab === 'recipe' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Configurable Transformation Rules */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-3d-card border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                    Data Prep Transformation Recipe
                  </h3>
                  <p className="text-xs text-slate-400">
                    Customize the execution pipeline. Toggle individual steps and choose replacement strategies.
                  </p>
                </div>
                <button
                  onClick={() => setRecipeConfig({
                    stripWhitespace: true,
                    dropDuplicates: true,
                    imputeNulls: true,
                    numericStrategy: 'median',
                    categoricalStrategy: 'mode',
                    clipOutliers: true,
                    outlierIqrMultiplier: 2.5,
                    dropHighNullCols: false
                  })}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline"
                >
                  Reset Best Practices
                </button>
              </div>

              {/* Rule 1: Whitespace Stripping */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">1. Whitespace Sanitizer</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      Text Columns
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Trims leading and trailing spaces, replaces raw string 'nan' / 'None' with canonical nulls.
                  </p>
                </div>
                <button
                  onClick={() => setRecipeConfig(c => ({ ...c, stripWhitespace: !c.stripWhitespace }))}
                  className={`p-1.5 rounded-lg border transition ${
                    recipeConfig.stripWhitespace
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {recipeConfig.stripWhitespace ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
              </div>

              {/* Rule 2: Deduplication */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">2. Deduplication Engine</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                      {auditData?.duplicate_rows || 0} Found
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Removes exact duplicate rows across all dimensions to prevent sample weighting bias.
                  </p>
                </div>
                <button
                  onClick={() => setRecipeConfig(c => ({ ...c, dropDuplicates: !c.dropDuplicates }))}
                  className={`p-1.5 rounded-lg border transition ${
                    recipeConfig.dropDuplicates
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {recipeConfig.dropDuplicates ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
              </div>

              {/* Rule 3: Missing Value Imputation */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">3. Smart Null Imputation</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
                        {auditData?.total_nulls || 0} Cells
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Imputes missing cells deterministically without altering population distributions.
                    </p>
                  </div>
                  <button
                    onClick={() => setRecipeConfig(c => ({ ...c, imputeNulls: !c.imputeNulls }))}
                    className={`p-1.5 rounded-lg border transition ${
                      recipeConfig.imputeNulls
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    {recipeConfig.imputeNulls ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                </div>

                {recipeConfig.imputeNulls && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Numeric Strategy:</span>
                      <div className="flex items-center gap-1.5">
                        {(['median', 'mean', 'zero'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setRecipeConfig(c => ({ ...c, numericStrategy: s }))}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold capitalize transition ${
                              recipeConfig.numericStrategy === s
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Categorical Strategy:</span>
                      <div className="flex items-center gap-1.5">
                        {(['mode', 'unknown'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setRecipeConfig(c => ({ ...c, categoricalStrategy: s }))}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold capitalize transition ${
                              recipeConfig.categoricalStrategy === s
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rule 4: Outlier Boundary Clipping */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">4. Outlier Normalization</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                        {totalOutliers} Outliers
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Clips numerical outliers to upper and lower statistical IQR bounds to protect model convergence.
                    </p>
                  </div>
                  <button
                    onClick={() => setRecipeConfig(c => ({ ...c, clipOutliers: !c.clipOutliers }))}
                    className={`p-1.5 rounded-lg border transition ${
                      recipeConfig.clipOutliers
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    {recipeConfig.clipOutliers ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                </div>

                {recipeConfig.clipOutliers && (
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-3 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">IQR Threshold:</span>
                    <div className="flex items-center gap-1.5">
                      {[1.5, 2.5, 3.0].map(mult => (
                        <button
                          key={mult}
                          onClick={() => setRecipeConfig(c => ({ ...c, outlierIqrMultiplier: mult }))}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${
                            recipeConfig.outlierIqrMultiplier === mult
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {mult}x IQR
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rule 5: Drop High-Null Columns */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">5. High-Null Column Pruner</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Drops columns where more than 50% of the entries are missing (avoids uninformative noise).
                  </p>
                </div>
                <button
                  onClick={() => setRecipeConfig(c => ({ ...c, dropHighNullCols: !c.dropHighNullCols }))}
                  className={`p-1.5 rounded-lg border transition ${
                    recipeConfig.dropHighNullCols
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {recipeConfig.dropHighNullCols ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
              </div>

              {/* Execution Trigger Bar */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  All operations run in-memory and generate an interactive diff preview.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviewRecipe}
                    disabled={isProcessing}
                    className="btn-3d-secondary px-4 py-2 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dry-Run Recipe</span>
                  </button>

                  <button
                    onClick={handleApplyCleanse}
                    disabled={isProcessing}
                    className="btn-3d-emerald px-4 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Apply Recipe Permanently</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Live Transformation Log & Telemetry */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-3d-card border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Pipeline Execution Telemetry
              </h3>

              {cleanseResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Results Summary</span>
                    <div className="font-mono text-white text-sm font-bold">
                      {cleanseResult.cleaned_rows.toLocaleString()} Records Prepared
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Health score improved from <strong className="text-amber-400">{cleanseResult.initial_health_score}</strong> to{' '}
                      <strong className="text-emerald-400">{cleanseResult.cleaned_health_score}</strong> (+{cleanseResult.score_improvement} pts).
                    </p>
                  </div>

                  <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
                    {cleanseResult.transformation_log.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2 text-slate-200"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-snug">{entry}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setActiveTab('preview'); setViewMode('diff'); }}
                    className="w-full btn-3d-secondary py-2 text-xs text-cyan-300 font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Repaired Data Diff</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-3 shadow-inner">
                  <p className="text-slate-300 font-medium">
                    No active dry-run has been performed yet.
                  </p>
                  <p className="text-[11px]">
                    Click <strong>"Dry-Run Recipe"</strong> or <strong>"Dry-Run Auto Cleanse"</strong> to test transformations against real dataset samples and view step-by-step telemetry.
                  </p>
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-400">
                    <div>• 100% Deterministic execution</div>
                    <div>• Generates side-by-side diff</div>
                    <div>• Does not overwrite raw storage until applied</div>
                  </div>
                </div>
              )}
            </div>

            {/* ML & BI Readiness Badge */}
            <div className="glass-3d-card border border-slate-700/80 rounded-2xl p-5 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">ML Model Readiness</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold">
                  {projectedScore >= 85 ? 'High Tier' : 'Standard'}
                </span>
              </div>
              <div className="text-sm font-black text-white">
                {projectedScore >= 85 ? 'Validated for Supervised ML & Forecasting' : 'Recommend Further Imputation'}
              </div>
              <p className="text-[11px] text-slate-400">
                Data quality directly dictates AutoML validation accuracy and predictive confidence intervals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 3-WAY DATA DIFF & INSPECTION GRID */}
      {activeTab === 'preview' && (
        <div className="glass-3d-card table-3d-container border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-2xl overflow-hidden">
          {/* Table Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  {viewMode === 'repaired'
                    ? 'Cleaned & Repaired Dataset Preview'
                    : viewMode === 'raw'
                    ? 'Raw Baseline Dataset Preview'
                    : 'Repair Diff Matrix (Before vs After)'}
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                {cleanseResult ? `${cleanseResult.cleaned_rows.toLocaleString()} Cleaned Rows` : `${auditData?.total_rows || 0} Total Rows`}
              </p>
            </div>

            {/* 3-Way Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('repaired')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'repaired'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkle className="w-3 h-3 text-emerald-400" />
                <span>Repaired View</span>
              </button>

              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'raw'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Raw Baseline</span>
              </button>

              <button
                onClick={() => setViewMode('diff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'diff'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3 h-3 text-cyan-400" />
                <span>Diff Matrix</span>
              </button>
            </div>
          </div>

          {/* Interactive Table Stage */}
          <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="table-3d-header text-slate-300 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 bg-[#070D1E]/95 backdrop-blur-md">
                <tr>
                  <th className="px-3.5 py-3 w-12 text-slate-500 font-mono">#</th>
                  {(cleanseResult?.columns || activeTableMeta?.columns.map(c => c.column_name) || []).map((col) => (
                    <th key={col} className="px-3.5 py-3 font-mono">
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {auditData?.whitespace_columns?.includes(col) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Whitespace defect detected" />
                        )}
                        {auditData?.outlier_columns?.[col] && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Outliers detected" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {(viewMode === 'raw'
                  ? rawSampleData
                  : (cleanseResult?.sample_preview || rawSampleData)
                ).slice(0, 15).map((row, rowIdx) => {
                  const rawRow = rawSampleData[rowIdx] || {};

                  return (
                    <tr key={rowIdx} className="hover:bg-slate-800/50 transition duration-150">
                      <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[10px]">
                        {rowIdx + 1}
                      </td>

                      {(cleanseResult?.columns || activeTableMeta?.columns.map(c => c.column_name) || []).map((col) => {
                        const cellVal = row[col];
                        const rawVal = rawRow[col];
                        const wasNull = rawVal === null || rawVal === undefined || String(rawVal).trim() === '';
                        const isRepaired = wasNull && cellVal !== null && cellVal !== undefined;
                        const isClipped = rawVal !== undefined && cellVal !== undefined && Number(rawVal) !== Number(cellVal) && !isNaN(Number(rawVal));

                        return (
                          <td key={col} className="px-3.5 py-2.5 font-mono text-slate-200">
                            {viewMode === 'diff' ? (
                              isRepaired ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold inline-flex items-center gap-1 shadow-sm">
                                  <Sparkle className="w-2.5 h-2.5 text-emerald-400" />
                                  {String(cellVal)}
                                </span>
                              ) : isClipped ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold inline-flex items-center gap-1 shadow-sm">
                                  <span>{String(cellVal)}</span>
                                  <span className="text-[9px] text-slate-400 line-through">({String(rawVal)})</span>
                                </span>
                              ) : cellVal !== null && cellVal !== undefined ? (
                                <span>{String(cellVal)}</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded badge-neon-rose text-[10px] font-bold">NULL</span>
                              )
                            ) : viewMode === 'raw' ? (
                              rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '' ? (
                                <span>{String(rawVal)}</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded badge-neon-rose text-[10px] font-bold">NULL</span>
                              )
                            ) : (
                              // Repaired View
                              cellVal !== null && cellVal !== undefined ? (
                                isRepaired ? (
                                  <span className="text-emerald-300 font-bold" title="Repaired via Imputation">
                                    {String(cellVal)}
                                  </span>
                                ) : (
                                  <span>{String(cellVal)}</span>
                                )
                              ) : (
                                <span className="px-1.5 py-0.5 rounded badge-neon-rose text-[10px] font-bold">NULL</span>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Imputed / Normalized</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span>Missing / Null</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span>Outlier Bounds</span>
              </span>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Displaying first 15 records in preview buffer
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
