import React, { useState, useMemo } from 'react';
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
  LayoutGrid,
  Sparkles,
  Wand2,
  Palette,
  ArrowUpDown,
  Download,
  Info,
  Check,
  RefreshCw,
  Hash,
  Sliders
} from 'lucide-react';
import { DashboardChart, ColumnMetadata } from '../../types';
import { ChartRenderer, THEME_PALETTES } from './ChartRenderer';

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
  const [secondaryYField, setSecondaryYField] = useState(
    chart.secondary_y_field || chart.config?.secondary_y_field || ''
  );
  const [aggregation, setAggregation] = useState(chart.aggregation || 'sum');
  const [gridW, setGridW] = useState(chart.grid_w || 6);

  // Advanced Visual & Polish levers
  const [themePalette, setThemePalette] = useState<string>(chart.config?.palette || 'cyberpunk');
  const [sortOrder, setSortOrder] = useState<string>(chart.config?.sort_order || 'none');
  const [topN, setTopN] = useState<string>(chart.config?.top_n ? String(chart.config.top_n) : 'all');
  const [numberFormat, setNumberFormat] = useState<string>(chart.config?.number_format || 'auto');

  // Forecasting levers
  const [enableForecast, setEnableForecast] = useState<boolean>(Boolean(chart.config?.enable_forecast));
  const [forecastPeriods, setForecastPeriods] = useState<number>(chart.config?.forecast_periods || 6);

  const [isSaving, setIsSaving] = useState(false);
  const [autoTunedNotice, setAutoTunedNotice] = useState<string | null>(null);

  // Compute available columns combining primary table and optional join table
  const primaryTableCols = tables.find(t => t.table_name === tableName)?.columns || columns;
  const joinTableCols = joinTable ? (tables.find(t => t.table_name === joinTable)?.columns || []) : [];
  const combinedColumns = useMemo(() => [
    ...primaryTableCols.map(c => ({ ...c, display: `${tableName}.${c.column_name}` })),
    ...joinTableCols.map(c => ({ ...c, display: `${joinTable}.${c.column_name} (JOINED)` }))
  ], [primaryTableCols, joinTableCols, tableName, joinTable]);

  // Construct draft preview chart object with all reactive controls applied in real-time
  const previewChart: DashboardChart = useMemo(() => {
    return {
      ...chart,
      title: title || 'Untitled Visualization',
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
        palette: themePalette,
        sort_order: sortOrder === 'none' ? undefined : sortOrder,
        top_n: topN === 'all' ? undefined : Number(topN),
        number_format: numberFormat === 'auto' ? undefined : numberFormat,
        enable_forecast: (chartType === 'line' || chartType === 'area') ? enableForecast : false,
        forecast_periods: forecastPeriods,
        secondary_y_field: chartType === 'composed' ? (secondaryYField || undefined) : undefined
      },
      data: chart.data || []
    };
  }, [
    chart,
    title,
    description,
    chartType,
    tableName,
    joinTable,
    primaryKey,
    joinKey,
    xField,
    yField,
    secondaryYField,
    aggregation,
    gridW,
    themePalette,
    sortOrder,
    topN,
    numberFormat,
    enableForecast,
    forecastPeriods
  ]);

  // Calculate live preview statistics from chart.data
  const previewStats = useMemo(() => {
    const data = chart.data || [];
    if (data.length === 0) return null;

    let total = 0;
    let count = 0;
    let max = -Infinity;
    let min = Infinity;

    for (const d of data) {
      const v = typeof d.value === 'number' ? d.value : parseFloat(d.value);
      if (!isNaN(v)) {
        total += v;
        count++;
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }

    const avg = count > 0 ? total / count : 0;
    return {
      count: data.length,
      validNumericCount: count,
      total: isFinite(total) ? total : 0,
      avg: isFinite(avg) ? avg : 0,
      max: isFinite(max) ? max : 0,
      min: isFinite(min) ? min : 0
    };
  }, [chart.data]);

  if (!isOpen) return null;

  // AI Auto-Tune algorithm: analyzes schema, column types, and distributions to recommend optimal visualization
  const handleAIAutoTune = () => {
    const numCols = primaryTableCols.filter(c => c.data_type === 'numeric');
    const catCols = primaryTableCols.filter(c => c.data_type === 'categorical' || c.data_type === 'text');
    const dateCols = primaryTableCols.filter(c =>
      c.data_type === 'datetime' ||
      /date|time|year|month|day|quarter|period/i.test(c.column_name)
    );
    const geoCols = primaryTableCols.filter(c =>
      /country|city|state|region|territory|lat|lng|geo/i.test(c.column_name)
    );

    let chosenType: DashboardChart['chart_type'] = chartType;
    let chosenX = xField;
    let chosenY = yField;
    let chosenSecY = secondaryYField;
    let chosenPalette = themePalette;
    let chosenSort = sortOrder;
    let chosenTopN = topN;
    let newTitle = title;

    if (dateCols.length > 0 && numCols.length > 0) {
      chosenType = 'line';
      chosenX = dateCols[0].column_name;
      chosenY = numCols[0].column_name;
      setEnableForecast(true);
      chosenPalette = 'cyberpunk';
      newTitle = `${numCols[0].column_name.replace(/_/g, ' ')} Trajectory & Momentum`;
    } else if (geoCols.length > 0 && numCols.length > 0) {
      chosenType = 'map';
      chosenX = geoCols[0].column_name;
      chosenY = numCols[0].column_name;
      chosenPalette = 'emerald';
      newTitle = `${numCols[0].column_name.replace(/_/g, ' ')} Geospatial Distribution`;
    } else if (numCols.length >= 2 && catCols.length > 0) {
      chosenType = 'composed';
      chosenX = catCols[0].column_name;
      chosenY = numCols[0].column_name;
      chosenSecY = numCols[1].column_name;
      chosenPalette = 'corporate';
      chosenSort = 'desc';
      chosenTopN = '10';
      newTitle = `${numCols[0].column_name.replace(/_/g, ' ')} vs ${numCols[1].column_name.replace(/_/g, ' ')} by ${catCols[0].column_name.replace(/_/g, ' ')}`;
    } else if (catCols.length > 0 && numCols.length > 0) {
      chosenType = 'bar';
      chosenX = catCols[0].column_name;
      chosenY = numCols[0].column_name;
      chosenSort = 'desc';
      chosenTopN = '10';
      chosenPalette = 'sunset';
      newTitle = `Top ${numCols[0].column_name.replace(/_/g, ' ')} by ${catCols[0].column_name.replace(/_/g, ' ')}`;
    }

    setChartType(chosenType);
    if (chosenX) setXField(chosenX);
    if (chosenY) setYField(chosenY);
    if (chosenSecY) setSecondaryYField(chosenSecY);
    setThemePalette(chosenPalette);
    setSortOrder(chosenSort);
    setTopN(chosenTopN);
    setTitle(newTitle);

    setAutoTunedNotice('Auto-tuned chart type, metrics, palette, and sort order!');
    setTimeout(() => setAutoTunedNotice(null), 4000);
  };

  const handleExportCSV = () => {
    if (!chart.data || chart.data.length === 0) return;
    const headers = ['#', 'Label', 'Value', 'Secondary_Value', 'X', 'Y'];
    const rows = chart.data.map((d, i) => [
      i + 1,
      `"${String(d.label || '').replace(/"/g, '""')}"`,
      typeof d.value === 'object' && d.value !== null ? `"${JSON.stringify(d.value).replace(/"/g, '""')}"` : (d.value ?? ''),
      (d as any).secondary_value ?? '',
      d.x ?? '',
      d.y ?? ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          palette: themePalette,
          sort_order: sortOrder === 'none' ? undefined : sortOrder,
          top_n: topN === 'all' ? undefined : Number(topN),
          number_format: numberFormat === 'auto' ? undefined : numberFormat,
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
    { value: 'bar', label: 'Vertical Bar', icon: <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> },
    { value: 'horizontal_bar', label: 'Horizontal Bar', icon: <AlignLeft className="w-3.5 h-3.5 text-cyan-400" /> },
    { value: 'line', label: 'Line Series', icon: <LineChart className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'area', label: 'Area Gradient', icon: <TrendingUp className="w-3.5 h-3.5 text-teal-400" /> },
    { value: 'pie', label: 'Pie / Donut', icon: <PieChart className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'composed', label: 'Combo (Bar+Line)', icon: <Layers className="w-3.5 h-3.5 text-purple-400" /> },
    { value: 'treemap', label: 'Treemap Tiles', icon: <LayoutGrid className="w-3.5 h-3.5 text-pink-400" /> },
    { value: 'heatmap', label: 'Matrix Heatmap', icon: <Grid className="w-3.5 h-3.5 text-orange-400" /> },
    { value: 'radar', label: 'Radar Polygon', icon: <Compass className="w-3.5 h-3.5 text-indigo-300" /> },
    { value: 'map', label: 'Geographic Map', icon: <MapPin className="w-3.5 h-3.5 text-cyan-300" /> },
    { value: 'scatter', label: 'Scatter Plot', icon: <ScatterChart className="w-3.5 h-3.5 text-rose-400" /> },
    { value: 'table', label: 'Data Table', icon: <TableIcon className="w-3.5 h-3.5 text-slate-300" /> }
  ];

  const paletteKeys = Object.keys(THEME_PALETTES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5">
      <div className="bg-[#0B1120] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 via-cyan-500/20 to-blue-600/30 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shadow-md">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">Chart Studio & Visual Customizer</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                  Interactive Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-400">Refine metrics, styling, color palettes, and forecasting with real-time visual feedback</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAIAutoTune}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              title="Automatically choose the best chart type, metrics, and palette based on column distributions"
            >
              <Wand2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>AI Auto-Tune</span>
            </button>
            <button
              data-tour="chart-modal-close"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auto-Tuned Notice */}
        {autoTunedNotice && (
          <div className="px-6 py-2 bg-gradient-to-r from-cyan-600/20 via-indigo-600/20 to-transparent border-b border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>{autoTunedNotice}</span>
          </div>
        )}

        {/* Modal Body: Dual Pane Layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Panel: Configuration Controls (5 columns on desktop) */}
          <div className="lg:col-span-6 p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Chart Title & Description */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Chart Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Revenue Momentum by Region"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Analytical Subtitle / Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Highlights top-performing segments and outlier anomalies"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Table Selection & Optional Multi-Table Join */}
            {tables.length > 1 && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-cyan-400" />
                  <span>Data Source Binding</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Primary Table</label>
                    <select
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {tables.map(t => (
                        <option key={t.id} value={t.table_name}>{t.table_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Join Table (Optional)</label>
                    <select
                      value={joinTable}
                      onChange={(e) => setJoinTable(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Single Table</option>
                      {tables.filter(t => t.table_name !== tableName).map(t => (
                        <option key={t.id} value={t.table_name}>{t.table_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Chart Type Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">Visualization Type</label>
                <span className="text-[10px] text-slate-400 font-mono capitalize">Active: {chartType}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {chartTypeOptions.map((opt) => {
                  const isSelected = chartType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChartType(opt.value as any)}
                      className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition text-center ${
                        isSelected
                          ? 'bg-gradient-to-b from-cyan-500/20 to-indigo-600/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {opt.icon}
                      <span className="leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Axes & Dimensional Binding */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-indigo-400" />
                <span>Axes & Dimension Configuration</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">X-Axis (Dimension / Category)</label>
                  <select
                    value={xField}
                    onChange={(e) => setXField(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {combinedColumns.map((c, idx) => (
                      <option key={idx} value={c.column_name}>
                        {c.display || c.column_name} ({c.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Y-Axis (Primary Metric)</label>
                  <select
                    value={yField}
                    onChange={(e) => setYField(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
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
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Aggregation Function</label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="sum">SUM (Total Value)</option>
                    <option value="avg">AVG (Arithmetic Mean)</option>
                    <option value="min">MIN (Lowest Point)</option>
                    <option value="max">MAX (Highest Point)</option>
                    <option value="count">COUNT (Record Frequency)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Dashboard Grid Layout</label>
                  <select
                    value={gridW}
                    onChange={(e) => setGridW(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value={6}>Half Width (6 columns)</option>
                    <option value={12}>Full Width (12 columns)</option>
                  </select>
                </div>
              </div>

              {/* Secondary Y-Axis for Composed Dual-Metric Charts */}
              {chartType === 'composed' && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-[11px] text-indigo-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>Secondary Y-Axis Metric (Line Series Overlay)</span>
                  </label>
                  <select
                    value={secondaryYField}
                    onChange={(e) => setSecondaryYField(e.target.value)}
                    className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
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
            </div>

            {/* Sorting, Top N & Formatting Levers */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                <span>Presentation, Sorting & Limits</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Sort Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="none">Default Order</option>
                    <option value="desc">Highest First (Desc)</option>
                    <option value="asc">Lowest First (Asc)</option>
                    <option value="label">Alphabetical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Top-N Limit</label>
                  <select
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="all">All Points</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="20">Top 20</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Number Format</label>
                  <select
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="auto">Auto (Compact)</option>
                    <option value="currency">Currency ($)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Theme Palette Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Theme Color Palette</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paletteKeys.map((pKey) => {
                  const colors = THEME_PALETTES[pKey] || [];
                  const isSelected = themePalette === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => setThemePalette(pKey)}
                      className={`p-2 rounded-xl border text-left flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-cyan-400 text-white ring-1 ring-cyan-400/30'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-[11px] font-semibold capitalize">{pKey}</span>
                      <div className="flex items-center gap-0.5">
                        {colors.slice(0, 4).map((c, i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

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

          {/* Right Panel: Live Interactive Preview (6 columns on desktop) */}
          <div className="lg:col-span-6 p-5 sm:p-6 flex flex-col justify-between bg-slate-950/50 space-y-4">
            {/* Live Preview Header Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">Live Visual Canvas</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {chartType} &bull; {themePalette}
                </span>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 text-[11px] text-slate-300 hover:text-cyan-300 transition flex items-center gap-1.5"
                title="Export preview data points as CSV"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Real-time Render Canvas */}
            <div className="flex-1 min-h-[300px] h-[360px] w-full bg-[#0F172A]/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col shadow-inner overflow-hidden relative">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{title || 'Visualization Title'}</h4>
                  {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
                </div>
              </div>

              <div className="flex-1 w-full h-full relative">
                <ChartRenderer chart={previewChart} />
              </div>
            </div>

            {/* Quick KPI Statistics Ribbon */}
            {previewStats && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Data Points</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">{previewStats.count}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Sum Total</div>
                  <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                    {previewStats.total >= 1000 ? `${(previewStats.total / 1000).toFixed(1)}k` : previewStats.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Average</div>
                  <div className="text-xs font-mono font-bold text-indigo-300 mt-0.5">
                    {previewStats.avg >= 1000 ? `${(previewStats.avg / 1000).toFixed(1)}k` : previewStats.avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Peak (Max)</div>
                  <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                    {previewStats.max >= 1000 ? `${(previewStats.max / 1000).toFixed(1)}k` : previewStats.max.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Feedback Tip */}
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-slate-400 flex items-center gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Changes update the live canvas above immediately. Clicking &ldquo;Apply &amp; Render&rdquo; permanently persists changes to your dashboard sheet.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Apply & Render'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
