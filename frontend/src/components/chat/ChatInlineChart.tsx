import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Treemap
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Table as TableIcon,
  Grid as GridIcon,
  LayoutGrid as TreemapIcon,
  Plus,
  Check,
  ArrowRight,
  Sparkles,
  FileText,
  Download
} from 'lucide-react';
import { api } from '../../services/api';

export interface InlineChartData {
  title: string;
  chart_type?: string;
  x_field?: string;
  y_field?: string;
  aggregation?: string;
  table_name?: string;
  data: Array<{ label: string; value: any; x?: number | string; y?: number | string; intensity?: number; share_pct?: number; name?: string }>;
}

interface ChatInlineChartProps {
  chart: InlineChartData;
  datasetId: string;
  activeSheetId?: string;
  onViewDashboard?: () => void;
  onViewReport?: () => void;
}

const COLORS = [
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#0d9488', // Teal
  '#3b82f6', // Blue
  '#38bdf8', // Light Sky Blue
];

export const ChatInlineChart: React.FC<ChatInlineChartProps> = ({
  chart,
  datasetId,
  activeSheetId,
  onViewDashboard,
  onViewReport
}) => {
  const [activeType, setActiveType] = useState<string>(
    (chart.chart_type || 'bar').toLowerCase()
  );
  const [isPinning, setIsPinning] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [pinnedTitle, setPinnedTitle] = useState<string>('');

  const data = chart.data || [];

  if (!data || data.length === 0) {
    return null;
  }

  const handlePin = async () => {
    if (isPinning || isPinned) return;
    setIsPinning(true);
    try {
      const res = await api.pinChartToDashboard(
        datasetId,
        {
          ...chart,
          chart_type: activeType
        },
        activeSheetId
      );
      setIsPinned(true);
      setPinnedTitle(res.title || chart.title);
    } catch (err) {
      console.error('Failed to pin chart:', err);
    } finally {
      setIsPinning(false);
    }
  };

  const handleExportCsv = () => {
    if (!data || data.length === 0) return;
    const headers = [chart.x_field || 'Label', chart.y_field || 'Value'];
    const rows = data.map(d => [d.label, typeof d.value === 'number' ? d.value : `"${d.value}"`]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(chart.title || 'chart').toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTooltipValue = (value: any) => {
    if (typeof value === 'number') {
      return value >= 1000 ? value.toLocaleString() : value;
    }
    return value;
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg shadow-black/40 space-y-3">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Sparkles className="w-3 h-3" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <span>{chart.title}</span>
              {chart.table_name && (
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  {chart.table_name}
                </span>
              )}
            </h4>
            {chart.x_field && chart.y_field && (
              <p className="text-[10px] text-slate-400">
                {chart.aggregation ? `${chart.aggregation.toUpperCase()}(${chart.y_field})` : chart.y_field} grouped by {chart.x_field}
              </p>
            )}
          </div>
        </div>

        {/* View Type Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg text-[10px]">
          <button
            onClick={() => setActiveType('bar')}
            title="Bar Chart"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'bar'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span className="hidden sm:inline">Bar</span>
          </button>
          <button
            onClick={() => setActiveType('line')}
            title="Line Trend"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'line'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span className="hidden sm:inline">Line</span>
          </button>
          <button
            onClick={() => setActiveType('pie')}
            title="Donut Distribution"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'pie'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieIcon className="w-3 h-3" />
            <span className="hidden sm:inline">Pie</span>
          </button>
          <button
            onClick={() => setActiveType('heatmap')}
            title="Heat Map"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'heatmap'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GridIcon className="w-3 h-3 text-orange-400" />
            <span className="hidden sm:inline">Heatmap</span>
          </button>
          <button
            onClick={() => setActiveType('treemap')}
            title="Tree Map"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'treemap'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TreemapIcon className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Treemap</span>
          </button>
          <button
            onClick={() => setActiveType('table')}
            title="Table View"
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              activeType === 'table'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TableIcon className="w-3 h-3" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Chart Visualization Body */}
      <div className="w-full h-60 pt-2 pb-1">
        {activeType === 'line' || activeType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 12, bottom: 22 }}>
              <defs>
                <linearGradient id="inlineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                width={42}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={formatTooltipValue}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#inlineAreaGrad)"
                dot={{ fill: '#6366f1', r: 3.5 }}
                activeDot={{ r: 5, fill: '#a5b4fc' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : activeType === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={68}
                paddingAngle={2}
                label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={formatTooltipValue}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : activeType === 'heatmap' ? (
          /* Inline Heatmap Matrix View */
          <div className="h-full overflow-auto custom-scrollbar p-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 h-full">
              {data.slice(0, 9).map((item, idx) => {
                const val = typeof item.value === 'number' ? item.value : 0;
                const intensity = item.intensity !== undefined ? item.intensity : Math.min(1.0, (idx + 1) / Math.min(data.length, 9));
                return (
                  <div
                    key={idx}
                    className="rounded-lg p-2 flex flex-col justify-between border border-slate-800 transition hover:border-cyan-400/60"
                    style={{
                      backgroundColor: `rgba(6, 182, 212, ${Math.max(0.12, intensity * 0.75)})`
                    }}
                  >
                    <span className="text-[10px] text-slate-300 font-semibold truncate">{item.label || item.x}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono font-bold text-white">
                        {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString()}
                      </span>
                      {item.share_pct && (
                        <span className="text-[9px] font-mono text-cyan-300">{item.share_pct}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeType === 'treemap' ? (
          /* Inline Treemap View */
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data.map((d, i) => ({
                name: d.label || d.name || `Node ${i + 1}`,
                value: typeof d.value === 'number' ? d.value : 1,
                size: typeof d.value === 'number' ? d.value : 1
              }))}
              dataKey="value"
              stroke="#0B1120"
              isAnimationActive={true}
            >
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={formatTooltipValue}
              />
            </Treemap>
          </ResponsiveContainer>
        ) : activeType === 'table' ? (
          <div className="overflow-x-auto h-full text-[11px] scrollbar-thin">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-2 font-medium">{chart.x_field || 'Label'}</th>
                  <th className="p-2 font-medium text-right">{chart.y_field || 'Value'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="p-2 text-slate-200 font-medium">{row.label}</td>
                    <td className="p-2 text-slate-300 font-mono text-right">
                      {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Default Bar Chart */
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 16, left: 12, bottom: 22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                width={42}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#f8fafc'
                }}
                formatter={formatTooltipValue}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 mt-2 text-[11px]">
        <div className="flex items-center gap-2">
          {!isPinned ? (
            <button
              onClick={handlePin}
              disabled={isPinning}
              className="px-2.5 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/40 text-brand-300 hover:text-white font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPinning ? 'Pinning...' : 'Pin to Dashboard'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Pinned to Sheet</span>
              </span>
              {onViewDashboard && (
                <button
                  onClick={onViewDashboard}
                  className="text-brand-400 hover:text-brand-300 underline flex items-center gap-0.5"
                >
                  <span>View on Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            title="Download CSV dataset"
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>

          {onViewReport && (
            <button
              onClick={onViewReport}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px] transition"
            >
              <FileText className="w-3 h-3" />
              <span>Include in Report</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
