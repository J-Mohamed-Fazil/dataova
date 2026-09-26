import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Sparkles,
  PieChart as PieChartIcon,
  ShieldCheck,
  RefreshCw,
  Target,
  Layers,
  Award,
  AlertTriangle,
  Database,
  ArrowRight,
  Box,
  Radar as RadarIcon,
  Search,
  Download,
  Filter,
  Check,
  BarChart3,
  TrendingUp,
  TableProperties,
  ArrowUpRight,
  Zap,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { ClusterResult, CohortProfile } from '../../types';
import { ClusterGalaxy3D } from './ClusterGalaxy3D';
import { Card3D } from '../common/Card3D';

export const ClustersView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [clusterData, setClusterData] = useState<ClusterResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedK, setSelectedK] = useState<number | undefined>(undefined);
  const [selectedCohort, setSelectedCohort] = useState<CohortProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'matrix'>('3d');

  // Sample table search & cohort filtering
  const [sampleSearch, setSampleSearch] = useState<string>('');
  const [activeCohortFilter, setActiveCohortFilter] = useState<number | 'all'>('all');
  const [copiedCsv, setCopiedCsv] = useState<boolean>(false);

  const availableTables = clusterData?.available_tables || currentDataset?.tables?.map(t => ({
    table_name: t.table_name,
    row_count: t.row_count,
    columns: t.columns.map(c => c.column_name),
    numeric_columns: t.columns.filter(c => c.data_type === 'numeric' && !c.is_identifier).map(c => c.column_name)
  })) || [];

  const fetchClusters = async (k?: number, tableName?: string) => {
    if (!currentDataset) return;
    try {
      setIsLoading(true);
      setError(null);
      const targetTable = tableName !== undefined ? tableName : selectedTable;
      const res = await api.getClusters(currentDataset.id, { 
        k: k || selectedK, 
        table_name: targetTable || undefined 
      });
      setClusterData(res);
      if (res.table_name) {
        setSelectedTable(res.table_name);
      }
      if (res.cohorts.length > 0) {
        setSelectedCohort(res.cohorts[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to discover clusters.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters(selectedK);
  }, [currentDataset?.id]);

  const handleKChange = (kVal: number) => {
    setSelectedK(kVal);
    fetchClusters(kVal, selectedTable);
  };

  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    fetchClusters(selectedK, tableName);
  };

  // Transform radar data for Recharts
  const radarChartData = useMemo(() => {
    if (!clusterData || !clusterData.radar_indicators) return [];
    return clusterData.radar_indicators.map((ind) => {
      const row: Record<string, any> = { subject: ind.name };
      clusterData.cohorts.forEach((c) => {
        row[c.name.split(':')[0]] = c.normalized_scores[ind.key] ?? 50;
      });
      return row;
    });
  }, [clusterData]);

  // Distribution chart data
  const barChartData = useMemo(() => {
    if (!clusterData || !clusterData.cohorts) return [];
    return clusterData.cohorts.map((c) => ({
      name: c.name.split(':')[0],
      fullName: c.name,
      records: c.record_count,
      pct: c.record_percentage,
      color: c.color || '#2563EB'
    }));
  }, [clusterData]);

  // Filtered sample records
  const filteredSampleRecords = useMemo(() => {
    if (!clusterData?.sample_records) return [];
    return clusterData.sample_records.filter((rec) => {
      // Cohort filter
      if (activeCohortFilter !== 'all') {
        const cohortName = clusterData.cohorts.find(c => c.cluster_id === activeCohortFilter)?.name.split(':')[0];
        if (cohortName && !String(rec._cluster_cohort || '').includes(cohortName)) {
          return false;
        }
      }

      // Search filter across record keys
      if (sampleSearch.trim()) {
        const query = sampleSearch.toLowerCase();
        const matches = Object.values(rec).some((val) =>
          String(val).toLowerCase().includes(query)
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [clusterData, activeCohortFilter, sampleSearch]);

  // Export sample records to CSV
  const handleExportCsv = () => {
    if (!filteredSampleRecords.length || !clusterData) return;
    const headers = ['Cohort', ...clusterData.features_used];
    const rows = filteredSampleRecords.map((r) => [
      `"${r._cluster_cohort || ''}"`,
      ...clusterData.features_used.map((feat) => r[feat] ?? '')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTable || 'dataset'}_ml_segments.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  if (isLoading && !clusterData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-5 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center animate-spin shadow-[0_0_30px_rgba(6,182,212,0.4)]">
          <RefreshCw className="w-7 h-7 text-cyan-400" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white">Segmenting Cohorts with Multi-Feature K-Means in 3D...</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Partitioning multivariate entities into convergent spatial centroids and building 3D coordinate embeddings
          </p>
        </div>
      </div>
    );
  }

  if (error && !clusterData) {
    return (
      <div className="p-8 max-w-xl mx-auto my-auto text-center space-y-5 bg-[#0B152B]/90 border border-rose-500/40 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-lg">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">Clustering Engine Notice</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
        </div>

        {availableTables.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-xs text-slate-400">Switch Table:</span>
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              className="select-dark bg-[#070F22] border border-blue-900/80 rounded-xl px-3 py-2 text-xs text-white"
              style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
            >
              {availableTables.map(t => (
                <option key={t.table_name} value={t.table_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                  {t.table_name} ({t.numeric_columns.length} numeric cols)
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => fetchClusters(selectedK, selectedTable)}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition cursor-pointer"
        >
          Retry Clustering Engine
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full overflow-y-auto">
      {/* ========================================================= */}
      {/* HERO BANNER & CONTROL CENTER                              */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#07132B] via-[#0B1A38] to-[#0A2244] border border-purple-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-600 text-white shadow-xl shadow-purple-600/30 border border-purple-400/30">
              <Target className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                  ML Cohort & Spatial Clustering
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400 animate-spin" />
                  K-Means++ Engine
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {clusterData?.k} Natural Cohorts
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Vectorized multi-attribute entity segmentation, 3D WebGL spatial galaxy clustering, radar footprints, and prescriptive strategic directives.
              </p>
            </div>
          </div>

          {/* Controls: View Switcher, Table Selector, K Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher 3D Rail */}
            <div className="flex p-1 bg-[#060F22]/90 border border-purple-900/60 rounded-2xl shadow-inner">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === '3d'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D Galaxy</span>
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === '2d'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <RadarIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>2D Radar</span>
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5 text-cyan-400" />
                <span>Centroid Matrix</span>
              </button>
            </div>

            {/* Table Selector */}
            {availableTables.length > 1 && (
              <div className="flex items-center gap-2 bg-[#060F22]/90 border border-purple-900/60 rounded-2xl px-3.5 py-1.5 text-xs shadow-inner">
                <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-slate-400 font-medium">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => handleTableChange(e.target.value)}
                  className="select-dark bg-[#070F22] text-white font-bold focus:outline-none cursor-pointer text-xs rounded-lg px-2 py-1"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  {availableTables.map(t => (
                    <option key={t.table_name} value={t.table_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                      {t.table_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cluster Count (k) Selector */}
            <div className="flex items-center gap-2 bg-[#060F22]/90 border border-purple-900/60 rounded-2xl px-3.5 py-1.5 text-xs shadow-inner">
              <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400 font-medium">K:</span>
              <select
                value={selectedK || clusterData?.k || 3}
                onChange={(e) => handleKChange(Number(e.target.value))}
                className="select-dark bg-[#070F22] text-white font-bold focus:outline-none cursor-pointer text-xs rounded-lg px-2 py-1"
                style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
              >
                <option value={2} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>2 Cohorts</option>
                <option value={3} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>3 Cohorts (Optimal)</option>
                <option value={4} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>4 Cohorts</option>
                <option value={5} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>5 Cohorts</option>
                <option value={6} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>6 Cohorts</option>
              </select>
            </div>

            <button
              onClick={() => fetchClusters(selectedK, selectedTable)}
              disabled={isLoading}
              className="p-2.5 bg-[#060F22]/90 border border-purple-900/60 rounded-2xl text-slate-300 hover:text-white transition cursor-pointer shadow-sm"
              title="Re-run cluster engine"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3D TELEMETRY CARDS                                        */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card3D maxTilt={8} className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 space-y-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Classified Entities
            </span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {clusterData?.total_records.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400">
            Assigned in <strong className="text-slate-200">{clusterData?.table_name}</strong>
          </p>
        </Card3D>

        <Card3D maxTilt={8} className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 space-y-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Clusters Partitioned
            </span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">
            {clusterData?.k} Cohorts
          </div>
          <p className="text-[11px] text-slate-400">
            K-Means++ convergent spatial centroids
          </p>
        </Card3D>

        <Card3D maxTilt={8} className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 space-y-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Variance Explained
            </span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
            {clusterData?.metrics.variance_explained_pct}%
          </div>
          <div className="w-full bg-[#060F22] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full"
              style={{ width: `${clusterData?.metrics.variance_explained_pct || 75}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Separation compactness ratio
          </p>
        </Card3D>

        <Card3D maxTilt={8} className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 space-y-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Features Evaluated
            </span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
            {clusterData?.features_used.length} Dimensions
          </div>
          <p className="text-[11px] text-slate-400 truncate" title={clusterData?.features_used.join(', ')}>
            {clusterData?.features_used.join(', ')}
          </p>
        </Card3D>
      </div>

      {/* ========================================================= */}
      {/* MAIN VISUALIZATION MODES                                  */}
      {/* ========================================================= */}
      {viewMode === '3d' && (
        <div className="animate-fadeIn">
          <ClusterGalaxy3D
            cohorts={clusterData?.cohorts || []}
            selectedCohort={selectedCohort}
            onSelectCohort={(cohort) => {
              setSelectedCohort(cohort);
              setActiveCohortFilter(cohort.cluster_id);
            }}
          />
        </div>
      )}

      {viewMode === '2d' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {/* Multi-Attribute Radar Comparison */}
          <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-6 space-y-4 shadow-2xl backdrop-blur-xl">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>Multi-Dimensional Cohort Radar Profiles</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparative normalized footprint (0-100 index) displaying relative strengths and deficits across cohorts.
              </p>
            </div>

            <div className="h-80 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#1E293B" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#334155" fontSize={9} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#070F22',
                      borderColor: '#1E3A8A',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#FFFFFF'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {clusterData?.cohorts.map((cohort) => (
                    <Radar
                      key={cohort.cluster_id}
                      name={cohort.name.split(':')[0]}
                      dataKey={cohort.name.split(':')[0]}
                      stroke={cohort.color || '#2563EB'}
                      fill={cohort.color || '#2563EB'}
                      fillOpacity={0.25}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cohort Population Distribution */}
          <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-6 space-y-4 shadow-2xl backdrop-blur-xl">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-cyan-400" />
                <span>Cohort Volume & Entity Share</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Proportional distribution of entity records assigned into each cluster segment.
              </p>
            </div>

            <div className="h-80 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 15, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip
                    formatter={(val: any, name: string) => [
                      name === 'records' ? `${val.toLocaleString()} records` : `${val}%`,
                      name === 'records' ? 'Volume' : 'Share'
                    ]}
                    contentStyle={{
                      backgroundColor: '#070F22',
                      borderColor: '#1E3A8A',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#FFFFFF'
                    }}
                  />
                  <Bar dataKey="records" radius={[6, 6, 0, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'matrix' && (
        <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-6 space-y-4 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-cyan-400" />
              <span>Cohort Centroid Metric Comparison Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Side-by-side comparison of normalized scores (0-100) and raw centroid means across all {clusterData?.cohorts.length} cohorts.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-blue-950 bg-[#060F22]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-blue-900/60 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60">
                  <th className="py-3.5 px-4 font-bold">Evaluated Feature</th>
                  {clusterData?.cohorts.map((c) => (
                    <th key={c.cluster_id} className="py-3.5 px-4 font-bold text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-white">{c.name.split(':')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-950/60">
                {clusterData?.features_used.map((feat) => (
                  <tr key={feat} className="hover:bg-blue-950/30">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{feat}</td>
                    {clusterData.cohorts.map((c) => {
                      const score = c.normalized_scores[feat] ?? 50;
                      const raw = c.raw_means[feat];
                      return (
                        <td key={c.cluster_id} className="py-3.5 px-4 text-center">
                          <div className="space-y-1">
                            <span className="font-mono text-cyan-300 font-bold block text-xs">
                              {raw !== undefined ? raw.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '-'}
                            </span>
                            <div className="w-20 mx-auto bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(5, score)}%`,
                                  backgroundColor: score > 65 ? '#10B981' : score > 35 ? '#06B6D4' : '#F59E0B'
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">{score}/100</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEGMENTED COHORT PROFILE CARDS                            */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Discovered Cohort Personas ({clusterData?.cohorts.length || 0})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Click any cohort card to highlight spatial centroids and filter the sample data below.
            </p>
          </div>

          {activeCohortFilter !== 'all' && (
            <button
              onClick={() => setActiveCohortFilter('all')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>Reset to View All Cohorts</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {clusterData?.cohorts.map((cohort) => {
            const isSelected = selectedCohort?.cluster_id === cohort.cluster_id;
            const isFilterActive = activeCohortFilter === cohort.cluster_id;

            return (
              <Card3D
                key={cohort.cluster_id}
                maxTilt={8}
                onClick={() => {
                  setSelectedCohort(cohort);
                  setActiveCohortFilter(cohort.cluster_id);
                }}
                className={`p-5 sm:p-6 rounded-3xl border transition-all cursor-pointer space-y-4 backdrop-blur-xl ${
                  isSelected || isFilterActive
                    ? 'bg-[#0E2044] border-cyan-400 shadow-2xl shadow-cyan-500/20'
                    : 'bg-[#0B152B]/90 border-blue-900/60 hover:border-cyan-500/50 shadow-xl'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-md ring-2 ring-white/20"
                      style={{ backgroundColor: cohort.color || '#2563EB' }}
                    />
                    <h4 className="font-extrabold text-white text-sm tracking-tight">{cohort.name}</h4>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                    {cohort.record_count.toLocaleString()} ({cohort.record_percentage}%)
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed min-h-[38px]">{cohort.description}</p>

                {/* Trait Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider font-mono block">Top Driver</span>
                    <p className="text-white font-semibold truncate text-[11px]">{cohort.dominant_strength}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider font-mono block">Constraint</span>
                    <p className="text-white font-semibold truncate text-[11px]">{cohort.operational_drag}</p>
                  </div>
                </div>

                {/* Prescriptive Directive */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#060F22] to-[#0A1A3A] border border-cyan-500/30 text-xs text-slate-100 flex items-start gap-2.5 shadow-sm">
                  <Target className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-cyan-300 block mb-0.5 font-mono text-[10px] uppercase tracking-wider">Strategic Directive:</span>
                    <span className="text-slate-200 text-xs leading-relaxed">{cohort.recommendation}</span>
                  </div>
                </div>

                {/* Active Filter Indicator */}
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {isFilterActive ? '✓ Active Table Filter' : 'Click to filter records'}
                  </span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                    View Data <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Card3D>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* COHORT SAMPLE DATASET TABLE WITH SEARCH & FILTER          */}
      {/* ========================================================= */}
      <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 sm:p-7 space-y-4 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/40 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <span>Segmented Sample Dataset Records ({filteredSampleRecords.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              {activeCohortFilter === 'all'
                ? 'Showing records across all partitioned cohorts'
                : `Filtered to ${clusterData?.cohorts.find(c => c.cluster_id === activeCohortFilter)?.name}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search sample rows..."
                value={sampleSearch}
                onChange={(e) => setSampleSearch(e.target.value)}
                className="input-dark bg-[#070F22] border border-blue-900/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 w-44 sm:w-52"
                style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
              />
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedCsv ? 'Exported!' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Cohort Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setActiveCohortFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeCohortFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#060F22] text-slate-400 border border-blue-950 hover:border-slate-700'
            }`}
          >
            All Cohorts ({clusterData?.sample_records.length})
          </button>
          {clusterData?.cohorts.map((c) => (
            <button
              key={c.cluster_id}
              onClick={() => setActiveCohortFilter(c.cluster_id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeCohortFilter === c.cluster_id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-[#060F22] text-slate-400 border border-blue-950 hover:border-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name.split(':')[0]}</span>
            </button>
          ))}
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto rounded-2xl border border-blue-950 bg-[#060F22]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-blue-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60">
                <th className="px-4 py-3">Cohort Tier</th>
                {clusterData?.features_used.map((feat) => (
                  <th key={feat} className="px-4 py-3 text-right font-bold text-slate-300">
                    {feat.replace(/_/g, ' ').toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-950/60">
              {filteredSampleRecords.map((r, i) => (
                <tr key={i} className="hover:bg-blue-950/30 transition">
                  <td className="px-4 py-3 font-bold text-cyan-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm" />
                    {r._cluster_cohort || 'Cohort'}
                  </td>
                  {clusterData?.features_used.map((feat) => (
                    <td key={feat} className="px-4 py-3 text-right font-mono text-slate-200">
                      {typeof r[feat] === 'number'
                        ? r[feat].toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : r[feat] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredSampleRecords.length === 0 && (
                <tr>
                  <td colSpan={(clusterData?.features_used.length || 0) + 1} className="py-8 text-center text-slate-500 text-xs">
                    No records match the current filter or search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
