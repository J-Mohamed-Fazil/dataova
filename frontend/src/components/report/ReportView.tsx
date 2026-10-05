import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  Save,
  Sparkles,
  Check,
  RefreshCw,
  Database,
  TrendingUp,
  TrendingDown,
  PieChart,
  ShieldCheck,
  Layers,
  AlertTriangle,
  Table as TableIcon,
  BarChart3,
  Activity,
  Lightbulb,
  LayoutDashboard,
  Zap,
  ChevronRight,
  ChevronDown,
  Info,
  Presentation,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Compass,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  BookOpen,
  Eye,
  Printer,
  Copy,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Treemap
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import {
  ReportDocument,
  ReportSection,
  ReportTable,
  ReportChartItem,
  AnalysisOverview,
  KpiMetric,
  Insight
} from '../../types';
import { PresentationDeckModal } from './PresentationDeckModal';
import { ExecutiveDashboardReportModal } from './ExecutiveDashboardReportModal';
import { AIBusinessChartModal } from './AIBusinessChartModal';

const PALETTES = [
  '#2563eb', '#0284c7', '#0d9488', '#3b82f6',
  '#10b981', '#f59e0b', '#06b6d4', '#f43f5e',
];

const SECTION_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  executive_summary: { border: 'border-l-indigo-500',  bg: 'bg-indigo-500/[0.06]',  icon: 'text-indigo-300' },
  dataset_overview:  { border: 'border-l-emerald-500', bg: 'bg-emerald-500/[0.06]', icon: 'text-emerald-300' },
  key_metrics:       { border: 'border-l-sky-500',     bg: 'bg-sky-500/[0.06]',     icon: 'text-sky-300' },
  segment_analysis:  { border: 'border-l-cyan-500',    bg: 'bg-cyan-500/[0.06]',    icon: 'text-cyan-300' },
  trend_analysis:    { border: 'border-l-blue-500',    bg: 'bg-blue-500/[0.06]',    icon: 'text-blue-300' },
  data_quality:      { border: 'border-l-amber-500',   bg: 'bg-amber-500/[0.06]',   icon: 'text-amber-300' },
  anomalies:         { border: 'border-l-rose-500',    bg: 'bg-rose-500/[0.06]',    icon: 'text-rose-300' },
  recommendations:   { border: 'border-l-emerald-400', bg: 'bg-emerald-400/[0.06]', icon: 'text-emerald-300' },
  ai_deepen:         { border: 'border-l-violet-500',  bg: 'bg-violet-500/[0.06]',  icon: 'text-violet-300' },
  insights:          { border: 'border-l-purple-500',  bg: 'bg-purple-500/[0.06]',  icon: 'text-purple-300' },
};
const DEFAULT_SECTION_COLOR = { border: 'border-l-slate-600', bg: 'bg-slate-800/20', icon: 'text-slate-300' };

