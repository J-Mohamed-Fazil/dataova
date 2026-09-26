import React, { useState, useEffect } from 'react';
import {
  X,
  GitPullRequest,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowDownRight,
  ShieldAlert,
  CheckCircle2,
  Table,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import {
  DriverTreeResponse,
  DriverTreeNode,
  DriverTreeConfigResponse,
  DriverTreeCandidateMetric,
  KpiMetric
} from '../../types';

interface DriverTreeModalProps {
  datasetId: string;
  datasetName: string;
  selectedKpi?: KpiMetric | null;
  initialMetric?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DriverTreeModal: React.FC<DriverTreeModalProps> = ({
  datasetId,
  datasetName,
  selectedKpi,
  initialMetric,
  isOpen,
  onClose
}) => {
  const [treeData, setTreeData] = useState<DriverTreeResponse | null>(null);
  const [config, setConfig] = useState<DriverTreeConfigResponse | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<DriverTreeCandidateMetric[]>([]);
  const [availableDims, setAvailableDims] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<{ table_name: string; row_count: number }[]>([]);

  // Selection state
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');
  const [selectedDim1, setSelectedDim1] = useState<string>('');
  const [selectedDim2, setSelectedDim2] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load config & tree on open or when target KPI changes
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

    const loadTree = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const targetTable = selectedKpi?.source_table || undefined;
        const targetCalcType = selectedKpi?.calculation_type || undefined;
        const targetKpiName = selectedKpi?.name || undefined;
        const targetDisplayName = selectedKpi?.display_name || undefined;
        const targetUnit = selectedKpi?.unit || undefined;

        // Determine initial metric ID
        let initialMetricId = '';
        if (selectedKpi) {
          if (selectedKpi.calculation_type === 'count' || selectedKpi.name === 'total_records') {
            initialMetricId = '__count__';
          } else if (selectedKpi.calculation_type === 'unique' || selectedKpi.name.startsWith('distinct_')) {
            initialMetricId = selectedKpi.name.startsWith('distinct_')
              ? selectedKpi.name
              : `distinct_${selectedKpi.source_column || selectedKpi.name}`;
          } else {
            initialMetricId = selectedKpi.source_column || selectedKpi.column_name || selectedKpi.name;
          }
        } else if (initialMetric) {
          initialMetricId = initialMetric;
        }

        const treeConfig = await api.getDriverTreeConfig(datasetId, targetTable);
        if (!isSubscribed) return;

        setConfig(treeConfig);
        setSelectedTable(treeConfig.table_name || targetTable || '');

        if (treeConfig.all_tables) {
          setAvailableTables(treeConfig.all_tables);
        }

        const metrics: DriverTreeCandidateMetric[] = treeConfig.available_metrics || [
          {
            id: '__count__',
            label: 'Total Record Volume / Transactions (Count)',
            calculation_type: 'count',
            unit: 'Count'
          },
          ...(treeConfig.all_numeric_columns || []).map((col: string) => ({
            id: col,
            label: `${col.replace(/_/g, ' ').toUpperCase()} (Sum)`,
            column: col,
            calculation_type: 'sum'
          }))
        ];
        setAvailableMetrics(metrics);
        setAvailableDims(treeConfig.all_dimension_columns || []);

        const metricToUse = initialMetricId || treeConfig.default_metric || metrics[0]?.id || '__count__';
        const dim1 = treeConfig.default_dimensions?.[0] || treeConfig.all_dimension_columns?.[0] || '';
        const dim2 = treeConfig.default_dimensions?.[1] || treeConfig.all_dimension_columns?.[1] || '';

        setSelectedMetricId(metricToUse);
        setSelectedDim1(dim1);
        setSelectedDim2(dim2);

        const dims = [dim1, dim2].filter(Boolean);
        const res = await api.getDriverTree(datasetId, {
          metric_col: metricToUse,
          dimension_cols: dims,
          table_name: treeConfig.table_name || targetTable,
          calculation_type: targetCalcType,
          kpi_name: targetKpiName,
          unit: targetUnit,
          display_name: targetDisplayName
        });

        if (!isSubscribed) return;
        setTreeData(res);
        setExpandedNodes({ root: true });
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error('Failed to load driver tree:', err);
        setErrorMsg(err.message || 'Failed to decompose driver hierarchy');
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    loadTree();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, datasetId, selectedKpi, initialMetric]);

  // Handle table switch in multi-table dataset
  const handleTableChange = async (newTable: string) => {
    setSelectedTable(newTable);
    try {
      setLoading(true);
      setErrorMsg(null);
      const treeConfig = await api.getDriverTreeConfig(datasetId, newTable);
      setConfig(treeConfig);
      setAvailableDims(treeConfig.all_dimension_columns || []);

      const metrics: DriverTreeCandidateMetric[] = treeConfig.available_metrics || [
        {
          id: '__count__',
          label: 'Total Record Volume / Transactions (Count)',
          calculation_type: 'count',
          unit: 'Count'
        },
        ...(treeConfig.all_numeric_columns || []).map((col: string) => ({
          id: col,
          label: `${col.replace(/_/g, ' ').toUpperCase()} (Sum)`,
          column: col,
          calculation_type: 'sum'
        }))
      ];
      setAvailableMetrics(metrics);

      const metricToUse = treeConfig.default_metric || metrics[0]?.id || '__count__';
      const dim1 = treeConfig.default_dimensions?.[0] || treeConfig.all_dimension_columns?.[0] || '';
      const dim2 = treeConfig.default_dimensions?.[1] || treeConfig.all_dimension_columns?.[1] || '';

      setSelectedMetricId(metricToUse);
      setSelectedDim1(dim1);
      setSelectedDim2(dim2);

      const dims = [dim1, dim2].filter(Boolean);
      const res = await api.getDriverTree(datasetId, {
        metric_col: metricToUse,
        dimension_cols: dims,
        table_name: newTable
      });
      setTreeData(res);
      setExpandedNodes({ root: true });
    } catch (err: any) {
      console.error('Failed to change table:', err);
      setErrorMsg(err.message || 'Failed to decompose table');
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async (metric?: string, d1?: string, d2?: string) => {
    const m = metric !== undefined ? metric : selectedMetricId;
    const dim1 = d1 !== undefined ? d1 : selectedDim1;
    const dim2 = d2 !== undefined ? d2 : selectedDim2;

    const foundCandidate = availableMetrics.find((c) => c.id === m);

    try {
      setLoading(true);
      setErrorMsg(null);
      const dims = [dim1, dim2].filter(Boolean);
      const res = await api.getDriverTree(datasetId, {
        metric_col: m,
        dimension_cols: dims,
        table_name: selectedTable || undefined,
        calculation_type: foundCandidate?.calculation_type,
        unit: foundCandidate?.unit,
        display_name: foundCandidate?.label
      });
      setTreeData(res);
      setExpandedNodes({ root: true });
    } catch (err: any) {
      console.error('Failed to rebuild tree:', err);
      setErrorMsg(err.message || 'Failed to rebuild tree');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Dynamic formatting utility avoiding hardcoded currency signs
  const formatValue = (val: number, isMonetary?: boolean, unit?: string) => {
    if (isMonetary) {
      return `$${val.toLocaleString(undefined, {
        minimumFractionDigits: val % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      })}`;
    }
    if (Math.abs(val) >= 1e9) {
      return `${(val / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(val) >= 1e6) {
      return `${(val / 1e6).toFixed(2)}M`;
    }
    const formatted = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (unit && unit !== 'Units' && unit !== 'Count' && unit !== 'None' && unit !== 'Currency') {
      return `${formatted} ${unit}`;
    }
    return formatted;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-4 animate-fadeIn">
      <div className="glass-3d-card border border-slate-700/80 rounded-3xl w-full max-w-5xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_50px_rgba(16,185,129,0.15)] flex flex-col max-h-[92vh] relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  Visual Metric Driver Tree
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 font-bold uppercase">
                  {treeData?.calculation_type || selectedKpi?.calculation_type || 'Root-Cause Decomposition'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Decomposing {treeData?.metric_name || selectedKpi?.display_name || 'key metric'} attribution across cascading hierarchies for{' '}
                <span className="text-slate-300 font-semibold">{datasetName}</span>
                {selectedTable ? ` (${selectedTable})` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner if any */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center gap-2 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400">Decomposing metric attribution across hierarchies...</p>
          </div>
        ) : treeData ? (
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {/* Interactive Selectors Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {/* Table Selector (shown if multiple tables exist) */}
                {availableTables.length > 1 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                      <Table className="w-3 h-3 text-cyan-400" />
                      <span>Table</span>
                    </label>
                    <select
                      value={selectedTable}
                      onChange={(e) => handleTableChange(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-semibold"
                    >
                      {availableTables.map((t) => (
                        <option key={t.table_name} value={t.table_name}>
                          {t.table_name} ({t.row_count.toLocaleString()} rows)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Metric Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span>Root Metric</span>
                  </label>
                  <select
                    value={selectedMetricId}
                    onChange={(e) => {
                      setSelectedMetricId(e.target.value);
                      handleRebuild(e.target.value);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-bold"
                  >
                    {availableMetrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Hierarchy Selector */}
                {availableDims.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                      Primary Hierarchy (Level 1)
                    </label>
                    <select
                      value={selectedDim1}
                      onChange={(e) => {
                        setSelectedDim1(e.target.value);
                        handleRebuild(undefined, e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {availableDims.map((d) => (
                        <option key={d} value={d}>
                          {d.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-Hierarchy Selector */}
                {availableDims.length > 1 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                      Sub-Hierarchy (Level 2)
                    </label>
                    <select
                      value={selectedDim2}
                      onChange={(e) => {
                        setSelectedDim2(e.target.value);
                        handleRebuild(undefined, undefined, e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">None (Level 1 Only)</option>
                      {availableDims
                        .filter((d) => d !== selectedDim1)
                        .map((d) => (
                          <option key={d} value={d}>
                            {d.replace(/_/g, ' ').toUpperCase()}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Total Aggregate Badge */}
              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">
                  Total {treeData.metric_name || 'Metric Sum'}
                </span>
                <span className="text-xl font-black font-mono text-emerald-400 drop-shadow-md">
                  {treeData.formatted_total || formatValue(treeData.total_value, treeData.is_monetary, treeData.unit)}
                </span>
              </div>
            </div>

            {/* Diagnostic Spotlight: Primary Drag vs Growth Leader */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Drag Card */}
              {treeData.primary_drag && treeData.primary_drag.segment && (
                <div className="card-3d-interactive p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/20 border border-rose-500/40 space-y-2 shadow-md hover:shadow-rose-500/10">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Primary Operational Drag</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">
                      {treeData.primary_drag.segment}
                    </span>
                    <div className="text-right font-mono">
                      <span className="text-xs text-rose-300 block font-bold">
                        {formatValue(treeData.primary_drag.value, treeData.is_monetary, treeData.unit)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {treeData.primary_drag.share_pct}% of total
                      </span>
                    </div>
                  </div>
                  {treeData.primary_drag.recommendation && (
                    <p className="text-xs text-slate-400 pt-1 border-t border-rose-500/20">
                      {treeData.primary_drag.recommendation}
                    </p>
                  )}
                </div>
              )}

              {/* Growth Leader Card */}
              {treeData.growth_leader && treeData.growth_leader.segment && (
                <div className="card-3d-interactive p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/20 border border-emerald-500/40 space-y-2 shadow-md hover:shadow-emerald-500/10">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Primary Growth Engine</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">
                      {treeData.growth_leader.segment}
                    </span>
                    <div className="text-right font-mono">
                      <span className="text-xs text-emerald-300 block font-bold">
                        {formatValue(treeData.growth_leader.value, treeData.is_monetary, treeData.unit)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {treeData.growth_leader.share_pct}% of total
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 pt-1 border-t border-emerald-500/20">
                    Strongest volume generator across {treeData.dimensions_used[0] || 'hierarchy'}. Prioritize supply stability and resource allocation.
                  </p>
                </div>
              )}
            </div>

            {/* Hierarchical Interactive Tree Explorer */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cascading Driver Hierarchy</span>
              </h4>

              {/* Root Card */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      ∑
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white block">
                        {treeData.tree.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Root Aggregate • 100% of volume
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-emerald-300">
                    {treeData.formatted_total || formatValue(treeData.tree.value, treeData.is_monetary, treeData.unit)}
                  </span>
                </div>

                {/* Level 1 Children Cards */}
                <div className="pl-3 sm:pl-4 space-y-2 border-l-2 border-slate-800 ml-3.5 pt-2">
                  {treeData.tree.children?.map((l1Node) => {
                    const isExpanded = expandedNodes[l1Node.id];
                    const hasChildren = Boolean(l1Node.children && l1Node.children.length > 0);

                    return (
                      <div key={l1Node.id} className="space-y-2">
                        <div
                          onClick={() => hasChildren && toggleExpand(l1Node.id)}
                          className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                            l1Node.status === 'growth_leader'
                              ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500'
                              : l1Node.status === 'primary_drag'
                              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {hasChildren ? (
                              isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {l1Node.label}
                                </span>
                                {l1Node.status === 'growth_leader' && (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                    LEADER
                                  </span>
                                )}
                                {l1Node.status === 'primary_drag' && (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                    DRAG
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {l1Node.share_of_total_pct}% of total volume
                              </span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-white block">
                              {formatValue(l1Node.value, treeData.is_monetary, treeData.unit)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {l1Node.share_of_total_pct}%
                            </span>
                          </div>
                        </div>

                        {/* Level 2 Sub-children */}
                        {isExpanded && hasChildren && (
                          <div className="pl-4 sm:pl-6 space-y-1.5 border-l-2 border-slate-800/80 ml-3">
                            {l1Node.children?.map((l2Node) => (
                              <div
                                key={l2Node.id}
                                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 font-medium">
                                    {l2Node.label}
                                  </span>
                                  {l2Node.status === 'growth_leader' && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                      TOP
                                    </span>
                                  )}
                                  {l2Node.status === 'primary_drag' && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                      DRAG
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 font-mono">
                                  <span className="text-slate-300">
                                    {formatValue(l2Node.value, treeData.is_monetary, treeData.unit)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({l2Node.share_of_parent_pct}% of {l1Node.label})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
