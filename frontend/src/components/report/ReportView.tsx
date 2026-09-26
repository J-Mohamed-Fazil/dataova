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
  Info,
  Presentation,
  Volume2,
  VolumeX
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

const PALETTES = [
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#0d9488', // Teal
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

// Markdown and Inline Formatting Parser
const renderFormattedText = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\[[A-Z0-9_]+\]|\*\*.*?\*\*|\*.*?\*|_.*?_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('[') && token.endsWith(']')) {
      const tagContent = token.slice(1, -1);
      const isHigh = tagContent === 'HIGH' || tagContent === 'CRITICAL';
      const isFact = tagContent === 'FACT' || tagContent === 'CALCULATION';
      const badgeClasses = isHigh
        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
        : isFact
        ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
        : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

      parts.push(
        <span
          key={match.index}
          className={`inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-[10px] font-bold tracking-wider uppercase border ${badgeClasses}`}
        >
          {tagContent}
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
    <div className="space-y-3 text-xs leading-relaxed text-slate-300 font-sans">
      {paragraphs.map((p, pIdx) => {
        const lines = p.split('\n').filter((l) => l.trim().length > 0);
        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                const bulletText = trimmed.replace(/^[•\-]\s*/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 my-1 text-slate-300 pl-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-2 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
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
                  <div key={lIdx} className="flex items-start gap-3 my-1.5 pl-0.5">
                    <span className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {num}
                    </span>
                    <div className="flex-1 leading-relaxed text-slate-200">
                      {renderFormattedText(rest)}
                    </div>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="leading-relaxed">
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

    return (
      <div className="p-3 rounded-xl bg-[#090D16]/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs space-y-1 z-50">
        <p className="font-semibold text-slate-300">{label || dataPoint.name || 'Metric'}</p>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: dataPoint.fill || dataPoint.color || '#6366f1' }}
          />
          <span className="text-slate-400 font-mono">Value:</span>
          <span className="font-black text-white font-mono">{val}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Visual Dashboard Chart Component with Meaningful Insight Callout
const ReportDashboardChartCard: React.FC<{ chart: ReportChartItem }> = ({ chart }) => {
  const data = chart.data || [];
  const chartType = (chart.chart_type || 'bar').toLowerCase();
  const insight = chart.insight;

  return (
    <div className="card-3d-interactive glass-3d-card rounded-2xl p-6 shadow-xl space-y-5 hover:border-cyan-500/40 transition flex flex-col justify-between">
      {/* Chart Header Bar */}
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-1">
          <div className="min-w-0">
            <h5 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 truncate">
              {chartType === 'line' || chartType === 'area' ? (
                <Activity className="w-4 h-4 text-sky-400 flex-shrink-0" />
              ) : chartType === 'pie' ? (
                <PieChart className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              ) : (
                <BarChart3 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              )}
              <span className="truncate">{chart.title}</span>
            </h5>
            {chart.subtitle && (
              <p className="text-[11px] text-slate-400 mt-1 truncate leading-normal">{chart.subtitle}</p>
            )}
          </div>
          {chart.metric_highlight && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-brand-500/15 text-brand-300 border border-brand-500/30 flex-shrink-0">
              {chart.metric_highlight}
            </span>
          )}
        </div>

        {/* Visual Recharts Render */}
        <div className="w-full h-64 pt-3">
          {data.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 italic">
              No computed observations available
            </div>
          ) : chartType === 'line' || chartType === 'area' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 14, right: 20, left: 14, bottom: 28 }}>
                <defs>
                  <linearGradient id={`report-area-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
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
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#report-area-${chart.id})`}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5, fill: '#818cf8', stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : chartType === 'treemap' ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={data.map((d, i) => ({
                  name: d.label || d.name || `Tile ${i + 1}`,
                  value: typeof d.value === 'number' ? d.value : 1,
                  size: typeof d.value === 'number' ? d.value : 1
                }))}
                dataKey="value"
                stroke="#0B1120"
                isAnimationActive={true}
              >
                <Tooltip content={<CustomChartTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          ) : chartType === 'pie' ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Tooltip content={<CustomChartTooltip />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
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
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 14, right: 20, left: 14, bottom: 28 }}>
                <defs>
                  <linearGradient id={`report-bar-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
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
        <div className="rounded-xl p-4 bg-gradient-to-r from-brand-950/50 via-slate-900/60 to-brand-950/30 border border-brand-500/30 text-xs space-y-2 shadow-inner mt-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <h6 className="font-bold text-white tracking-tight text-xs flex items-center gap-1.5 truncate">
              <span className="text-[10px] font-mono text-brand-300 font-extrabold uppercase px-2 py-0.5 rounded bg-brand-500/20 border border-brand-500/30">
                Key Insight
              </span>
              <span className="truncate">{insight.headline}</span>
            </h6>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed pl-5">
            {insight.description}
          </p>
          {insight.impact && (
            <div className="pl-5 pt-0.5 flex items-center gap-1 text-[10px] text-brand-300/90 font-medium">
              <ChevronRight className="w-3 h-3 text-brand-400" />
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
                  const cellText = String(cell ?? '—');

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
      return 'Briefing';
    case 'dataset_overview':
      return 'Data Extract';
    case 'key_metrics':
      return 'KPI Matrix';
    case 'segment_analysis':
      return 'Distribution';
    case 'trend_analysis':
      return 'Parametric';
    case 'data_quality':
      return 'Hygiene';
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
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioHeartbeatRef = useRef<any>(null);

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
    }, 8000);
  };

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

  const toggleAudioBriefing = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Web Speech API is not supported in this browser.');
      return;
    }

    if (isPlayingAudio) {
      stopAudioHeartbeat();
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      (window as any).__datovaSpeechUtterance = null;
      setIsPlayingAudio(false);
      return;
    }

    playChimeTone();

    const domainText = currentDataset ? `Analysis for ${currentDataset.detected_domain} dataset.` : '';
    const summaryText = report?.summary || 'Executive data analysis completed.';
    const kpiSummary = analysis?.kpis?.slice(0, 3).map(k => `${k.display_name}: ${k.formatted_value}.`).join(' ') || '';
    const script = `DataNova Executive Briefing. ${domainText} ${summaryText} Key indicators: ${kpiSummary}`;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(script);
      (window as any).__datovaSpeechUtterance = utterance;

      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices() || [];
      const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (englishVoice) {
        utterance.voice = englishVoice;
        utterance.lang = englishVoice.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }

      utterance.onstart = () => {
        setIsPlayingAudio(true);
        startAudioHeartbeat();
      };

      utterance.onend = () => {
        (window as any).__datovaSpeechUtterance = null;
        stopAudioHeartbeat();
        setIsPlayingAudio(false);
      };

      utterance.onerror = (e) => {
        (window as any).__datovaSpeechUtterance = null;
        stopAudioHeartbeat();
        setIsPlayingAudio(false);
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Speech synthesis notice:', e.error);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to trigger speech synthesis:', err);
      setIsPlayingAudio(false);
      stopAudioHeartbeat();
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
      setSaveStatus('Report refreshed dynamically with dashboards');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to regenerate report:', err);
      alert('Failed to regenerate report. Check backend server logs.');
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
      setSaveStatus('AI Deep-Dive briefing generated');
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
        <p className="text-xs">Loading dynamic executive report & dashboards...</p>
      </div>
    );
  }

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

  const handleExportPdf = () => {
    window.open(api.getReportPdfUrl(currentDataset.id), '_blank');
  };

  const handleExportExcel = () => {
    window.open(api.getReportExcelUrl(currentDataset.id), '_blank');
  };

  // Top KPIs for Ribbon
  const ribbonKpis = analysis?.kpis || [];
  const primaryKpis = ribbonKpis.slice(0, 4);

  // Top Insights for Executive Dossier
  const topInsights = analysis?.insights?.slice(0, 4) || [];

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 bg-transparent max-w-7xl mx-auto w-full">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" />
              <span>Executive Briefing & Report</span>
            </h2>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
              {currentDataset.detected_domain || 'Dynamic Intelligence'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Data-adaptive autonomous executive reporting. Integrated visual dashboards, precision tables, and strategic AI intelligence.
          </p>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {saveStatus && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mr-1.5 animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              {saveStatus}
            </span>
          )}

          {/* View Mode Toggle */}
          <div className="tabs-3d-rail">
            <button
              onClick={() => setViewMode('all')}
              className={`tab-3d-item ${
                viewMode === 'all' ? 'tab-3d-item-active' : ''
              }`}
            >
              Unified View
            </button>
            <button
              onClick={() => setViewMode('dashboards')}
              className={`tab-3d-item ${
                viewMode === 'dashboards' ? 'tab-3d-item-active' : ''
              }`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setViewMode('tables')}
              className={`tab-3d-item ${
                viewMode === 'tables' ? 'tab-3d-item-active' : ''
              }`}
            >
              Data Tables
            </button>
          </div>

          {/* AI Deepen Button */}
          <button
            onClick={handleAiDeepen}
            disabled={isDeepening}
            className="btn-3d-cyan px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            title="Generate AI-powered predictive scenarios and strategic deep-dive"
          >
            <Zap className={`w-3.5 h-3.5 text-blue-400 ${isDeepening ? 'animate-bounce' : ''}`} />
            <span>{isDeepening ? 'Synthesizing...' : 'AI Deepen'}</span>
          </button>

          {/* Regenerate Button */}
          <button
            onClick={handleRegenerateReport}
            disabled={isRegenerating}
            className="btn-3d-secondary px-3 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            title="Re-analyze data and rebuild dynamic sections and dashboards"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-400 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>{isRegenerating ? 'Re-analyzing...' : 'Refresh'}</span>
          </button>

          {/* Add Section Button */}
          <button
            onClick={() => setIsAddingSection(true)}
            className="btn-3d-secondary px-3 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-brand-400" />
            <span>Add Section</span>
          </button>

          {/* Audio Briefing Button */}
          <button
            onClick={toggleAudioBriefing}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              isPlayingAudio
                ? 'btn-3d-danger animate-pulse'
                : 'btn-3d-secondary text-slate-200 hover:text-white'
            }`}
            title={isPlayingAudio ? 'Stop audio briefing' : 'Play voice-synthesized audio briefing'}
          >
            {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-blue-400" />}
            <span>{isPlayingAudio ? 'Stop Audio' : 'Listen'}</span>
          </button>

          {/* Presentation Deck Button */}
          <button
            onClick={() => setIsDeckOpen(true)}
            className="btn-3d-primary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            title="Launch Fullscreen C-Suite Presentation Deck"
          >
            <Presentation className="w-3.5 h-3.5 text-blue-300" />
            <span>Present</span>
          </button>

          {/* Executive Dashboard Template Report Button */}
          <button
            onClick={() => setIsExecutiveReportOpen(true)}
            className="btn-3d-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-purple-500/30 text-purple-200 hover:text-white shadow-md shadow-purple-500/10"
            title="Open Executive Dashboard Template Report (Lollipop Growth, Driver Cards, Milestones, Audit Gauges)"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-300" />
            <span>Executive Template</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="btn-3d-emerald px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPdf}
            className="btn-3d-danger px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Document Canvas Sheet */}
      <div className="glass-3d-card relative overflow-hidden max-w-5xl mx-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(14,165,233,0.12)] space-y-6 sm:space-y-8 border border-slate-700/80">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />
        {/* Document Header with Metadata Alignment */}
        <div className="border-b border-slate-800/80 pb-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold text-brand-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DATOVA AI • AUTONOMOUS BUSINESS REPORT & DASHBOARD</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {new Date(report.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
            {report.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">{report.subtitle}</span>
            <span className="text-slate-600">•</span>
            <span>Health Score: <strong className="text-emerald-400">{currentDataset.data_health_score}/100</strong></span>
            <span className="text-slate-600">•</span>
            <span>{currentDataset.row_count.toLocaleString()} Records Analyzed</span>
          </div>

          {/* TOP EXECUTIVE KPI RIBBON WITH PROPER ALIGNMENT */}
          {primaryKpis.length > 0 && (
            <div className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
                {primaryKpis.map((kpi, kIdx) => (
                  <div
                    key={kIdx}
                    className="card-3d-interactive glass-3d-card relative overflow-hidden p-3.5 rounded-xl border border-slate-700/60 hover:border-cyan-500/50 transition-all duration-300 space-y-1 shadow-md group"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 font-medium truncate">
                      <span className="truncate">{kpi.display_name}</span>
                      <span className="text-[9px] font-mono font-bold uppercase px-1 rounded bg-slate-800 text-brand-300">
                        {kpi.calculation_type || 'KPI'}
                      </span>
                    </div>
                    <div className="text-xl font-black text-white font-mono tracking-tight">
                      {kpi.formatted_value}
                    </div>
                    {kpi.source_column && (
                      <p className="text-[10px] text-slate-500 truncate font-mono">
                        Base: {kpi.source_table || 'Primary'}.{kpi.source_column}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* EXECUTIVE KEY INSIGHTS DOSSIER (High-Impact Highlight Cards) */}
        {topInsights.length > 0 && (
          <div className="glass-3d-card relative overflow-hidden space-y-3.5 p-5 rounded-2xl border border-cyan-500/40 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Executive Key Strategic Insights & Empirical Findings
                </h4>
              </div>
              <span className="text-[10px] font-mono text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                AI Autonomous Synthesis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {topInsights.map((ins, iIdx) => {
                const isHigh = ins.severity === 'high' || ins.severity === 'critical';
                const tag = (ins.statement_type || 'CALCULATION').toUpperCase();
                return (
                  <div
                    key={iIdx}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-brand-500/30 transition space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-1">
                        <span className="text-[9px] font-bold font-mono tracking-wider px-1.5 py-0.5 rounded uppercase border bg-brand-500/15 text-brand-300 border-brand-500/30">
                          [{tag}]
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isHigh
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {ins.severity.toUpperCase()} IMPACT
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-white tracking-tight leading-snug">
                        {ins.title}
                      </h5>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        {ins.description}
                      </p>
                    </div>

                    {ins.recommendation && (
                      <div className="pt-2 border-t border-slate-800/60 text-[10px] text-emerald-400/95 font-medium flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span><strong>Action Directive:</strong> {ins.recommendation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Section Modal / Panel */}
        {isAddingSection && (
          <div className="p-5 rounded-xl border border-brand-500/40 bg-slate-900/95 space-y-3.5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-400" />
                <span>Create Custom Analytical Section</span>
              </h4>
              <button
                onClick={() => setIsAddingSection(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="Section Title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            />
            <textarea
              placeholder="Detailed analytical findings, strategic observations, or notes..."
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-sans"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAddingSection(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomSection}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Save Section
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Sections Stack */}
        <div className="space-y-8">
          {report.sections?.map((sec, sIdx) => {
            const isEditing = editingSectionId === sec.id;
            const secIcon = getSectionIcon(sec.section_type);
            const badgeText = getSectionBadge(sec.section_type);
            const indexNumber = String(sIdx + 1).padStart(2, '0');
            const charts = sec.charts_included || [];
            const tables = sec.tables_included || [];

            // Filters based on ViewMode
            const showCharts = viewMode === 'all' || viewMode === 'dashboards';
            const showTables = viewMode === 'all' || viewMode === 'tables';

            // Skip rendering empty sections in specialized view modes
            if (viewMode === 'dashboards' && charts.length === 0 && sec.section_type !== 'executive_summary') {
              return null;
            }
            if (viewMode === 'tables' && tables.length === 0 && sec.section_type !== 'dataset_overview') {
              return null;
            }

            return (
              <div
                key={sec.id}
                className="card-3d-interactive glass-3d-card relative overflow-hidden p-6 rounded-2xl border border-slate-700/60 hover:border-cyan-500/40 transition-all duration-300 shadow-xl space-y-5 group"
              >
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />
                {isEditing ? (
                  /* Inline Edit Mode */
                  <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-brand-500/40">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-brand-400">Editing Section {indexNumber}</span>
                    </div>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-brand-500"
                    />
                    <textarea
                      rows={6}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 leading-relaxed font-sans"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingSectionId(null)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveSection(sec.id)}
                        className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard View Mode */
                  <>
                    {/* Section Header with Alignment & Badges */}
                    <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                          {indexNumber}
                        </span>
                        <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex-shrink-0">
                          {secIcon}
                        </div>
                        <h3 className="font-extrabold text-sm md:text-base text-white tracking-tight truncate">
                          {sec.title}
                        </h3>
                        <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-400 bg-slate-800/40 border border-slate-700/50 px-2 py-0.5 rounded-full flex-shrink-0">
                          {badgeText}
                        </span>
                      </div>

                      {/* Edit & Delete Action Hover Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(sec)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                          title="Edit section"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSection(sec.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
                          title="Delete section"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Formatted Content Narrative */}
                    <FormattedContent content={sec.content} />

                    {/* SECTION DASHBOARD CHARTS WITH PROPER ALIGNMENT (Not Only Tables!) */}
                    {showCharts && charts.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <LayoutDashboard className="w-3.5 h-3.5 text-brand-400" />
                            <span>Visual Analytical Dashboard</span>
                          </h5>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {charts.length} {charts.length === 1 ? 'Visualization' : 'Visualizations'}
                          </span>
                        </div>

                        <div
                          className={`grid gap-5 ${
                            charts.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                          }`}
                        >
                          {charts.map((ch, chIdx) => (
                            <ReportDashboardChartCard key={chIdx} chart={ch} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* EMBEDDED STRUCTURED TABLES WITH PRECISION ALIGNMENT */}
                    {showTables && tables.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {tables.map((tbl, tIdx) => (
                          <ReportTableRenderer key={tIdx} table={tbl} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Document Footer Notice */}
        <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-400">
            DATOVA Autonomous Intelligence Engine • Dynamic Multi-Sheet Analytics
          </p>
          <p>
            Generated automatically from uploaded datasets with integrated visual dashboards, precision tables, and strategic AI intelligence.
          </p>
        </div>
      </div>

      {/* Presentation Deck Fullscreen Modal */}
      <PresentationDeckModal
        isOpen={isDeckOpen}
        onClose={() => setIsDeckOpen(false)}
        report={report}
        dataset={currentDataset}
        kpis={analysis?.kpis}
        insights={analysis?.insights}
        anomalies={analysis?.anomalies}
      />

      {/* Executive Dashboard Template Report Modal */}
      <ExecutiveDashboardReportModal
        isOpen={isExecutiveReportOpen}
        onClose={() => setIsExecutiveReportOpen(false)}
        datasetId={currentDataset?.id || ''}
        datasetName={currentDataset?.name}
      />
    </div>
  );
};