// Markdown and Inline Formatting Parser
const renderFormattedText = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\[[A-Z0-9_\s]+\]|\*\*.*?\*\*|\*\((?:Why It Matters|Strategic Impact|Takeaway|Action Directive):.*?\)\*|\*.*?\*|_.*?_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('[') && token.endsWith(']')) {
      const tagContent = token.slice(1, -1).trim();
      const isHigh = tagContent === 'HIGH' || tagContent === 'CRITICAL';
      const isFact = tagContent === 'FACT' || tagContent === 'CALCULATION';
      const isMedium = tagContent === 'MEDIUM';

      const labelMap: Record<string, string> = {
        'CALCULATION': 'Calculated Metric',
        'FACT': 'Verified Data',
        'HIGH': 'High Priority',
        'CRITICAL': 'Critical Notice',
        'MEDIUM': 'Moderate',
        'LOW': 'Info'
      };
      const displayLabel = labelMap[tagContent] || tagContent;

      const badgeClasses = isHigh
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        : isFact
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
        : isMedium
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-700/50 text-slate-300 border-slate-600/40';

      parts.push(
        <span
          key={match.index}
          className={`inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-[10px] font-bold tracking-wider uppercase border ${badgeClasses}`}
        >
          {displayLabel}
        </span>
      );
    } else if (token.startsWith('*(') && token.endsWith(')*')) {
      const calloutContent = token.slice(2, -2);
      const isDirective = calloutContent.startsWith('Action Directive:');
      parts.push(
        <span
          key={match.index}
          className={`inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded text-[11px] font-medium border ${
            isDirective
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
          }`}
        >
          {calloutContent}
        </span>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      parts.push(
        <em key={match.index} className="italic text-slate-400">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Formatted Content Renderer
const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const paragraphs = content.split('\n\n');

  return (
    <div className="space-y-3.5 text-xs leading-relaxed text-slate-300 font-sans">
      {paragraphs.map((p, pIdx) => {
        const lines = p.split('\n').filter((l) => l.trim().length > 0);
        return (
          <div key={pIdx} className="space-y-2">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('â€¢') || trimmed.startsWith('-')) {
                const bulletText = trimmed.replace(/^[â€¢\-]\s*/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 my-1.5 text-slate-300 pl-1 p-2 rounded-lg bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 transition">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 mt-2 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                    <div className="flex-1 leading-relaxed">
                      {renderFormattedText(bulletText)}
                    </div>
                  </div>
                );
              }

              const numMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)$/);
              if (numMatch) {
                const num = numMatch[1];
                const rest = numMatch[2];
                return (
                  <div key={lIdx} className="flex items-start gap-3 my-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/70 hover:border-cyan-500/30 transition">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {num}
                    </span>
                    <div className="flex-1 leading-relaxed text-slate-200">
                      {renderFormattedText(rest)}
                    </div>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="leading-relaxed text-slate-300">
                  {renderFormattedText(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Sleek Custom Tooltip for Charts
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0];
    const val = typeof dataPoint.value === 'number'
      ? dataPoint.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : dataPoint.value;
    const sharePct = dataPoint.payload?.share_pct;
    const cumShare = dataPoint.payload?.cumulative_share;
    const count = dataPoint.payload?.count;
    const varPct = dataPoint.payload?.variance_pct;

    return (
      <div className="p-3.5 rounded-xl bg-[#090D16]/98 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50 min-w-[160px]">
        <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label || dataPoint.name || 'Metric'}</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: dataPoint.fill || dataPoint.color || '#6366f1' }}
            />
            <span className="text-slate-400 font-mono text-[11px]">Value:</span>
          </div>
          <span className="font-black text-white font-mono">{val}</span>
        </div>
        {sharePct !== undefined && (
          <div className="flex items-center justify-between text-[11px] text-cyan-300 font-mono">
            <span>Contribution Share:</span>
            <span className="font-bold">{sharePct}%</span>
          </div>
        )}
        {cumShare !== undefined && (
          <div className="flex items-center justify-between text-[11px] text-indigo-300 font-mono">
            <span>Cumulative:</span>
            <span className="font-bold">{cumShare}%</span>
          </div>
        )}
        {count !== undefined && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Records:</span>
            <span>{count.toLocaleString()}</span>
          </div>
        )}
        {varPct !== undefined && (
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">vs Benchmark:</span>
            <span className={`font-bold ${varPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {varPct >= 0 ? `+${varPct}%` : `${varPct}%`}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Visual Dashboard Chart Component with Meaningful Insight Callout
const ReportDashboardChartCard: React.FC<{ chart: ReportChartItem }> = ({ chart }) => {
  const data = chart.data || [];
  const baseType = (chart.chart_type || 'bar').toLowerCase();
  const [viewType, setViewType] = useState<'bar' | 'pie' | 'area'>(
    baseType === 'line' || baseType === 'area' ? 'area' : baseType === 'pie' ? 'pie' : 'bar'
  );
  const insight = chart.insight;

  return (
    <div className="card-3d-interactive glass-3d-card rounded-2xl p-5 shadow-xl space-y-4 hover:border-cyan-500/40 transition flex flex-col justify-between">
      {/* Chart Header Bar */}
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-2">
          <div className="min-w-0">
            <h5 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 truncate">
              {viewType === 'area' ? (
                <Activity className="w-4 h-4 text-sky-400 flex-shrink-0" />
              ) : viewType === 'pie' ? (
                <PieChart className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              ) : (
                <BarChart3 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              )}
              <span className="truncate">{chart.title}</span>
            </h5>
            {chart.subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate leading-normal">{chart.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher Toggle for non-time-series */}
            {baseType !== 'line' && (
              <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-800">
                <button
                  onClick={() => setViewType('bar')}
                  className={`p-1 rounded text-[10px] transition ${viewType === 'bar' ? 'bg-cyan-500/30 text-cyan-200' : 'text-slate-500 hover:text-white'}`}
                  title="Bar View"
                >
                  <BarChart3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewType('pie')}
                  className={`p-1 rounded text-[10px] transition ${viewType === 'pie' ? 'bg-cyan-500/30 text-cyan-200' : 'text-slate-500 hover:text-white'}`}
                  title="Donut / Contribution View"
                >
                  <PieChart className="w-3 h-3" />
                </button>
              </div>
            )}

            {chart.metric_highlight && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex-shrink-0">
                {chart.metric_highlight}
              </span>
            )}
          </div>
        </div>

        {/* Visual Recharts Render */}
        <div className="w-full h-64 pt-2">
          {data.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 italic">
              No computed observations available
            </div>
          ) : viewType === 'area' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 14, right: 20, left: 14, bottom: 28 }}>
                <defs>
                  <linearGradient id={`report-area-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#report-area-${chart.id})`}
                  dot={{ fill: '#06b6d4', r: 3 }}
                  activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : viewType === 'pie' ? (
            <div className="flex items-center justify-center h-full gap-4">
              <div className="w-44 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip content={<CustomChartTooltip />} />
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                      cornerRadius={4}
                    >
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PALETTES[index % PALETTES.length]}
                          stroke="#090D16"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with share percentages */}
              <div className="space-y-1 max-h-48 overflow-y-auto text-[11px] pr-2 flex-1">
                {data.map((d, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 text-slate-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTES[index % PALETTES.length] }} />
                      <span className="truncate">{d.label}</span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {d.share_pct !== undefined ? `${d.share_pct}%` : d.value?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 14, right: 20, left: 14, bottom: 28 }}>
                <defs>
                  <linearGradient id={`report-bar-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} tickMargin={8} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} fill={`url(#report-bar-${chart.id})`}>
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PALETTES[index % PALETTES.length]}
                      opacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Meaningful Insight Callout Banner */}
      {insight && (
        <div className="rounded-xl p-3.5 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/20 border border-cyan-500/30 text-xs space-y-1.5 shadow-inner mt-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <h6 className="font-bold text-white tracking-tight text-xs flex items-center gap-1.5 truncate">
              <span className="text-[9px] font-mono text-cyan-300 font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                Key Insight
              </span>
              <span className="truncate">{insight.headline}</span>
            </h6>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed pl-5">
            {insight.description}
          </p>
          {insight.impact && (
            <div className="pl-5 pt-0.5 flex items-center gap-1 text-[10px] text-cyan-300 font-medium">
              <ChevronRight className="w-3 h-3 text-cyan-400" />
              <span>Takeaway: {insight.impact}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Precision Aligned Table Renderer
const ReportTableRenderer: React.FC<{ table: ReportTable }> = ({ table }) => {
  let headers = table.headers;
  let rows = table.rows;

  if ((!headers || headers.length === 0) && table.data && table.data.length > 0) {
    headers = table.data[0].map(String);
    rows = table.data.slice(1);
  } else if ((!rows || rows.length === 0) && table.data && table.data.length > 1) {
    rows = table.data.slice(1);
  }

  if (!headers || headers.length === 0 || !rows || rows.length === 0) {
    return null;
  }

  const alignments = table.alignments || headers.map((_, colIdx) => {
    const sample = String(rows![0]?.[colIdx] ?? '');
    if (sample.includes('%') || sample.includes('$') || /^-?[\d,.]+(B|M|K)?$/.test(sample.trim())) {
      return 'right';
    }
    return 'left';
  });

  return (
    <div className="table-3d-container my-4">
      {/* Table Title Bar */}
      {(table.title || table.subtitle) && (
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {table.title && (
              <h5 className="text-xs font-bold text-slate-200 tracking-tight flex items-center gap-2 truncate">
                <TableIcon className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span className="truncate">{table.title}</span>
              </h5>
            )}
            {table.subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{table.subtitle}</p>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700/60 px-2 py-0.5 rounded-md flex-shrink-0">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
      )}

      {/* Table Scrollable Body with Precision Alignment */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="table-3d-header">
            <tr>
              {headers.map((h, hIdx) => {
                const align = alignments[hIdx] || 'left';
                const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={hIdx}
                    className={`py-2.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-300 ${alignClass}`}
                  >
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="even:bg-slate-900/20 odd:bg-slate-950/40 hover:bg-brand-500/[0.05] transition-colors"
              >
                {row.map((cell, cIdx) => {
                  const align = alignments[cIdx] || 'left';
                  const isRight = align === 'right';
                  const isCenter = align === 'center';
                  const alignClass = isRight ? 'text-right' : isCenter ? 'text-center' : 'text-left';
                  const cellText = String(cell ?? 'â€”');

                  return (
                    <td
                      key={cIdx}
                      className={`py-2.5 px-4 text-xs ${alignClass} ${
                        isRight
                          ? 'tabular-nums font-mono text-slate-100 font-semibold'
                          : isCenter
                          ? 'font-mono text-[11px] text-slate-400'
                          : 'text-slate-300 font-normal'
                      }`}
                    >
                      {cellText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Section Icon Helper
const getSectionIcon = (type: string) => {
  switch (type) {
    case 'executive_summary':
      return <Sparkles className="w-4 h-4 text-brand-400" />;
    case 'dataset_overview':
      return <Database className="w-4 h-4 text-emerald-400" />;
    case 'key_metrics':
      return <TrendingUp className="w-4 h-4 text-sky-400" />;
    case 'segment_analysis':
      return <PieChart className="w-4 h-4 text-cyan-400" />;
    case 'trend_analysis':
      return <Layers className="w-4 h-4 text-blue-400" />;
    case 'data_quality':
      return <ShieldCheck className="w-4 h-4 text-amber-400" />;
    case 'anomalies':
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    case 'recommendations':
      return <Sparkles className="w-4 h-4 text-emerald-400" />;
    case 'ai_deepen':
      return <Zap className="w-4 h-4 text-brand-400" />;
    default:
      return <FileText className="w-4 h-4 text-brand-400" />;
  }
};

// Section Type Badge Helper
const getSectionBadge = (type: string) => {
  switch (type) {
    case 'executive_summary':
      return 'Overview';
    case 'dataset_overview':
      return 'Sample Data';
    case 'key_metrics':
      return 'Key Metrics';
    case 'segment_analysis':
      return 'Breakdown';
    case 'trend_analysis':
      return 'Trends & Spreads';
    case 'data_quality':
      return 'Data Health';
    case 'anomalies':
      return 'Outliers';
    case 'recommendations':
      return 'Action Plan';
    case 'ai_deepen':
      return 'AI Deep-Dive';
    default:
      return 'Analysis';
  }
};

// Plain English Comprehensive Explanation for Section Headers
const getSectionShortExplanation = (type: string, title?: string): string => {
  switch (type) {
    case 'executive_summary':
      return 'This executive summary provides leadership with a clear view of overall operational performance, headline numbers, and verified data health across all observed records.';
    case 'dataset_overview':
      return 'This section provides a representative sample of individual records from your source tables, allowing you to verify primary fields, formatting, and granular transactional entries.';
    case 'key_metrics':
      return 'These core operational benchmarks measure total volume, transaction pacing, and baseline figures calculated directly from your records to evaluate performance against targets.';
    case 'segment_analysis':
      return 'This section groups your metrics across primary categories and channels, identifying top-performing areas that drive the majority of activity and highlighting opportunities for growth.';
    case 'trend_analysis':
      return title?.toLowerCase().includes('time') || title?.toLowerCase().includes('trend')
        ? 'This longitudinal timeline evaluates performance pacing across sequential dates, helping teams identify seasonal demand cycles, peak operating periods, and growth momentum.'
        : 'This parametric overview examines average values, median midpoints, and the spread between minimum and maximum figures to measure the consistency of your operations.';
    case 'insights':
      return 'These empirical findings highlight notable trends, correlations, and strategic takeaways detected across your data, paired with practical business context and operational relevance.';
    case 'data_quality':
      return 'This comprehensive health audit checks data completeness, missing fields, duplicate rows, and statistical outliers to confirm your numbers are dependable for strategic decisions.';
    case 'recommendations':
      return 'These prioritized action items outline practical next steps based on the empirical findings, designed to help leadership reinforce operational momentum and optimize resources.';
    case 'ai_deepen':
      return 'This advanced strategic deep-dive evaluates forward-looking predictive scenarios, risk hedging factors, and high-impact operational directives synthesized by AI.';
    default:
      return 'This section provides detailed analytical findings and structured observations to support informed operational decision-making.';
  }
};

// Helper: Clean raw markdown text for natural, human-like voice synthesis
const cleanTextForSpeech = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/\[CALCULATION\]/gi, 'Calculated metric: ')
    .replace(/\[FACT\]/gi, 'Key fact: ')
    .replace(/\[HIGH\]/gi, 'High priority: ')
    .replace(/\[CRITICAL\]/gi, 'Critical notice: ')
    .replace(/\[MEDIUM\]/gi, 'Moderate note: ')
    .replace(/\[LOW\]/gi, 'Informational: ')
    .replace(/\[[A-Z0-9_\s]+\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/#+\s+/g, '')
    .replace(/^[â€¢\-\*]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Helper: Split text into natural sentence chunks to eliminate Chromium 15s pause/timeout bug
const splitIntoSpeechChunks = (text: string, maxLen: number = 160): string[] => {
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).length <= maxLen) {
      current = current ? `${current} ${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > maxLen) {
        const parts = trimmed.split(/,\s*/);
        let sub = '';
        for (const p of parts) {
          if ((sub + ', ' + p).length <= maxLen) {
            sub = sub ? `${sub}, ${p}` : p;
          } else {
            if (sub) chunks.push(sub);
            sub = p;
          }
        }
        if (sub) chunks.push(sub);
        current = '';
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

interface AudioSpeechChunk {
  id: string;
  sectionId?: string;
  sectionTitle: string;
  text: string;
}

export const ReportView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisOverview | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'dashboards' | 'tables'>('all');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [isAddingSection, setIsAddingSection] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isDeepening, setIsDeepening] = useState<boolean>(false);
  const [isDeckOpen, setIsDeckOpen] = useState<boolean>(false);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState<boolean>(false);
  const [isAiChartModalOpen, setIsAiChartModalOpen] = useState<boolean>(false);
  const [chartTargetSectionId, setChartTargetSectionId] = useState<string | undefined>(undefined);
  const [isTocOpen, setIsTocOpen] = useState<boolean>(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sequential Full Report Audio Speech State
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isPausedAudio, setIsPausedAudio] = useState<boolean>(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [speechQueue, setSpeechQueue] = useState<AudioSpeechChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [activeSpeakingSectionId, setActiveSpeakingSectionId] = useState<string | null>(null);

  const audioHeartbeatRef = useRef<any>(null);
  const audioSpeedRef = useRef<number>(1.0);
  const speechQueueRef = useRef<AudioSpeechChunk[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const isPlayingAudioRef = useRef<boolean>(false);
  const isPausedAudioRef = useRef<boolean>(false);

  const stopAudioHeartbeat = () => {
    if (audioHeartbeatRef.current) {
      clearInterval(audioHeartbeatRef.current);
      audioHeartbeatRef.current = null;
    }
  };

  const startAudioHeartbeat = () => {
    stopAudioHeartbeat();
    audioHeartbeatRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 7000);
  };

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setIsExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    audioSpeedRef.current = audioSpeed;
  }, [audioSpeed]);

  useEffect(() => {
    return () => {
      stopAudioHeartbeat();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
      (window as any).__datovaSpeechUtterance = null;
    };
  }, []);

  const playChimeTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  };

  // Build complete sequential speech queue covering the entire report

  const buildFullReportSpeechQueue = (): AudioSpeechChunk[] => {
    if (!report) return [];
    const queue: AudioSpeechChunk[] = [];
    let chunkIdCounter = 0;

    const addChunks = (sectionId: string, sectionTitle: string, fullText: string) => {
      const parts = splitIntoSpeechChunks(cleanTextForSpeech(fullText));
      for (const p of parts) {
        if (p.trim().length > 0) {
          queue.push({
            id: `chunk-${chunkIdCounter++}`,
            sectionId,
            sectionTitle,
            text: p.trim()
          });
        }
      }
    };

    // 1. Report Title and Executive Overview
    const introText = `Welcome to the DataNova Executive Business Report for ${currentDataset?.name || 'your dataset'}. ` +
      `Report Title: ${report.title}. ` +
      (report.subtitle ? `${report.subtitle}. ` : '') +
      `Executive Summary: ${report.summary || 'Comprehensive data analysis completed.'}. ` +
      `This report analyzes ${currentDataset?.row_count?.toLocaleString() || 'all'} records across ${currentDataset?.column_count || 'primary'} columns with an overall Data Health Score of ${currentDataset?.data_health_score || 100} out of 100.`;
    addChunks('report-header', 'Introduction & Overview', introText);

    // 2. Key Performance Indicators
    const kpis = (analysis?.kpis || []).slice(0, 6);
    if (kpis.length > 0) {
      const kpiText = `Key Performance Indicators. ` +
        kpis.map(k => `${k.display_name}: ${k.formatted_value}. Calculated from ${k.source_table || 'dataset'} ${k.source_column || ''}.`).join(' ');
      addChunks('report-kpis', 'Key Performance Indicators', kpiText);
    }

    // 3. Strategic Insights & Findings
    const insights = (analysis?.insights || []).slice(0, 4);
    if (insights.length > 0) {
      const insText = `Executive Key Strategic Insights. ` +
        insights.map((ins, iIdx) => {
          const title = ins.title;
          const desc = ins.description;
          const rec = ins.recommendation ? `Action directive: ${ins.recommendation}.` : '';
          return `Insight number ${iIdx + 1}: ${title}. ${desc}. ${rec}`;
        }).join(' ');
      addChunks('report-insights', 'Strategic Insights', insText);
    }

    // 4. Dynamic Sections in Order
    if (report.sections && report.sections.length > 0) {
      report.sections.forEach((sec, sIdx) => {
        const secNum = sIdx + 1;
        const shortExpl = getSectionShortExplanation(sec.section_type, sec.title);
        let secNarrative = `Section ${secNum}: ${sec.title}. Summary: ${shortExpl}. ${sec.content}. `;

        if (sec.charts_included && sec.charts_included.length > 0) {
          const chartSummaries = sec.charts_included.map(ch => {
            const h = ch.metric_highlight ? `Highlighted metric: ${ch.metric_highlight}. ` : '';
            const inHeadline = ch.insight?.headline ? `Key chart takeaway: ${ch.insight.headline}. ` : '';
            return `Visual chart included: ${ch.title}. ${h}${inHeadline}`;
          }).join(' ');
          secNarrative += chartSummaries + ' ';
        }

        if (sec.tables_included && sec.tables_included.length > 0) {
          const tableSummaries = sec.tables_included.map(tb => {
            const rowCount = tb.rows ? tb.rows.length : 0;
            return `Structured data table included: ${tb.title || 'Summary table'}, showing ${rowCount} operational rows.`;
          }).join(' ');
          secNarrative += tableSummaries + ' ';
        }

        addChunks(`section-${sec.id}`, `Section ${secNum}: ${sec.title}`, secNarrative);
      });
    }

    // 5. Final Conclusion
    const conclusionText = `You have completed the entire business report briefing. All sections, metrics, dashboard visualizations, and recommendations have been read aloud. Thank you for listening.`;
    addChunks('report-footer', 'Report Conclusion', conclusionText);

    return queue;
  };

  // Speak a specific chunk index sequentially
  const speakChunk = (index: number) => {
    const queue = speechQueueRef.current;
    if (!queue || index < 0 || index >= queue.length) {
      // Completed reading the entire report!
      stopAudioHeartbeat();
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      isPlayingAudioRef.current = false;
      isPausedAudioRef.current = false;
      setActiveSpeakingSectionId(null);
      setCurrentChunkIndex(0);
      currentChunkIndexRef.current = 0;
      playChimeTone();
      return;
    }

    currentChunkIndexRef.current = index;
    setCurrentChunkIndex(index);
    const chunk = queue[index];
    setActiveSpeakingSectionId(chunk.sectionId || null);

    // Smoothly scroll to current section if needed
    if (chunk.sectionId) {
      const el = document.getElementById(chunk.sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(chunk.text);
      (window as any).__datovaSpeechUtterance = utterance;

      utterance.rate = audioSpeedRef.current;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices() || [];
      const englishVoice =
        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Jenny') || v.name.includes('Guy'))) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];

      if (englishVoice) {
        utterance.voice = englishVoice;
        utterance.lang = englishVoice.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }

      utterance.onstart = () => {
        setIsPlayingAudio(true);
        setIsPausedAudio(false);
        isPlayingAudioRef.current = true;
        isPausedAudioRef.current = false;
        startAudioHeartbeat();
      };

      utterance.onend = () => {
        if (isPlayingAudioRef.current && !isPausedAudioRef.current) {
          speakChunk(index + 1);
        }
      };

      utterance.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }
        console.warn('Speech chunk notice:', e.error);
        if (isPlayingAudioRef.current && !isPausedAudioRef.current) {
          speakChunk(index + 1);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to trigger speech chunk:', err);
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      isPlayingAudioRef.current = false;
      isPausedAudioRef.current = false;
      stopAudioHeartbeat();
    }
  };

  // Start reading the report from the beginning
  const startAudioBriefing = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Web Speech API is not supported in this browser.');
      return;
    }

    const queue = buildFullReportSpeechQueue();
    if (queue.length === 0) {
      alert('No report content available to read.');
      return;
    }

    speechQueueRef.current = queue;
    setSpeechQueue(queue);
    playChimeTone();
    speakChunk(0);
  };

  // Toggle Play / Pause / Resume
  const toggleAudioBriefing = () => {
    if (!isPlayingAudio) {
      startAudioBriefing();
    } else if (isPausedAudio) {
      // Resume
      setIsPausedAudio(false);
      isPausedAudioRef.current = false;
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
      if (!window.speechSynthesis.speaking) {
        speakChunk(currentChunkIndexRef.current);
      }
    } else {
      // Pause
      setIsPausedAudio(true);
      isPausedAudioRef.current = true;
      try {
        window.speechSynthesis.pause();
      } catch (e) {}
    }
  };

  // Stop reading and reset
  const stopAudioBriefing = () => {
    stopAudioHeartbeat();
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    (window as any).__datovaSpeechUtterance = null;
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
    isPlayingAudioRef.current = false;
    isPausedAudioRef.current = false;
    setActiveSpeakingSectionId(null);
    setCurrentChunkIndex(0);
    currentChunkIndexRef.current = 0;
  };

  // Skip to next section
  const handleNextSectionAudio = () => {
    const queue = speechQueueRef.current;
    if (!queue.length) return;
    const currentChunk = queue[currentChunkIndexRef.current];
    const curSecId = currentChunk?.sectionId;
    const nextIdx = queue.findIndex((c, i) => i > currentChunkIndexRef.current && c.sectionId !== curSecId);
    if (nextIdx !== -1) {
      speakChunk(nextIdx);
    } else {
      speakChunk(queue.length - 1);
    }
  };

  // Skip to previous section
  const handlePrevSectionAudio = () => {
    const queue = speechQueueRef.current;
    if (!queue.length) return;
    const currentChunk = queue[currentChunkIndexRef.current];
    const curSecId = currentChunk?.sectionId;
    let prevSecLastIdx = -1;
    for (let i = currentChunkIndexRef.current - 1; i >= 0; i--) {
      if (queue[i].sectionId !== curSecId) {
        prevSecLastIdx = i;
        break;
      }
    }
    if (prevSecLastIdx !== -1) {
      const prevSecId = queue[prevSecLastIdx].sectionId;
      const prevSecStartIdx = queue.findIndex(c => c.sectionId === prevSecId);
      speakChunk(prevSecStartIdx !== -1 ? prevSecStartIdx : prevSecLastIdx);
    } else {
      speakChunk(0);
    }
  };

  // Cycle playback speed
  const handleCycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 0.85];
    const curIdx = speeds.indexOf(audioSpeed);
    const nextSpeed = speeds[(curIdx + 1) % speeds.length];
    setAudioSpeed(nextSpeed);
    audioSpeedRef.current = nextSpeed;
    if (isPlayingAudio && !isPausedAudio) {
      speakChunk(currentChunkIndexRef.current);
    }
  };

  const fetchReportData = async () => {
    if (!currentDataset) return;
    try {
      const [repData, anData] = await Promise.all([
        api.getReport(currentDataset.id),
        api.getAnalysisOverview(currentDataset.id).catch(() => null)
      ]);
      setReport(repData);
      if (anData) setAnalysis(anData);
    } catch (err) {
      console.error('Failed to load report data:', err);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [currentDataset]);

  const handleRegenerateReport = async () => {
    if (!currentDataset) return;
    setIsRegenerating(true);
    try {
      const updated = await api.regenerateReport(currentDataset.id);
      setReport(updated);
      setSaveStatus('Report regenerated');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to regenerate report:', err);
      alert('Failed to regenerate report.');
    } finally {
      setIsRegenerating(false);
    }
  };


  const handleAiDeepen = async () => {
    if (!currentDataset) return;
    setIsDeepening(true);
    try {
      const updated = await api.aiDeepenReport(currentDataset.id);
      setReport(updated);
      setSaveStatus('AI Deep-Dive added');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to deepen report with AI:', err);
      alert('Failed to deepen report with AI.');
    } finally {
      setIsDeepening(false);
    }
  };


  if (!currentDataset || !report) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/15 via-blue-500/15 to-cyan-500/15 border border-indigo-500/30 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" style={{ animationDuration: '0.8s' }} />
        </div>
        <p className="text-xs font-medium">Loading executive report...</p>
      </div>
    );
  }

  // Derived display data
  const primaryKpis = (analysis?.kpis || []).slice(0, 6);
  const topInsights = (analysis?.insights || []).slice(0, 4);

  const handleStartEdit = (sec: ReportSection) => {
    setEditingSectionId(sec.id);
    setEditTitle(sec.title);
    setEditContent(sec.content);
  };

  const handleSaveSection = async (sectionId: string) => {
    try {
      await api.updateReportSection(sectionId, {
        title: editTitle,
        content: editContent
      });
      setEditingSectionId(null);
      await fetchReportData();
      setSaveStatus('Changes saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error('Failed to update report section:', err);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (window.confirm('Delete this section from the report?')) {
      try {
        await api.deleteReportSection(sectionId);
        await fetchReportData();
        setSaveStatus('Section removed');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        console.error('Failed to delete section:', err);
      }
    }
  };

  const handleCreateCustomSection = async () => {
    if (!newTitle.trim()) return;
    try {
      await api.createReportSection(currentDataset.id, newTitle.trim(), newContent.trim());
      setNewTitle('');
      setNewContent('');
      setIsAddingSection(false);
      await fetchReportData();
      setSaveStatus('Section created');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to create section:', err);
    }
  };

  const handleExportPdf = () => { window.open(api.getReportPdfUrl(currentDataset.id), '_blank'); setIsExportMenuOpen(false); };
  const handleExportExcel = () => { window.open(api.getReportExcelUrl(currentDataset.id), '_blank'); setIsExportMenuOpen(false); };
  const handlePrint = () => { window.print(); setIsExportMenuOpen(false); };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500); });
    setIsExportMenuOpen(false);
  };

  // Report completeness score
  const totalSections = report?.sections?.length || 0;
  const totalCharts = report?.sections?.reduce((sum, s) => sum + (s.charts_included?.length || 0), 0) || 0;
  const sectionsWithCharts = report?.sections?.filter(s => (s.charts_included?.length || 0) > 0).length || 0;
  const completenessScore = Math.min(100, Math.round(
    (totalSections > 0 ? 30 : 0) + (primaryKpis.length > 0 ? 25 : 0) +
    (topInsights.length > 0 ? 20 : 0) + (totalCharts > 0 ? 15 : 0) + (sectionsWithCharts > 0 ? 10 : 0)
  ));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Sticky Top Action Bar ────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-800/80 bg-[#070F22]/95 backdrop-blur-md relative z-40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="dept-section-icon dept-section-icon-indigo" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem' }}>
              <FileText className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="view-header-title text-sm sm:text-base font-extrabold text-white tracking-tight">Executive Report</h2>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded-md badge-neon-indigo uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <span className="status-dot-live" />
                  {currentDataset.detected_domain || 'AI Intelligence'}
                </span>
                {saveStatus && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-fadeIn">
                    <Check className="w-3.5 h-3.5" />{saveStatus}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
                {currentDataset.row_count.toLocaleString()} records • {totalSections} sections • {totalCharts} charts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode */}
            <div className="tabs-3d-rail">
              {(['all', 'dashboards', 'tables'] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} className={`tab-3d-item text-xs ${viewMode === mode ? 'tab-3d-item-active' : ''}`}>
                  {mode === 'all' ? 'All' : mode === 'dashboards' ? 'Charts' : 'Tables'}
                </button>
              ))}
            </div>

            {/* TOC Sidebar Toggle */}
            <button onClick={() => setIsTocOpen(o => !o)} title={isTocOpen ? 'Hide outline' : 'Show outline'}
              className={`p-2 rounded-xl transition border ${isTocOpen ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'btn-3d-secondary border-slate-700/60 text-slate-400 hover:text-white'}`}>
              <BookOpen className="w-3.5 h-3.5" />
            </button>

            {/* Generate Business Charts (AI) */}
            <button
              onClick={() => {
                setChartTargetSectionId(undefined);
                setIsAiChartModalOpen(true);
              }}
              className="btn-3d-cyan px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_22px_rgba(6,182,212,0.5)] border border-cyan-400/40 text-white shrink-0"
              title="Generate domain-grounded business charts, Pareto driver analyses, and quantitative takeaways with AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
              <span>AI Business Charts</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-cyan-100 uppercase tracking-wider font-extrabold hidden md:inline">
                NEW
              </span>
            </button>

            {/* AI Deepen */}
            <button onClick={handleAiDeepen} disabled={isDeepening} className="btn-3d-secondary px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <Zap className={`w-3.5 h-3.5 text-blue-300 ${isDeepening ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isDeepening ? 'Synthesizing...' : 'AI Deepen'}</span>
            </button>

            {/* Refresh */}
            <button onClick={handleRegenerateReport} disabled={isRegenerating} className="btn-3d-secondary px-3 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRegenerating ? 'Re-analyzing...' : 'Refresh'}</span>
            </button>

            {/* Add Section */}
            <button onClick={() => setIsAddingSection(true)} className="btn-3d-secondary px-3 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Add Section</span>
            </button>

            {/* Listen / Audio */}
            <button onClick={toggleAudioBriefing}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                isPlayingAudio ? (isPausedAudio ? 'btn-3d-secondary border-amber-500/50 text-amber-300' : 'btn-3d-cyan animate-pulse') : 'btn-3d-secondary text-slate-200 hover:text-white'
              }`}>
              {isPlayingAudio ? (isPausedAudio ? <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <Pause className="w-3.5 h-3.5 text-cyan-200 fill-cyan-200" />) : <Volume2 className="w-3.5 h-3.5 text-blue-400" />}
              <span className="hidden sm:inline">{isPlayingAudio ? (isPausedAudio ? 'Resume' : 'Pause') : 'Listen'}</span>
            </button>
            {isPlayingAudio && (
              <button onClick={stopAudioBriefing} className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition" title="Stop">
                <VolumeX className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Executive Dashboard (Neon Theme + AI Key) */}
            <button
              onClick={() => setIsExecutiveReportOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] hover:shadow-[0_0_26px_rgba(6,182,212,0.6)] border border-cyan-400/40 transition-all transform hover:scale-[1.02] active:scale-95 shrink-0"
              title="Open Executive Dashboard with Neon Quantum Theme & AI Enhancement"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
              <span>Executive Dashboard</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-cyan-100 uppercase tracking-wider font-extrabold hidden md:inline">
                NEON
              </span>
            </button>

            {/* Present */}
            <button onClick={() => setIsDeckOpen(true)} className="btn-3d-primary px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Presentation className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden sm:inline">Present</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative z-50" ref={exportMenuRef}>
              <button onClick={() => setIsExportMenuOpen(o => !o)}
                className="btn-3d-secondary px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-slate-200 hover:text-white">
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#080E21] border border-cyan-500/40 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_25px_rgba(6,182,212,0.25)] overflow-hidden z-[100] animate-fadeIn">
                  <div className="p-1.5 space-y-0.5">
                    <button onClick={handleExportPdf} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:text-white hover:bg-rose-500/20 rounded-lg transition font-medium">
                      <Download className="w-3.5 h-3.5 text-rose-400" />Export as PDF
                    </button>
                    <button onClick={handleExportExcel} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:text-white hover:bg-emerald-500/20 rounded-lg transition font-medium">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />Export as Excel
                    </button>
                    <button onClick={handlePrint} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:text-white hover:bg-indigo-500/20 rounded-lg transition font-medium">
                      <Printer className="w-3.5 h-3.5 text-indigo-400" />Print Report
                    </button>
                    <div className="h-px bg-slate-700/60 my-1" />
                    <button onClick={() => { setIsExecutiveReportOpen(true); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:text-white hover:bg-purple-500/20 rounded-lg transition font-medium">
                      <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />Executive Template
                    </button>
                    <button onClick={handleCopyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:text-white hover:bg-slate-700/60 rounded-lg transition font-medium">
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      {copiedLink ? 'Link Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Two-Panel Body: TOC + Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sticky TOC Sidebar */}
        {isTocOpen && (
          <aside className="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 border-r border-slate-800/80 bg-[#060D1E]/80 overflow-y-auto py-4 px-3 space-y-1">
            <div className="px-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-indigo-400" /> Contents
              </span>
            </div>

            {/* Completeness Score */}
            <div className="px-2 mb-2 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium">Completeness</span>
                <span className="font-bold text-indigo-300 font-mono">{completenessScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all duration-500" style={{ width: `${completenessScore}%` }} />
              </div>
            </div>

            {/* Executive Dashboard Launcher Card */}
            <div className="px-1 mb-2">
              <button
                onClick={() => setIsExecutiveReportOpen(true)}
                className="w-full text-left p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-purple-500/15 border border-cyan-500/30 hover:border-cyan-400/60 transition group shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-cyan-300 flex items-center gap-1">
                    <LayoutDashboard className="w-3 h-3 text-cyan-400" />
                    Dashboard
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-200 font-bold">NEON</span>
                </div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-200 transition">
                  Executive Dashboard
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  Neon visual cards, charts & AI synthesis
                </p>
              </button>
            </div>

            {/* TOC nav items */}
            {([
              { id: 'report-header', label: 'Overview', icon: <Eye className="w-3 h-3" /> },
              ...(primaryKpis.length > 0 ? [{ id: 'report-kpis', label: 'Key Metrics', icon: <TrendingUp className="w-3 h-3" /> }] : []),
              ...(topInsights.length > 0 ? [{ id: 'report-insights', label: 'Key Insights', icon: <Lightbulb className="w-3 h-3" /> }] : []),
              ...(report.sections?.map((sec, idx) => ({
                id: `section-${sec.id}`,
                label: sec.title.split('â€¢')[0].split(':')[0].trim(),
                icon: <span className="text-[9px] font-mono font-bold">{String(idx + 1).padStart(2, '0')}</span>,
              })) || []),
            ] as Array<{ id: string; label: string; icon: React.ReactNode }>).map((item) => {
              const isActive = activeSpeakingSectionId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-medium flex items-center gap-2 transition group ${
                    isActive ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0 ml-auto" />}
                </button>
              );
            })}
          </aside>
        )}

        {/* â”€â”€ Scrollable Report Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* â”€â”€ Premium Cover Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div id="report-header" className="relative overflow-hidden rounded-2xl border border-indigo-500/30 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-purple-950/50 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
              <div className="relative p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-extrabold text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>DATOVA AI Â· EXECUTIVE BUSINESS REPORT</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {new Date(report.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">{report.title}</h1>
                  {report.subtitle && <p className="text-sm text-slate-300 mt-1.5 font-medium">{report.subtitle}</p>}
                </div>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Records', value: currentDataset.row_count.toLocaleString(), icon: <Database className="w-3.5 h-3.5 text-cyan-400" />, color: 'border-cyan-500/30 bg-cyan-500/10' },
                    { label: 'Health Score', value: `${currentDataset.data_health_score}/100`, icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, color: 'border-emerald-500/30 bg-emerald-500/10' },
                    { label: 'Sections', value: totalSections, icon: <Layers className="w-3.5 h-3.5 text-indigo-400" />, color: 'border-indigo-500/30 bg-indigo-500/10' },
                    { label: 'Visualizations', value: totalCharts, icon: <BarChart3 className="w-3.5 h-3.5 text-purple-400" />, color: 'border-purple-500/30 bg-purple-500/10' },
                  ].map((stat, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${stat.color} flex items-center gap-2.5`}>
                      <span className="shrink-0">{stat.icon}</span>
                      <div>
                        <div className="text-base font-black text-white font-mono">{stat.value}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {report.summary && (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300 leading-relaxed">{report.summary}</div>
                )}
                <div className="flex items-start gap-2.5 text-xs text-slate-300 p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/20">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white mr-1">Quick Guide:</span>
                    Use the left sidebar to jump between sections. Click <strong>Listen</strong> to hear the full report aloud. Use <strong>Export</strong> to download as PDF or Excel.
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ KPI Ribbon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {primaryKpis.length > 0 && (
              <div id="report-kpis" className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Key Performance Indicators</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25 font-mono">{primaryKpis.length} metrics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {primaryKpis.map((kpi, kIdx) => {
                    const isPositive = (kpi as any).trend === 'up' || (kpi as any).trend === 'positive';
                    const isNegative = (kpi as any).trend === 'down' || (kpi as any).trend === 'negative';
                    return (
                      <div key={kIdx} className="card-3d-interactive relative overflow-hidden p-4 rounded-xl border border-slate-700/60 hover:border-sky-500/40 transition-all duration-300 bg-slate-900/40 space-y-2 shadow-md group">
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] text-slate-400 font-medium leading-tight line-clamp-2">{kpi.display_name}</span>
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800/80 text-sky-300 border border-sky-500/20 shrink-0">{kpi.calculation_type || 'KPI'}</span>
                        </div>
                        <div className="text-xl font-black text-white font-mono tracking-tight">{kpi.formatted_value}</div>
                        <div className="flex items-center justify-between">
                          {kpi.source_column && <p className="text-[10px] text-slate-500 truncate font-mono">{kpi.source_table || 'Primary'}.{kpi.source_column}</p>}
                          {(isPositive || isNegative) && (
                            <span className={`flex items-center gap-0.5 text-[10px] font-bold ml-auto shrink-0 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {(kpi as any).trend_label || (isPositive ? 'â†‘' : 'â†“')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* â”€â”€ Executive Insights Dossier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {topInsights.length > 0 && (
              <div id="report-insights" className="relative overflow-hidden rounded-2xl border border-amber-500/30 shadow-xl bg-slate-900/50">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">Strategic Insights & Key Findings</h3>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">AI Synthesized</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {topInsights.map((ins, iIdx) => {
                      const isHigh = ins.severity === 'high' || ins.severity === 'critical';
                      const tag = ((ins as any).statement_type || 'FACT').toUpperCase();
                      return (
                        <div key={iIdx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/20 transition space-y-2 flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold font-mono tracking-wider px-1.5 py-0.5 rounded uppercase border bg-indigo-500/15 text-indigo-300 border-indigo-500/30">{tag}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isHigh ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                              {(ins.severity || 'normal').toUpperCase()} IMPACT
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-white leading-snug">{ins.title}</h5>
                          <p className="text-[11px] text-slate-300 leading-relaxed flex-1">{ins.description}</p>
                          {ins.recommendation && (
                            <div className="pt-2 border-t border-slate-800/60 text-[10px] text-emerald-300 font-medium flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span><strong>Action:</strong> {ins.recommendation}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* â”€â”€ Add Section Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {isAddingSection && (
              <div className="p-5 rounded-xl border border-indigo-500/40 bg-slate-900/95 space-y-3.5 shadow-xl animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5"><Plus className="w-4 h-4 text-indigo-400" /> Create Custom Section</h4>
                  <button onClick={() => setIsAddingSection(false)} className="text-slate-400 hover:text-white transition"><X className="w-4 h-4" /></button>
                </div>
                <input type="text" placeholder="Section Title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition" />
                <textarea placeholder="Findings, observations, or analytical notes..." rows={4} value={newContent} onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans transition" />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setIsAddingSection(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                  <button onClick={handleCreateCustomSection} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow">Save Section</button>
                </div>
              </div>
            )}

            {/* â”€â”€ Dynamic Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="space-y-5">
              {report.sections?.map((sec, sIdx) => {
                const isEditing = editingSectionId === sec.id;
                const secIcon = getSectionIcon(sec.section_type);
                const badgeText = getSectionBadge(sec.section_type);
                const indexNumber = String(sIdx + 1).padStart(2, '0');
                const charts = sec.charts_included || [];
                const tables = sec.tables_included || [];
                const showCharts = viewMode === 'all' || viewMode === 'dashboards';
                const showTables = viewMode === 'all' || viewMode === 'tables';
                const colors = SECTION_COLORS[sec.section_type] || DEFAULT_SECTION_COLOR;
                const isSpeaking = activeSpeakingSectionId === `section-${sec.id}`;

                if (viewMode === 'dashboards' && charts.length === 0 && sec.section_type !== 'executive_summary') return null;
                if (viewMode === 'tables' && tables.length === 0 && sec.section_type !== 'dataset_overview') return null;

                return (
                  <div
                    key={sec.id}
                    id={`section-${sec.id}`}
                    className={`relative overflow-hidden rounded-2xl border-l-4 border ${colors.border} shadow-lg transition-all duration-300 group ${
                      isSpeaking ? 'border-cyan-400/60 ring-1 ring-cyan-400/30 shadow-[0_0_25px_rgba(6,182,212,0.15)]' : 'border-slate-700/60 hover:border-slate-600/60'
                    }`}
                  >
                    <div className={`absolute inset-0 ${colors.bg} pointer-events-none`} />
                    <div className="relative">
                      {isEditing ? (
                        <div className="p-5 space-y-3 bg-slate-950/80">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-xs font-bold text-indigo-400">Editing Section {indexNumber}</span>
                          </div>
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition" />
                          <textarea rows={6} value={editContent} onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans transition" />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={() => setEditingSectionId(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={() => handleSaveSection(sec.id)} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow">
                              <Save className="w-3.5 h-3.5" /> Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 space-y-4">
                          {/* Section Header */}
                          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/60">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-800/70 px-1.5 py-0.5 rounded shrink-0">{indexNumber}</span>
                              <div className={`p-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 shrink-0 ${colors.icon}`}>{secIcon}</div>
                              <h3 className="font-extrabold text-sm text-white tracking-tight truncate">{sec.title}</h3>
                              <span className={`hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${colors.icon} border-current opacity-60`}>{badgeText}</span>
                              {isSpeaking && (
                                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Live
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button onClick={() => { setEditingSectionId(sec.id); setEditTitle(sec.title); setEditContent(sec.content); }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteSection(sec.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>

                          {/* Section explanation */}
                          <div className="flex items-start gap-2 text-xs text-slate-400 px-1">
                            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span>{getSectionShortExplanation(sec.section_type, sec.title)}</span>
                          </div>

                          {/* Content */}
                          <FormattedContent content={sec.content} />

                          {/* Charts */}
                          {showCharts && (
                            <div className="space-y-3 pt-1">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" /> Visualizations
                                </h5>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500 font-mono">{charts.length} chart{charts.length !== 1 ? 's' : ''}</span>
                                  <button
                                    onClick={() => {
                                      setChartTargetSectionId(sec.id);
                                      setIsAiChartModalOpen(true);
                                    }}
                                    className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1 transition shadow-sm"
                                    title="Generate new business chart with AI for this section"
                                  >
                                    <Sparkles className="w-3 h-3 text-cyan-300" />
                                    <span>+ AI Chart</span>
                                  </button>
                                </div>
                              </div>
                              {charts.length > 0 ? (
                                <div className={`grid gap-4 ${charts.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                                  {charts.map((ch, chIdx) => <ReportDashboardChartCard key={chIdx} chart={ch} />)}
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 text-xs text-slate-400">
                                  <span>No visual charts attached to this section yet.</span>
                                  <button
                                    onClick={() => {
                                      setChartTargetSectionId(sec.id);
                                      setIsAiChartModalOpen(true);
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold flex items-center gap-1.5 transition"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                                    <span>Generate Business Chart</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tables */}
                          {showTables && tables.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {tables.map((tbl, tIdx) => <ReportTableRenderer key={tIdx} table={tbl} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div id="report-footer" className="pt-6 border-t border-slate-800/60 text-center text-[11px] text-slate-500 space-y-1 pb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500/30 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                </div>
                <span className="font-bold text-slate-400">DATOVA Autonomous Intelligence Engine</span>
              </div>
              <p>Automatically generated from <strong className="text-slate-300">{currentDataset.name}</strong> Â· {currentDataset.row_count.toLocaleString()} records analyzed</p>
              <p>Integrated visual dashboards, precision tables, and strategic AI intelligence Â· {new Date(report.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Floating Audio Player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isPlayingAudio && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-slideUp">
          <div className="bg-[#090D16]/96 border border-cyan-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(6,182,212,0.2)] backdrop-blur-xl rounded-2xl p-3.5 text-white space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  {isPausedAudio ? <Pause className="w-4 h-4 text-amber-400" /> : (
                    <div className="flex items-center gap-0.5">
                      <span className="w-1 bg-cyan-400 rounded-full animate-pulse h-3" />
                      <span className="w-1 bg-cyan-300 rounded-full animate-pulse delay-75 h-4" />
                      <span className="w-1 bg-cyan-400 rounded-full animate-pulse delay-150 h-2" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">{isPausedAudio ? 'Paused' : 'Reading Aloud'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Part {currentChunkIndex + 1} / {speechQueue.length}</span>
                  </div>
                  <h6 className="text-xs font-bold text-slate-100 truncate">{speechQueue[currentChunkIndex]?.sectionTitle || 'Report'}</h6>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={handlePrevSectionAudio} className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"><SkipBack className="w-3.5 h-3.5" /></button>
                <button onClick={toggleAudioBriefing} className={`p-2 rounded-xl text-white shadow-lg transition ${isPausedAudio ? 'bg-amber-500 hover:bg-amber-400' : 'bg-cyan-500 hover:bg-cyan-400'}`}>
                  {isPausedAudio ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
                </button>
                <button onClick={handleNextSectionAudio} className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"><SkipForward className="w-3.5 h-3.5" /></button>
                <button onClick={handleCycleSpeed} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300 hover:bg-slate-700 transition">{audioSpeed}x</button>
                <button onClick={stopAudioBriefing} className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition"><Square className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.round(((currentChunkIndex + 1) / Math.max(1, speechQueue.length)) * 100))}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <PresentationDeckModal isOpen={isDeckOpen} onClose={() => setIsDeckOpen(false)} report={report} dataset={currentDataset} kpis={analysis?.kpis} insights={analysis?.insights} anomalies={analysis?.anomalies} />
      <ExecutiveDashboardReportModal isOpen={isExecutiveReportOpen} onClose={() => setIsExecutiveReportOpen(false)} datasetId={currentDataset?.id || ''} datasetName={currentDataset?.name} />
      <AIBusinessChartModal
        isOpen={isAiChartModalOpen}
        onClose={() => setIsAiChartModalOpen(false)}
        datasetId={currentDataset?.id || ''}
        datasetName={currentDataset?.name || ''}
        domain={currentDataset?.detected_domain}
        sections={report.sections}
        onChartInjected={(updatedReport) => {
          setReport(updatedReport);
          setSaveStatus('Business chart added to report');
          setTimeout(() => setSaveStatus(null), 3000);
        }}
      />
    </div>
  );
};
