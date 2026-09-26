import React, { useState } from 'react';
import {
  X,
  Save,
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  Table as TableIcon,
  TrendingUp,
  Layers,
  Compass,
  MapPin,
  AlignLeft,
  Grid,
  LayoutGrid
} from 'lucide-react';
import { DashboardChart, ColumnMetadata } from '../../types';

interface ChartEditorModalProps {
  chart: DashboardChart;
  columns: ColumnMetadata[];
  tables?: Array<{ id: string; table_name: string; columns: ColumnMetadata[] }>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<DashboardChart>) => Promise<void>;
}

export const ChartEditorModal: React.FC<ChartEditorModalProps> = ({
  chart,
  columns,
  tables = [],
  isOpen,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState(chart.title);
  const [description, setDescription] = useState(chart.description || '');
  const [chartType, setChartType] = useState(chart.chart_type);
  const [tableName, setTableName] = useState(chart.table_name);
  const [joinTable, setJoinTable] = useState(chart.join_table || '');
  const [primaryKey, setPrimaryKey] = useState(chart.primary_key || '');
  const [joinKey, setJoinKey] = useState(chart.join_key || '');
  const [xField, setXField] = useState(chart.x_field || '');
  const [yField, setYField] = useState(chart.y_field || '');
  const [secondaryYField, setSecondaryYField] = useState(chart.secondary_y_field || chart.config?.secondary_y_field || '');
  const [aggregation, setAggregation] = useState(chart.aggregation || 'sum');
  const [gridW, setGridW] = useState(chart.grid_w || 6);
  const [enableForecast, setEnableForecast] = useState<boolean>(Boolean(chart.config?.enable_forecast));
  const [forecastPeriods, setForecastPeriods] = useState<number>(chart.config?.forecast_periods || 6);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Compute available columns combining primary table and optional join table
  const primaryTableCols = tables.find(t => t.table_name === tableName)?.columns || columns;
  const joinTableCols = joinTable ? (tables.find(t => t.table_name === joinTable)?.columns || []) : [];
  const combinedColumns = [
    ...primaryTableCols.map(c => ({ ...c, display: `${tableName}.${c.column_name}` })),
    ...joinTableCols.map(c => ({ ...c, display: `${joinTable}.${c.column_name} (JOINED)` }))
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title,
        description,
        chart_type: chartType as any,
        table_name: tableName,
        join_table: joinTable || undefined,
        primary_key: primaryKey || undefined,
        join_key: joinKey || undefined,
        x_field: xField,
        y_field: yField,
        secondary_y_field: chartType === 'composed' ? (secondaryYField || undefined) : undefined,
        aggregation,
        grid_w: gridW,
        config: {
          ...(chart.config || {}),
          enable_forecast: (chartType === 'line' || chartType === 'area') ? enableForecast : false,
          forecast_periods: forecastPeriods,
          secondary_y_field: chartType === 'composed' ? (secondaryYField || undefined) : undefined
        }
      });
      onClose();
    } catch (err) {
      console.error('Failed to update chart:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const chartTypeOptions = [
    { value: 'bar', label: 'Vertical Bar', icon: <BarChart3 className="w-4 h-4 text-indigo-400" /> },
    { value: 'horizontal_bar', label: 'Horizontal Bar', icon: <AlignLeft className="w-4 h-4 text-cyan-400" /> },
    { value: 'line', label: 'Line Chart', icon: <LineChart className="w-4 h-4 text-emerald-400" /> },
    { value: 'pie', label: 'Pie / Donut', icon: <PieChart className="w-4 h-4 text-amber-400" /> },
    { value: 'heatmap', label: 'Matrix Heatmap', icon: <Grid className="w-4 h-4 text-orange-400" /> },
    { value: 'treemap', label: 'Portfolio Treemap', icon: <LayoutGrid className="w-4 h-4 text-teal-400" /> },
    { value: 'composed', label: 'Composed (Combo)', icon: <Layers className="w-4 h-4 text-brand-400" /> },
    { value: 'radar', label: 'Radar / Spider', icon: <Compass className="w-4 h-4 text-purple-400" /> },
    { value: 'map', label: 'Geographic Map', icon: <MapPin className="w-4 h-4 text-teal-400" /> },
    { value: 'scatter', label: 'Scatter Plot', icon: <ScatterChart className="w-4 h-4 text-pink-400" /> },
    { value: 'table', label: 'Data Table', icon: <TableIcon className="w-4 h-4 text-slate-300" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Edit Visualization</h3>
            <p className="text-xs text-slate-400">Configure single-table or cross-table joined charts</p>
          </div>
          <button
            data-tour="chart-modal-close"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chart Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Table & Optional Cross-Table Join */}
          {tables.length > 1 && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Table</label>
                <select
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.table_name}>{t.table_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Join with Table (Optional)</label>
                <select
                  value={joinTable}
                  onChange={(e) => setJoinTable(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="">None (Single Table)</option>
                  {tables.filter(t => t.table_name !== tableName).map(t => (
                    <option key={t.id} value={t.table_name}>{t.table_name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Chart Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chart Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {chartTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChartType(opt.value as any)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition ${
                    chartType === opt.value
                      ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Axes Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">X-Axis (Dimension / Date)</label>
              <select
                value={xField}
                onChange={(e) => setXField(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                {combinedColumns.map((c, idx) => (
                  <option key={idx} value={c.column_name}>
                    {c.display || c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Y-Axis (Metric)</label>
              <select
                value={yField}
                onChange={(e) => setYField(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                {combinedColumns.map((c, idx) => (
                  <option key={idx} value={c.column_name}>
                    {c.display || c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Aggregation Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Aggregation Function</label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="sum">SUM (Total)</option>
                <option value="avg">AVG (Average)</option>
                <option value="min">MIN (Minimum)</option>
                <option value="max">MAX (Maximum)</option>
                <option value="count">COUNT (Frequency)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Width Layout</label>
              <select
                value={gridW}
                onChange={(e) => setGridW(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                <option value={6}>Half Width (6 columns)</option>
                <option value={12}>Full Width (12 columns)</option>
              </select>
            </div>
          </div>

          {/* Secondary Y-Axis for Composed Dual-Metric Charts */}
          {chartType === 'composed' && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-brand-950/40 to-indigo-950/40 border border-brand-500/30 space-y-2">
              <div className="flex items-center gap-2 text-brand-300 font-semibold text-xs">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Secondary Y-Axis Metric (Line Series)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Primary metric ({yField || 'Y-Axis'}) renders as vertical bars; select a second metric to overlay as a trend line.
              </p>
              <select
                value={secondaryYField}
                onChange={(e) => setSecondaryYField(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="">Auto (Select second numeric column)</option>
                {combinedColumns.map((c, idx) => (
                  <option key={idx} value={c.column_name}>
                    {c.display || c.column_name} ({c.data_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time-Series Forecasting Options (Line & Area charts only) */}
          {(chartType === 'line' || chartType === 'area') && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 to-brand-950/30 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-semibold text-white block">AI Time-Series Forecasting</span>
                    <span className="text-[11px] text-slate-400 block">Holt's Linear Model with 95% Confidence Intervals</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableForecast}
                    onChange={(e) => setEnableForecast(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {enableForecast && (
                <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                  <label className="text-xs text-slate-300 font-medium">Forecast Horizon</label>
                  <select
                    value={forecastPeriods}
                    onChange={(e) => setForecastPeriods(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={3}>Next 3 Periods</option>
                    <option value={6}>Next 6 Periods</option>
                    <option value={12}>Next 12 Periods</option>
                    <option value={24}>Next 24 Periods</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Apply Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
