import React, { useState, useEffect } from 'react';
import {
  X,
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
  ArrowRight,
  Database,
  Grid,
  LayoutGrid
} from 'lucide-react';
import { api } from '../../services/api';
import { Dataset, DashboardSheet, TableMetadata } from '../../types';

interface MultiTableStudioModalProps {
  dataset: Dataset;
  sheets: DashboardSheet[];
  isOpen: boolean;
  onClose: () => void;
  onChartCreated: () => Promise<void>;
}

export const MultiTableStudioModal: React.FC<MultiTableStudioModalProps> = ({
  dataset,
  sheets,
  isOpen,
  onClose,
  onChartCreated
}) => {
  const tables = dataset.tables || [];
  const [primaryTable, setPrimaryTable] = useState<string>(tables[0]?.table_name || '');

  // Dynamic N-table join steps
  interface JoinStep {
    id: string;
    table: string;
    primaryKey: string;
    joinKey: string;
  }

  const [joinSteps, setJoinSteps] = useState<JoinStep[]>(() => {
    if (tables.length > 1) {
      return [{
        id: 'join-1',
        table: tables[1].table_name,
        primaryKey: '',
        joinKey: ''
      }];
    }
    return [];
  });

  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<{
    total_rows: number;
    total_columns: number;
    columns: string[];
    sample_data: any[];
  } | null>(null);

  // Chart builder state
  const [chartTitle, setChartTitle] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter'>('bar');
  const [xField, setXField] = useState<string>('');
  const [yField, setYField] = useState<string>('');
  const [targetSheetId, setTargetSheetId] = useState<string>(sheets[0]?.id || '');
  const [isCreatingChart, setIsCreatingChart] = useState<boolean>(false);
  const [activeStudioTab, setActiveStudioTab] = useState<'preview' | 'create'>('preview');

  // Helper to detect join keys between existing connected tables and a target table
  const detectJoinKeys = (connectedTableNames: string[], targetTable: string): { primaryKey: string; joinKey: string } => {
    const rels = dataset.relationships || [];
    for (const src of connectedTableNames) {
      const rel = rels.find(
        (r) =>
          (r.source_table === src && r.target_table === targetTable) ||
          (r.target_table === src && r.source_table === targetTable)
      );
      if (rel) {
        if (rel.source_table === targetTable) {
          return { primaryKey: rel.target_column, joinKey: rel.source_column };
        } else {
          return { primaryKey: rel.source_column, joinKey: rel.target_column };
        }
      }
    }

    // Fallback: match common column name
    const targetCols = tables.find((t) => t.table_name === targetTable)?.columns || [];
    for (const src of connectedTableNames) {
      const srcCols = tables.find((t) => t.table_name === src)?.columns || [];
      const common = srcCols.find((c1) => targetCols.some((c2) => c2.column_name.toLowerCase() === c1.column_name.toLowerCase()));
      if (common) {
        return { primaryKey: common.column_name, joinKey: common.column_name };
      }
    }

    return { primaryKey: '', joinKey: '' };
  };

  // Auto-detect keys when primaryTable or joinSteps change
  useEffect(() => {
    if (!primaryTable) return;
    setJoinSteps((prev) => {
      let changed = false;
      const updated = prev.map((step, idx) => {
        if (step.primaryKey && step.joinKey) return step;
        const connectedBefore = [primaryTable, ...prev.slice(0, idx).map((s) => s.table)];
        const detected = detectJoinKeys(connectedBefore, step.table);
        if (detected.primaryKey && detected.joinKey) {
          changed = true;
          return { ...step, primaryKey: detected.primaryKey, joinKey: detected.joinKey };
        }
        return step;
      });
      return changed ? updated : prev;
    });
  }, [primaryTable, dataset]);

  // 1-Click Auto-Connect All Reachable Tables across the dataset
  const handleAutoConnectAll = () => {
    if (!primaryTable || tables.length <= 1) return;
    const visited = [primaryTable];
    const newSteps: JoinStep[] = [];
    const queue = [primaryTable];

    while (queue.length > 0 && visited.length < tables.length) {
      const current = queue.shift()!;
      // Find all unvisited tables reachable from any visited table
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

    // If some tables had no direct relationships, add remaining with fallback
    for (const t of tables) {
      if (!visited.includes(t.table_name)) {
        visited.push(t.table_name);
        const keys = detectJoinKeys(visited.filter((x) => x !== t.table_name), t.table_name);
        newSteps.push({
          id: `join-${Date.now()}-${t.table_name}`,
          table: t.table_name,
          primaryKey: keys.primaryKey || t.columns?.[0]?.column_name || '',
          joinKey: keys.joinKey || t.columns?.[0]?.column_name || ''
        });
      }
    }

    setJoinSteps(newSteps);
  };

  const handleAddJoinStep = () => {
    const connected = [primaryTable, ...joinSteps.map((s) => s.table)];
    const available = tables.find((t) => !connected.includes(t.table_name));
    if (!available) return;

    const detected = detectJoinKeys(connected, available.table_name);
    setJoinSteps((prev) => [
      ...prev,
      {
        id: `join-${Date.now()}`,
        table: available.table_name,
        primaryKey: detected.primaryKey || available.columns?.[0]?.column_name || '',
        joinKey: detected.joinKey || available.columns?.[0]?.column_name || ''
      }
    ]);
  };

  const handleRemoveJoinStep = (id: string) => {
    setJoinSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateJoinStep = (id: string, updates: Partial<JoinStep>) => {
    setJoinSteps((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        // If table changed, re-detect keys
        if (updates.table && updates.table !== s.table) {
          const idx = prev.findIndex((x) => x.id === id);
          const connectedBefore = [primaryTable, ...prev.slice(0, idx).map((x) => x.table)];
          const detected = detectJoinKeys(connectedBefore, updates.table);
          updated.primaryKey = detected.primaryKey;
          updated.joinKey = detected.joinKey;
        }
        return updated;
      })
    );
  };

  // Execute preview fetch across all chained tables
  const handleLoadPreview = async () => {
    if (!primaryTable) return;
    setPreviewLoading(true);
    try {
      const payload: any = {
        primary_table: primaryTable
      };

      if (joinSteps.length > 0) {
        payload.join_table = joinSteps[0].table;
        payload.primary_key = joinSteps[0].primaryKey;
        payload.join_key = joinSteps[0].joinKey;

        if (joinSteps.length > 1) {
          payload.additional_joins = joinSteps.slice(1).map((s) => ({
            table: s.table,
            primary_key: s.primaryKey,
            join_key: s.joinKey
          }));
        }
      }

      const res = await api.getJoinedPreview(dataset.id, payload);
      setPreviewResult(res);

      // Set default fields for chart creation if available
      if (res.columns.length > 1) {
        setXField(res.columns[0]);
        setYField(res.columns[1]);
        const connectedCount = 1 + joinSteps.length;
        setChartTitle(`${connectedCount}-Table Unified Intelligence (${primaryTable} & ${joinSteps.map(s => s.table).join(', ')})`);
      }
    } catch (err) {
      console.error('Failed to preview joined tables:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && primaryTable) {
      handleLoadPreview();
    }
  }, [isOpen, primaryTable, joinSteps.length]);

  const handleCreateMultiTableChart = async () => {
    if (!targetSheetId || !chartTitle.trim()) return;
    setIsCreatingChart(true);
    try {
      const config: any = {};
      if (joinSteps.length > 0) {
        config.joins = joinSteps.map((s) => ({
          table: s.table,
          primary_key: s.primaryKey,
          join_key: s.joinKey
        }));
      }

      await api.createChart({
        sheet_id: targetSheetId,
        title: chartTitle.trim(),
        description: `Unified cross-table analysis joining ${primaryTable}${joinSteps.map((s) => ` ⟷ ${s.table}`).join('')}`,
        chart_type: chartType,
        table_name: primaryTable,
        join_table: joinSteps[0]?.table || undefined,
        primary_key: joinSteps[0]?.primaryKey || undefined,
        join_key: joinSteps[0]?.joinKey || undefined,
        x_field: xField,
        y_field: yField,
        aggregation: 'sum',
        config,
        grid_w: 6,
        grid_h: 4
      });

      await onChartCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create multi-table chart:', err);
    } finally {
      setIsCreatingChart(false);
    }
  };

  if (!isOpen) return null;

  const connectedTablesCount = 1 + joinSteps.length;
  const canAddMoreTables = joinSteps.length + 1 < tables.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fadeIn">
      <div className="glass-3d-card border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_40px_rgba(59,130,246,0.15)] relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-400 to-transparent pointer-events-none" />
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30 shadow-md">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Multi-Table Relational Studio</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-mono border border-brand-500/30 font-bold">
                  {connectedTablesCount} of {tables.length} Tables Connected
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Connect all possible tables across your dataset schema to preview unified records and synthesize multi-table charts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAddMoreTables && (
              <button
                onClick={handleAutoConnectAll}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600/30 to-indigo-600/30 border border-brand-500/40 text-brand-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-brand-600/40 transition shadow-sm"
                title="Automatically detect and connect all reachable tables"
              >
                <span>⚡ Auto-Connect All Tables</span>
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition active:translate-y-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Controls: Select Corresponding Tables & Dynamic Chained Joins */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/40 space-y-4 max-h-72 overflow-y-auto">
          {/* Relational Connection Breadcrumb */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 text-slate-300 font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold flex items-center gap-1">
              <Database className="w-3 h-3" />
              {primaryTable}
            </span>
            {joinSteps.map((s, i) => (
              <React.Fragment key={s.id}>
                <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                <span className="px-2.5 py-1 rounded-lg bg-brand-500/20 border border-brand-500/30 text-brand-300 font-bold flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  {s.table}
                  {s.joinKey && <span className="text-[10px] text-slate-400 font-normal">({s.joinKey})</span>}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Primary Table Card */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Primary Root Table</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">Root</span>
              </div>
              <select
                value={primaryTable}
                onChange={(e) => setPrimaryTable(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-brand-500 focus:outline-none font-mono"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.table_name}>
                    {t.table_name} ({t.row_count} rows)
                  </option>
                ))}
              </select>
            </div>

            {/* Chained Joins Cards */}
            {joinSteps.map((step, index) => {
              const connectedBefore = [primaryTable, ...joinSteps.slice(0, index).map((s) => s.table)];
              const availableTables = tables.filter((t) => !connectedBefore.includes(t.table_name) || t.table_name === step.table);
              const targetTableCols = tables.find((t) => t.table_name === step.table)?.columns || [];

              return (
                <div key={step.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <GitBranch className="w-3.5 h-3.5 text-brand-400" />
                      <span>Join #{index + 1} Table</span>
                    </div>
                    {joinSteps.length > 1 && (
                      <button
                        onClick={() => handleRemoveJoinStep(step.id)}
                        className="text-slate-500 hover:text-red-400 transition p-0.5 rounded"
                        title="Remove join step"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={step.table}
                    onChange={(e) => handleUpdateJoinStep(step.id, { table: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-brand-500 focus:outline-none font-mono"
                  >
                    {availableTables.map((t) => (
                      <option key={t.id} value={t.table_name}>
                        {t.table_name} ({t.row_count} rows)
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Parent Key</label>
                      <input
                        type="text"
                        placeholder="Key in chain..."
                        value={step.primaryKey}
                        onChange={(e) => handleUpdateJoinStep(step.id, { primaryKey: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded p-1.5 font-mono focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Join Key</label>
                      <input
                        type="text"
                        placeholder="Key in this table..."
                        value={step.joinKey}
                        onChange={(e) => handleUpdateJoinStep(step.id, { joinKey: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-[11px] text-white rounded p-1.5 font-mono focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Table to Chain Button */}
            {canAddMoreTables && (
              <div className="flex items-center justify-center p-4 border border-dashed border-slate-800 hover:border-slate-700 rounded-xl transition bg-slate-900/30">
                <button
                  type="button"
                  onClick={handleAddJoinStep}
                  className="flex flex-col items-center gap-1.5 text-xs text-slate-400 hover:text-brand-300 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-semibold">+ Add Table to Chain</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="tabs-3d-rail">
              <button
                onClick={() => setActiveStudioTab('preview')}
                className={`tab-3d-item ${
                  activeStudioTab === 'preview' ? 'tab-3d-item-active' : ''
                }`}
              >
                Joined Data Preview
              </button>
              <button
                onClick={() => setActiveStudioTab('create')}
                className={`tab-3d-item flex items-center gap-1.5 ${
                  activeStudioTab === 'create' ? 'tab-3d-item-active' : ''
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Produce Multi-Table Chart</span>
              </button>
            </div>

            <button
              onClick={handleLoadPreview}
              disabled={previewLoading}
              className="btn-3d-secondary px-3.5 py-1.5 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Play className="w-3 h-3 text-brand-400" />
              <span>{previewLoading ? 'Merging...' : 'Refresh Joined View'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeStudioTab === 'preview' && (
            <div>
              {previewLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Executing multi-table relational join...
                </div>
              ) : previewResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Showing sample records of{' '}
                      <strong className="text-white">{previewResult.total_rows.toLocaleString()}</strong> unified rows
                      across <strong className="text-white">{previewResult.total_columns}</strong> columns.
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      ✓ Join Keys Validated
                    </span>
                  </div>

                  <div className="table-3d-container max-h-72">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="table-3d-header">
                        <tr>
                          <th className="py-3 px-4 w-10 text-center text-slate-400 font-mono">#</th>
                          {previewResult.columns.map((c) => (
                            <th key={c} className="py-3 px-4 truncate max-w-xs font-semibold">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {previewResult.sample_data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-850/40 transition">
                            <td className="py-3 px-4 text-slate-400 text-center font-mono">{idx + 1}</td>
                            {previewResult.columns.map((c) => (
                              <td key={c} className="py-3 px-4 truncate max-w-xs font-mono text-[11px]">
                                {row[c] !== null && row[c] !== undefined ? String(row[c]) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs border-2 border-dashed border-slate-800 rounded-xl">
                  Select primary and join tables above and click &ldquo;Refresh Joined View&rdquo; to preview merged data.
                </div>
              )}
            </div>
          )}

          {activeStudioTab === 'create' && (
            <div className="space-y-4 max-w-xl mx-auto p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-400" />
                <span>Configure Multi-Table Visualization</span>
              </h4>

              {/* Chart Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Chart Title</label>
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="e.g., Revenue by Customer Segment & Country"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chart Type</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { type: 'bar', label: 'Bar', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                    { type: 'line', label: 'Line', icon: <LineChart className="w-3.5 h-3.5" /> },
                    { type: 'pie', label: 'Pie', icon: <PieChart className="w-3.5 h-3.5" /> },
                    { type: 'heatmap', label: 'Heatmap', icon: <Grid className="w-3.5 h-3.5 text-orange-400" /> },
                    { type: 'treemap', label: 'Treemap', icon: <LayoutGrid className="w-3.5 h-3.5 text-teal-400" /> },
                    { type: 'scatter', label: 'Scatter', icon: <ScatterChart className="w-3.5 h-3.5" /> }
                  ].map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setChartType(t.type as any)}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        chartType === t.type
                          ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Axes Selection from Combined Columns */}
              {previewResult && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      X-Axis (Dimension / Category)
                    </label>
                    <select
                      value={xField}
                      onChange={(e) => setXField(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-brand-500 focus:outline-none font-mono"
                    >
                      {previewResult.columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Y-Axis (Metric)
                    </label>
                    <select
                      value={yField}
                      onChange={(e) => setYField(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-brand-500 focus:outline-none font-mono"
                    >
                      {previewResult.columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Target Sheet */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Add to Dashboard Sheet
                </label>
                <select
                  value={targetSheetId}
                  onChange={(e) => setTargetSheetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-brand-500 focus:outline-none"
                >
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.sheet_type})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCreateMultiTableChart}
                disabled={isCreatingChart || !chartTitle.trim()}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/25 transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingChart ? 'Adding Chart...' : 'Add Multi-Table Chart to Dashboard'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/60 text-xs text-slate-400">
          <span>
            Corresponding pairs detected in dataset:{' '}
            <strong className="text-white">{dataset.relationships?.length || 0}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
