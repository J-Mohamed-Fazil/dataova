import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  LayoutGrid,
  Grid,
  Sparkles,
  BarChart2,
  GitBranch,
  Layers,
  Database,
  RefreshCw,
  Info,
  TrendingUp,
  Filter,
  X,
  Presentation,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  PieChart,
  Table as TableIcon,
  Activity,
  CheckCircle,
  ShieldAlert,
  Search,
  Maximize2,
  ArrowRight,
  TrendingDown,
  Users,
  Copy,
  Check,
  Wand2,
  Target,
  DollarSign
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { DashboardSheet, DashboardChart, ColumnMetadata, AnalysisOverview, BusinessQuestionInsight } from '../../types';
import { ChartRenderer } from './ChartRenderer';
import { ChartEditorModal } from './ChartEditorModal';
import { AIDashboardStudioModal } from './AIDashboardStudioModal';
import { StoryModeModal } from './StoryModeModal';
import { ExecutiveDashboardReportModal } from '../report/ExecutiveDashboardReportModal';
import { GenerateAIDashboardModal } from './GenerateAIDashboardModal';

export const DashboardView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [sheets, setSheets] = useState<DashboardSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [editingChart, setEditingChart] = useState<DashboardChart | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [newSheetTitle, setNewSheetTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isAIAgentGenerating, setIsAIAgentGenerating] = useState<boolean>(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [isAIGenerateModalOpen, setIsAIGenerateModalOpen] = useState<boolean>(false);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [isStoryModeOpen, setIsStoryModeOpen] = useState<boolean>(false);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState<boolean>(false);
  const [overview, setOverview] = useState<AnalysisOverview | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterVal, setFilterVal] = useState<string>('');

  // Interactive Business Insights State
  const [showBQs, setShowBQs] = useState<boolean>(true);
  const [bqSearch, setBqSearch] = useState<string>('');
  const [bqCategoryFilter, setBqCategoryFilter] = useState<string>('All');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [focusedChartId, setFocusedChartId] = useState<string | null>(null);
  const [isSynthesizingInsights, setIsSynthesizingInsights] = useState<boolean>(false);
  const [quickAIQuery, setQuickAIQuery] = useState<string>('');
  const [copiedInsightId, setCopiedInsightId] = useState<string | null>(null);

  // Drill-down inspection modal state
  const [drilldownChart, setDrilldownChart] = useState<DashboardChart | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');

  // Client-side chart type overrides
  const [chartTypeOverrides, setChartTypeOverrides] = useState<Record<string, DashboardChart['chart_type']>>({});

  const fetchSheets = async () => {
    if (!currentDataset) return;
    try {
      setLoading(true);
      const data = await api.getSheets(currentDataset.id);
      const hasValidCharts = data && data.length > 0 && data.some(s => s.charts && s.charts.length > 0);
      if (hasValidCharts) {
        setSheets(data);
        if (activeSheetIndex >= data.length) {
          setActiveSheetIndex(0);
        }
      } else if (currentDataset.tables && currentDataset.tables.length > 0) {
        // Auto-generate initial executive dashboard using AI Agent if no sheets exist or all are empty!
        setIsAIAgentGenerating(true);
        try {
          const generated = await api.aiAgentGenerateDashboard(currentDataset.id, {
            preset: 'executive',
            palette: 'cyberpunk',
            mode: 'replace_all'
          });
          setSheets(generated);
          setActiveSheetIndex(0);
          const totalNewCharts = generated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
          setToastMessage(`AI Agent synthesized ${totalNewCharts} visualizations across ${generated.length} sheets!`);
          setTimeout(() => setToastMessage(null), 5000);
        } catch (autoErr) {
          console.warn('Auto AI agent generation fallback:', autoErr);
          setSheets(data || []);
        } finally {
          setIsAIAgentGenerating(false);
        }
      } else {
        setSheets([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard sheets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
    if (currentDataset) {
      api.getAnalysisOverview(currentDataset.id).then(setOverview).catch(() => {});
    }
  }, [currentDataset]);

  if (!currentDataset) return null;

  const activeSheet: DashboardSheet | undefined = sheets[activeSheetIndex] || sheets[0];
  const allColumns: ColumnMetadata[] = currentDataset.tables?.[0]?.columns || [];
  const totalCharts = sheets.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
  const isMultiTable = (currentDataset.tables?.length || 0) > 1;

  // Sheet KPI Ribbon calculations
  const sheetCharts = activeSheet?.charts || [];
  const totalSheetCharts = sheetCharts.length;
  const primaryDim = sheetCharts[0]?.x_field || 'Active';
  const allValues = sheetCharts.flatMap(c => (c.data || []).map(d => Number(d.value)).filter(v => !isNaN(v)));
  const peakVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const avgVal = allValues.length > 0 ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0;

  // Business Questions filtering
  const businessQuestions: BusinessQuestionInsight[] = activeSheet?.business_questions || [];
  const filteredBQs = businessQuestions.filter(q => {
    const matchesSearch = !bqSearch.trim() || (
      q.question.toLowerCase().includes(bqSearch.toLowerCase()) ||
      q.answer.toLowerCase().includes(bqSearch.toLowerCase()) ||
      (q.badge && q.badge.toLowerCase().includes(bqSearch.toLowerCase())) ||
      (q.metric && q.metric.toLowerCase().includes(bqSearch.toLowerCase()))
    );

    const matchesCategory = bqCategoryFilter === 'All' || (
      (bqCategoryFilter === 'Executive' && (!q.category || q.category === 'Executive')) ||
      (q.category && q.category.toLowerCase().includes(bqCategoryFilter.toLowerCase())) ||
      (q.badge && q.badge.toLowerCase().includes(bqCategoryFilter.toLowerCase()))
    );

    return matchesSearch && matchesCategory;
  });

  const highImpactCount = businessQuestions.filter(q => q.impact_level === 'High Impact' || q.badge?.toLowerCase().includes('driver') || q.badge?.toLowerCase().includes('top')).length;

  const handleSelectInsight = (q: BusinessQuestionInsight) => {
    const isAlreadySelected = selectedInsightId === q.id;
    setSelectedInsightId(isAlreadySelected ? null : q.id);
    if (!isAlreadySelected && q.chart_target) {
      handleFocusChart(q.chart_target);
    }
  };

  const handleCopyInsight = (e: React.MouseEvent, q: BusinessQuestionInsight) => {
    e.stopPropagation();
    const textToCopy = `*Executive Insight: ${q.question}*\nMetric: ${q.metric || 'N/A'}\nFinding: ${q.answer}\nRecommendation: ${q.recommendation || 'N/A'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedInsightId(q.id);
    setToastMessage('Insight finding & recommendation copied to clipboard!');
    setTimeout(() => setCopiedInsightId(null), 2500);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInspectInsightDrilldown = (e: React.MouseEvent, q: BusinessQuestionInsight) => {
    e.stopPropagation();
    if (!activeSheet?.charts || activeSheet.charts.length === 0) return;
    const query = (q.chart_target || '').toLowerCase().trim();
    const targetChart = activeSheet.charts.find(c =>
      query && (
        c.title.toLowerCase().includes(query) ||
        (c.x_field && query.includes(c.x_field.toLowerCase())) ||
        (c.y_field && query.includes(c.y_field.toLowerCase()))
      )
    ) || activeSheet.charts[0];

    if (targetChart) {
      setDrilldownChart(targetChart);
      setDrilldownSearch('');
    }
  };

  const handleRefreshSheetInsights = async (customPrompt?: string) => {
    if (!currentDataset || !activeSheet) return;
    setIsSynthesizingInsights(true);
    try {
      const res = await api.generateSheetInsights(currentDataset.id, activeSheet.id, {
        prompt: customPrompt || quickAIQuery.trim() || undefined
      });
      if (res.business_questions) {
        setSheets(prev => prev.map(s => s.id === activeSheet.id ? { ...s, business_questions: res.business_questions } : s));
        setToastMessage(`Synthesized ${res.business_questions.length} executive business insights for "${activeSheet.title}"!`);
        setTimeout(() => setToastMessage(null), 4000);
      }
      setQuickAIQuery('');
    } catch (err: any) {
      console.error('Failed to generate sheet insights:', err);
      setToastMessage('Failed to refresh insights: ' + (err.message || 'Server error'));
    } finally {
      setIsSynthesizingInsights(false);
    }
  };

  const handleCreateSheet = async () => {
    if (!newSheetTitle.trim()) return;
    try {
      await api.createSheet(currentDataset.id, newSheetTitle.trim());
      setNewSheetTitle('');
      setIsCreatingSheet(false);
      await fetchSheets();
      setActiveSheetIndex(sheets.length);
    } catch (err) {
      console.error('Failed to create sheet:', err);
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (sheets.length <= 1) return;
    if (window.confirm('Are you sure you want to delete this analytical sheet?')) {
      try {
        await api.deleteSheet(currentDataset.id, sheetId);
        await fetchSheets();
      } catch (err) {
        console.error('Failed to delete sheet:', err);
      }
    }
  };

  const handleSaveChart = async (updated: Partial<DashboardChart>) => {
    if (!editingChart) return;
    try {
      await api.updateChart(editingChart.id, updated);
      await fetchSheets();
    } catch (err) {
      console.error('Failed to update chart:', err);
    }
  };

  const handleToggleForecast = async (chart: DashboardChart) => {
    try {
      const currentForecast = Boolean(chart.config?.enable_forecast);
      await api.updateChart(chart.id, {
        config: {
          ...(chart.config || {}),
          enable_forecast: !currentForecast,
          forecast_periods: chart.config?.forecast_periods || 6
        }
      });
      await fetchSheets();
    } catch (err) {
      console.error('Failed to toggle forecast:', err);
    }
  };

  const handleChangeChartType = async (chart: DashboardChart, newType: DashboardChart['chart_type']) => {
    setChartTypeOverrides(prev => ({ ...prev, [chart.id]: newType }));
    try {
      await api.updateChart(chart.id, { chart_type: newType });
    } catch (err) {
      console.warn('Failed to persist chart type update:', err);
    }
  };

  const handleFocusChart = (targetQuery?: string) => {
    if (!targetQuery || !activeSheet?.charts) return;
    const query = targetQuery.toLowerCase().trim();
    const matched = activeSheet.charts.find(c =>
      c.title.toLowerCase().includes(query) ||
      (c.x_field && query.includes(c.x_field.toLowerCase())) ||
      (c.y_field && query.includes(c.y_field.toLowerCase()))
    ) || activeSheet.charts[0];

    if (matched) {
      setFocusedChartId(matched.id);
      const elem = document.getElementById(`chart-card-${matched.id}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setFocusedChartId(null), 3000);
    }
  };

  const handleExportChartCSV = (chart: DashboardChart) => {
    if (!chart.data || chart.data.length === 0) return;
    const headers = ['#', 'Label', 'Value', 'X', 'Y'];
    const rows = chart.data.map((d, i) => [
      i + 1,
      `"${String(d.label || '').replace(/"/g, '""')}"`,
      d.value ?? '',
      d.x ?? '',
      d.y ?? ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${chart.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteChart = async (chartId: string) => {
    if (window.confirm('Delete this chart from the dashboard?')) {
      try {
        await api.deleteChart(chartId);
        await fetchSheets();
      } catch (err) {
        console.error('Failed to delete chart:', err);
      }
    }
  };

  const handleAddChartQuick = async () => {
    if (!activeSheet) return;
    const primaryTable = currentDataset.tables?.[0]?.table_name || 'data';
    const numCol = allColumns.find(c => c.data_type === 'numeric')?.column_name;
    const catCol = allColumns.find(c => c.data_type === 'categorical' || c.data_type === 'text')?.column_name;

    try {
      await api.createChart({
        sheet_id: activeSheet.id,
        title: `${numCol || 'Metric'} by ${catCol || 'Category'}`,
        chart_type: 'bar',
        table_name: primaryTable,
        x_field: catCol || allColumns[0]?.column_name,
        y_field: numCol || allColumns[1]?.column_name,
        aggregation: 'sum',
        grid_w: 6,
        grid_h: 4
      });
      await fetchSheets();
    } catch (err) {
      console.error('Failed to add chart:', err);
    }
  };

  const handleAIAgentQuickGenerate = async (preset: string = 'executive', replaceAll: boolean = true) => {
    if (!currentDataset) return;
    setIsAIAgentGenerating(true);
    try {
      const generated = await api.aiAgentGenerateDashboard(currentDataset.id, {
        preset,
        palette: 'cyberpunk',
        mode: replaceAll ? 'replace_all' : 'add_sheet'
      });
      setSheets(generated);
      setActiveSheetIndex(0);
      const targetSheet = generated[0] || generated[generated.length - 1];
      const totalNewCharts = targetSheet?.charts?.length || 0;
      setToastMessage(`AI Agent synthesized "${targetSheet?.title || 'Executive Dashboard'}" with ${totalNewCharts} visualizations!`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to generate AI Agent dashboard:', err);
      setToastMessage('AI Agent generation failed: ' + (err.message || 'Server error'));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsAIAgentGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    try {
      const regenerated = await api.generateAllDashboards(currentDataset.id);
      setSheets(regenerated);
      setActiveSheetIndex(0);
      const totalNewCharts = regenerated.reduce((sum, s) => sum + (s.charts?.length || 0), 0);
      setToastMessage(`Synthesized all possible visualizations: ${totalNewCharts} charts across ${regenerated.length} sheets!`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error('Failed to generate all dashboards:', err);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 bg-transparent max-w-7xl mx-auto w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-emerald-600/20 border border-blue-500/40 text-xs text-white flex items-center justify-between shadow-lg shadow-blue-600/20 animate-fadeIn backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="w-6 h-6 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dataset Summary & Multi-Table Intelligence Status Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-3d-card border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />

        <div className="pt-2 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/30 to-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-md shadow-blue-600/20">
            {isMultiTable ? <GitBranch className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-white tracking-tight drop-shadow-sm">
                {currentDataset.name}
              </h3>
              {isMultiTable && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full badge-neon-blue font-mono font-bold shadow-sm">
                  {currentDataset.tables?.length} Tables • All Reachable Joins Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Displaying <strong className="text-white">{totalCharts}</strong> charts across{' '}
              <strong className="text-white">{sheets.length}</strong> analytical sheets.
              {isMultiTable && ' Universal cross-table relational graph active.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsStudioOpen(true)}
            className="btn-3d-secondary px-4 py-2 rounded-xl text-cyan-200 text-xs font-semibold flex items-center gap-2 border border-cyan-500/30 hover:border-cyan-400 shadow-md shadow-cyan-500/10"
            title="AI Dashboard Studio: Natural-language prompt synthesis, visual composer & live interactive canvas"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Dashboard Studio</span>
            {isMultiTable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                N-Tables
              </span>
            )}
          </button>

          <button
            onClick={() => setIsStoryModeOpen(true)}
            className="btn-3d-secondary px-4 py-2 rounded-xl text-indigo-200 text-xs font-semibold flex items-center gap-2"
            title="Launch Fullscreen Interactive Executive Presentation Deck"
          >
            <Presentation className="w-3.5 h-3.5 text-indigo-400" />
            <span>Story Mode</span>
          </button>

          <button
            onClick={() => setIsExecutiveReportOpen(true)}
            className="btn-3d-secondary px-4 py-2 rounded-xl text-purple-200 text-xs font-semibold flex items-center gap-2 border border-purple-500/30 hover:border-purple-400 shadow-md shadow-purple-500/10"
            title="Launch Executive Dashboard Report Template matching modern Neumorphic / Purple styling"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
            <span>Executive Report</span>
          </button>

          <button
            onClick={() => handleAIAgentQuickGenerate('executive', true)}
            disabled={isAIAgentGenerating}
            className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 border border-cyan-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            title="Deploy AI Agent to autonomously analyze dataset and synthesize executive composed charts and insights"
          >
            <Sparkles className={`w-3.5 h-3.5 text-cyan-200 ${isAIAgentGenerating ? 'animate-spin' : 'animate-pulse'}`} />
            <span>{isAIAgentGenerating ? 'AI Agent Synthesizing...' : 'AI Agent Generate'}</span>
          </button>

          <button
            onClick={() => setIsAIGenerateModalOpen(true)}
            className="btn-3d-primary px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30"
            title="Launch AI Dashboard Generator: Natural language prompts, strategic presets, and theme palettes"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>Generate AI Dashboard</span>
          </button>
        </div>
      </div>

      {/* Sheets Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* 3D Sheet Tabs Rail */}
        <div className="tabs-3d-rail flex-wrap">
          {sheets.map((sheet, idx) => (
            <div key={sheet.id} className="flex items-center">
              <button
                data-tour={`sheet-tab-${idx}`}
                onClick={() => setActiveSheetIndex(idx)}
                className={`tab-3d-item flex items-center gap-2 ${
                  activeSheetIndex === idx ? 'tab-3d-item-active' : ''
                }`}
              >
                {sheet.sheet_type === 'relational' ? (
                  <GitBranch className="w-3.5 h-3.5 text-cyan-300" />
                ) : (
                  <LayoutGrid className="w-3.5 h-3.5" />
                )}
                <span>{sheet.title}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  activeSheetIndex === idx ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {sheet.charts?.length || 0}
                </span>
              </button>
              {sheets.length > 1 && activeSheetIndex === idx && (
                <button
                  onClick={() => handleDeleteSheet(sheet.id)}
                  title="Delete Sheet"
                  className="text-slate-400 hover:text-rose-400 p-1.5 transition ml-0.5 rounded-lg hover:bg-slate-800/80"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* New Sheet Button */}
          {isCreatingSheet ? (
            <div className="flex items-center gap-1 pl-1.5">
              <input
                type="text"
                placeholder="Sheet Title..."
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSheet()}
                className="bg-slate-950 border border-slate-700 text-xs text-white px-2.5 py-1 rounded-lg focus:outline-none focus:border-cyan-500 w-32 shadow-inner"
                autoFocus
              />
              <button
                onClick={handleCreateSheet}
                className="px-2.5 py-1 btn-3d-primary text-white text-xs font-semibold rounded-lg"
              >
                Save
              </button>
              <button
                onClick={() => setIsCreatingSheet(false)}
                className="text-slate-400 hover:text-white text-xs px-1.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingSheet(true)}
              className="tab-3d-item flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>New Sheet</span>
            </button>
          )}
        </div>

        {/* Action Controls & Global Sheet Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Sheet Dimension Filter */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs shadow-inner">
            <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 font-medium hidden sm:inline">Filter Sheet:</span>
            <input
              type="text"
              placeholder="Filter charts by label..."
              value={filterVal}
              onChange={(e) => setFilterVal(e.target.value)}
              className="bg-transparent text-white placeholder-slate-500 focus:outline-none text-xs w-36 sm:w-44"
            />
            {filterVal && (
              <button
                onClick={() => setFilterVal('')}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleAddChartQuick}
            className="btn-3d-secondary px-4 py-2 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Visualization</span>
          </button>
        </div>
      </div>

      {/* Sheet KPI Summary Ribbon */}
      {activeSheet && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 rounded-2xl glass-3d-card border border-slate-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Visualizations</div>
              <div className="text-base font-black text-white font-mono mt-0.5">{totalSheetCharts} Charts</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-3d-card border border-slate-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Primary Dimension</div>
              <div className="text-base font-black text-cyan-300 font-mono mt-0.5 truncate max-w-[140px]">{primaryDim}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-3d-card border border-slate-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Peak Observation</div>
              <div className="text-base font-black text-emerald-300 font-mono mt-0.5">
                {peakVal > 0 ? (peakVal >= 1000 ? (peakVal / 1000).toFixed(1) + 'k' : peakVal.toLocaleString()) : 'N/A'}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-3d-card border border-slate-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Average Value</div>
              <div className="text-base font-black text-purple-300 font-mono mt-0.5">
                {avgVal > 0 ? avgVal.toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Executive Business Insights Intelligence Center */}
      {businessQuestions.length > 0 && (
        <div className="rounded-2xl glass-3d-card border border-indigo-500/30 overflow-hidden shadow-2xl relative transition-all">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 via-purple-500 to-cyan-400 shadow-sm" />

          {/* Business Q&A Header */}
          <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                <HelpCircle className="w-5 h-5 text-indigo-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-white tracking-tight">Executive Business Insights & Decision Intelligence</h4>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono font-bold">
                    {businessQuestions.length} Questions Answered
                  </span>
                  {highImpactCount > 0 && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {highImpactCount} High Impact
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Actionable quantitative findings synthesized directly from active table data. Click any finding to isolate and highlight target visualizations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
              {/* Filter questions search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search findings, metrics..."
                  value={bqSearch}
                  onChange={(e) => setBqSearch(e.target.value)}
                  className="bg-slate-950/90 border border-slate-700/80 text-white placeholder-slate-500 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-400 w-40 sm:w-48 transition"
                />
                {bqSearch && (
                  <button
                    onClick={() => setBqSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Regenerate / Refresh Insights */}
              <button
                onClick={() => handleRefreshSheetInsights()}
                disabled={isSynthesizingInsights}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-xs text-indigo-300 hover:text-white flex items-center gap-1.5 border border-indigo-500/30 disabled:opacity-50"
                title="Synthesize fresh AI business insights for this sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizingInsights ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{isSynthesizingInsights ? 'Synthesizing...' : 'Synthesize AI Insights'}</span>
              </button>

              <button
                onClick={() => setShowBQs(!showBQs)}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
                title="Toggle Business Q&A Panel"
              >
                <span>{showBQs ? 'Collapse' : 'Expand'}</span>
                {showBQs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Category Filter Pills and Quick AI Ask Bar */}
          {showBQs && (
            <div className="px-4 sm:px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">Focus Area:</span>
                {[
                  'All',
                  'Executive',
                  'Revenue & Margins',
                  'Cohorts & Demographics',
                  'Risk & Anomalies',
                  'Velocity & Momentum'
                ].map((catName) => {
                  const isSelected = bqCategoryFilter === catName;
                  return (
                    <button
                      key={catName}
                      onClick={() => setBqCategoryFilter(catName)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition border ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-400/60 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>

              {/* Quick AI Query Input */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Wand2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400" />
                  <input
                    type="text"
                    placeholder="Ask AI or prompt custom finding..."
                    value={quickAIQuery}
                    onChange={(e) => setQuickAIQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickAIQuery.trim()) {
                        handleRefreshSheetInsights(quickAIQuery.trim());
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRefreshSheetInsights(quickAIQuery.trim())}
                  disabled={isSynthesizingInsights || !quickAIQuery.trim()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-40 shrink-0"
                >
                  Ask
                </button>
              </div>
            </div>
          )}

          {/* Business Q&A Content Cards */}
          {showBQs && (
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fadeIn">
              {filteredBQs.length > 0 ? (
                filteredBQs.map((q) => {
                  const isSelected = selectedInsightId === q.id;
                  const isCopied = copiedInsightId === q.id;
                  return (
                    <div
                      key={q.id}
                      onClick={() => handleSelectInsight(q)}
                      className={`p-4 rounded-xl transition-all cursor-pointer flex flex-col justify-between space-y-3 group hover:shadow-xl ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-950/90 via-slate-900/95 to-cyan-950/70 border-2 border-cyan-400 ring-2 ring-cyan-400/30 shadow-xl shadow-indigo-950/50 scale-[1.01]'
                          : 'bg-slate-950/70 border border-slate-800/90 hover:border-indigo-500/50 hover:bg-slate-900/80 hover:shadow-indigo-950/30'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {q.badge || 'Executive Finding'}
                            </span>
                            {q.impact_level && (
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                                q.impact_level === 'High Impact'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : q.impact_level === 'Risk Alert'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              }`}>
                                {q.impact_level}
                              </span>
                            )}
                            {q.confidence && (
                              <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {Math.round(q.confidence * 100)}% Conf.
                              </span>
                            )}
                          </div>

                          {q.metric && (
                            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                              {q.metric}
                            </span>
                          )}
                        </div>

                        <h5 className={`text-xs sm:text-sm font-bold transition-colors ${isSelected ? 'text-cyan-200' : 'text-white group-hover:text-indigo-200'}`}>
                          {q.question}
                        </h5>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {q.answer}
                        </p>
                      </div>

                      {/* Recommendation and Card Action Tools */}
                      <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {q.recommendation ? (
                          <p className="text-[11px] text-slate-300 italic flex-1">
                            <span className="text-amber-300 font-semibold not-italic">Recommendation: </span>
                            {q.recommendation}
                          </p>
                        ) : <div className="flex-1" />}

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {/* Copy Finding Button */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyInsight(e, q)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1"
                            title="Copy executive insight to clipboard"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="text-[10px]">{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>

                          {/* Deep-Dive Modal Inspector */}
                          <button
                            type="button"
                            onClick={(e) => handleInspectInsightDrilldown(e, q)}
                            className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition text-xs flex items-center gap-1"
                            title="Inspect underlying granular data drill-down"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Inspect</span>
                          </button>

                          {/* Focus Chart */}
                          {q.chart_target && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFocusChart(q.chart_target);
                              }}
                              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/40 transition"
                              title="Focus and scroll to corresponding visualization"
                            >
                              <span>Focus Chart</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400">No findings matched your search/filter criteria.</p>
                  <button
                    onClick={() => { setBqSearch(''); setBqCategoryFilter('All'); }}
                    className="text-xs text-cyan-400 hover:underline font-semibold"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid Layout of 3D Charts */}
      {activeSheet && activeSheet.charts && activeSheet.charts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 perspective-1000">
          {activeSheet.charts.map((chart, idx) => {
            const colSpan = chart.grid_w === 12 ? 'col-span-12' : 'col-span-12 lg:col-span-6';
            const hasCrossJoin = Boolean(chart.join_table);
            const hasMultiTableJoin = Boolean(chart.config?.joins && chart.config.joins.length > 0);
            const joinCount = chart.config?.joins ? chart.config.joins.length + 1 : 2;

            const isTargetedByInsight = Boolean(selectedInsightId && activeSheet?.business_questions?.some(
              q => q.id === selectedInsightId && q.chart_target && (
                chart.title.toLowerCase().includes(q.chart_target.toLowerCase()) ||
                (chart.x_field && q.chart_target.toLowerCase().includes(chart.x_field.toLowerCase())) ||
                (chart.y_field && q.chart_target.toLowerCase().includes(chart.y_field.toLowerCase()))
              )
            ));
            const isFocused = (focusedChartId === chart.id) || isTargetedByInsight;
            const currentChartType = chartTypeOverrides[chart.id] || chart.chart_type;

            return (
              <div
                id={`chart-card-${chart.id}`}
                key={chart.id}
                data-tour={`chart-card-${idx}`}
                className={`${colSpan} p-3.5 sm:p-5 md:p-6 rounded-2xl glass-3d-card card-3d-interactive flex flex-col justify-between group shadow-xl relative overflow-hidden border ${
                  isFocused
                    ? 'border-cyan-400 ring-2 ring-cyan-400/50 shadow-glow-cyan scale-[1.008]'
                    : 'border-slate-800/90'
                } transition-all duration-300`}
              >
                {/* 3D Top Gradient Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />

                {/* Chart Header */}
                <div className="flex items-start justify-between mb-3 pt-2.5 gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-white tracking-tight group-hover:text-cyan-300 transition-colors duration-200 drop-shadow-sm truncate">
                        {chart.title}
                      </h4>
                      {chart.config?.ai_agent_generated && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono flex items-center gap-1 font-bold shadow-sm shrink-0">
                          <Sparkles className="w-2.5 h-2.5 text-cyan-300 animate-pulse" />
                          AI AGENT
                        </span>
                      )}
                      {hasMultiTableJoin && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full badge-neon-emerald font-mono flex items-center gap-1 font-bold shadow-sm shrink-0">
                          <Layers className="w-2.5 h-2.5" />
                          {joinCount}-TABLE UNIFIED JOIN
                        </span>
                      )}
                      {!hasMultiTableJoin && hasCrossJoin && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full badge-neon-blue font-mono flex items-center gap-1 font-bold shadow-sm shrink-0">
                          <GitBranch className="w-2.5 h-2.5" />
                          JOIN: {chart.table_name} ⟷ {chart.join_table}
                        </span>
                      )}
                    </div>
                    {chart.description && (
                      <p className="text-xs text-slate-300 mt-1 mb-2 leading-relaxed">{chart.description}</p>
                    )}
                  </div>

                  {/* Actions & Interactive Chart Switcher */}
                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition shrink-0">
                    {/* In-Place Chart Type Switcher toolbar */}
                    <div className="hidden sm:flex items-center bg-slate-950/80 border border-slate-700/80 rounded-lg p-0.5">
                      <button
                        onClick={() => handleChangeChartType(chart, 'bar')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'bar' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Vertical Bar Chart"
                      >
                        <BarChart2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'line')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'line' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Line Trend Chart"
                      >
                        <TrendingUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'area')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'area' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Area Chart"
                      >
                        <Layers className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'pie')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'pie' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Pie / Donut Chart"
                      >
                        <PieChart className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'heatmap')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'heatmap' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to 2D Matrix Heatmap"
                      >
                        <Grid className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'treemap')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'treemap' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Portfolio Treemap"
                      >
                        <LayoutGrid className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleChangeChartType(chart, 'table')}
                        className={`p-1 rounded text-xs transition ${currentChartType === 'table' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Switch to Tabular Explorer"
                      >
                        <TableIcon className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Drill-down / Inspection button */}
                    <button
                      onClick={() => setDrilldownChart({ ...chart, chart_type: currentChartType })}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                      title="Inspect underlying data & export CSV"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {(currentChartType === 'line' || currentChartType === 'area') && (
                      <button
                        onClick={() => handleToggleForecast(chart)}
                        title={chart.config?.enable_forecast ? "Disable time-series forecasting" : "Enable Holt's Linear AI forecasting with 95% confidence intervals"}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition border ${
                          chart.config?.enable_forecast
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <TrendingUp className={`w-3 h-3 ${chart.config?.enable_forecast ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="hidden md:inline">{chart.config?.enable_forecast ? `Forecast ON (+${chart.config?.forecast_periods || 6})` : 'Forecast'}</span>
                      </button>
                    )}

                    <button
                      data-tour={`chart-edit-${idx}`}
                      onClick={() => setEditingChart(chart)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
                      title="Edit Chart Configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteChart(chart.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                      title="Delete Chart"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chart Visualization */}
                {(() => {
                  const originalData = chart.data || [];
                  const hasOriginalData = originalData.length > 0;
                  const isFiltered = Boolean(filterVal.trim());
                  const searchLower = filterVal.toLowerCase().trim();
                  const filteredData = isFiltered && hasOriginalData
                    ? originalData.filter((d: any) => String(d?.label ?? d?.name ?? '').toLowerCase().includes(searchLower))
                    : originalData;

                  if (isFiltered && hasOriginalData && filteredData.length === 0) {
                    return (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-4 text-center">
                        <Filter className="w-5 h-5 text-amber-400 mb-2" />
                        <span className="font-medium text-slate-300">No data points match &ldquo;{filterVal}&rdquo;</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">This chart has {originalData.length} total data points</span>
                        <button
                          onClick={() => setFilterVal('')}
                          className="mt-2.5 px-3 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-brand-300 font-medium rounded-lg border border-slate-700 transition"
                        >
                          Clear Search Filter
                        </button>
                      </div>
                    );
                  }

                  const chartToRender = {
                    ...chart,
                    chart_type: currentChartType,
                    data: filteredData
                  };
                  return <ChartRenderer chart={chartToRender} />;
                })()}

                {/* Chart Footer metadata */}
                <div className="pt-3.5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1 truncate max-w-[50%]">
                    <span className="text-slate-400">X:</span>
                    <span className="text-slate-300 font-medium truncate">{chart.x_field || 'index'}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate max-w-[50%]">
                    <span className="text-slate-400">Y:</span>
                    <span className="text-brand-300 font-medium font-bold truncate">
                      {chart.aggregation?.toUpperCase()} ({chart.y_field || 'count'})
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : loading || isAIAgentGenerating ? (
        <div className="p-14 text-center rounded-2xl glass-3d-card border border-cyan-500/30 space-y-6 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/30 to-indigo-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 mx-auto shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h4 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>{isAIAgentGenerating ? 'AI Agent Synthesizing Dashboard...' : 'Loading Executive Dashboard...'}</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isAIAgentGenerating
                ? 'Autonomous cognitive AI agent is analyzing dataset schemas, evaluating Pareto distributions, and building tailored compositions...'
                : 'Retrieving multi-dimensional sheets, dual-axis compositions, and cognitive business intelligence...'}
            </p>
          </div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pt-2">
            <div className="h-56 rounded-2xl bg-slate-900/40 border border-slate-800/80 animate-pulse p-4 space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-36 bg-slate-950/60 rounded-xl" />
            </div>
            <div className="h-56 rounded-2xl bg-slate-900/40 border border-slate-800/80 animate-pulse p-4 space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-36 bg-slate-950/60 rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 sm:p-12 text-center border-2 border-dashed border-cyan-500/30 rounded-2xl glass-3d-card space-y-6 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/30 to-indigo-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 mx-auto shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-8 h-8 text-cyan-300 animate-pulse" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h4 className="text-lg font-black text-white tracking-tight">AI Agent Ready to Synthesize Executive Dashboard</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Deploy our autonomous AI Agent to synthesize executive dual-axis compositions, longitudinal momentum trajectories, and boardroom decision insights for <strong className="text-white">{currentDataset.name}</strong> in under 1 second.
            </p>
          </div>

          {/* Archetype Quick Launch Pills */}
          <div className="max-w-2xl mx-auto pt-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Select AI Agent Archetype to Synthesize:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'executive', name: 'Executive Pulse', badge: 'Leadership', desc: 'KPI scale vs efficiency' },
                { id: 'revenue_growth', name: 'Revenue & Growth', badge: 'Financials', desc: 'Pacing & territory share' },
                { id: 'customer_cohort', name: 'Customer Cohorts', badge: 'Retention', desc: 'RFM value & demographics' },
                { id: 'operations_risk', name: 'Operations & Risk', badge: 'Outliers', desc: 'Bottlenecks & fat tails' },
                { id: 'profitability_frontier', name: 'Unit Economics', badge: 'Margins', desc: 'Price yield vs costs' },
                { id: 'predictive_momentum', name: 'Predictive Momentum', badge: 'Forecast', desc: 'Forward ARIMA run-rates' },
              ].map((arch) => (
                <button
                  key={arch.id}
                  onClick={() => handleAIAgentQuickGenerate(arch.id, true)}
                  disabled={isAIAgentGenerating}
                  className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/40 border border-slate-700/80 hover:border-cyan-500/50 text-left transition group shadow-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white group-hover:text-cyan-300 transition">
                    <span>{arch.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">{arch.badge}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">{arch.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleAIAgentQuickGenerate('executive', true)}
              disabled={isAIAgentGenerating}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/25 border border-cyan-400/40 hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
              <span>{isAIAgentGenerating ? 'AI Agent Synthesizing...' : '1-Click Executive AI Synthesis'}</span>
            </button>
            <button
              onClick={() => setIsAIGenerateModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-cyan-200 border border-slate-700/80 rounded-xl text-xs font-semibold transition"
            >
              Custom AI Studio Wizard
            </button>
            <button
              onClick={handleGenerateAll}
              disabled={isGeneratingAll}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-semibold transition"
            >
              {isGeneratingAll ? 'Synthesizing...' : 'Generate All Dashboards'}
            </button>
          </div>
        </div>
      )}

      {/* Underlying Data Drill-Down Modal */}
      {drilldownChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fadeIn">
          <div className="glass-3d-card border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30">
                  <TableIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate max-w-md">{drilldownChart.title}</h4>
                  <p className="text-[11px] text-slate-400">Aggregated underlying records & statistics</p>
                </div>
              </div>
              <button
                onClick={() => { setDrilldownChart(null); setDrilldownSearch(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drilldown Summary Cards */}
            {(() => {
              const data = drilldownChart.data || [];
              const nums = data.map(d => Number(d.value)).filter(v => !isNaN(v));
              const sum = nums.reduce((a, b) => a + b, 0);
              const avg = nums.length > 0 ? (sum / nums.length).toFixed(1) : 0;
              const max = nums.length > 0 ? Math.max(...nums) : 0;
              const min = nums.length > 0 ? Math.min(...nums) : 0;

              return (
                <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total Rows</span>
                    <span className="font-mono font-bold text-white">{data.length}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Sum</span>
                    <span className="font-mono font-bold text-cyan-300">{sum.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Average</span>
                    <span className="font-mono font-bold text-emerald-300">{avg}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Max / Min</span>
                    <span className="font-mono font-bold text-purple-300">{max} / {min}</span>
                  </div>
                </div>
              );
            })()}

            {/* Search within Drilldown */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/40">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter drill-down data..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                onClick={() => handleExportChartCSV(drilldownChart)}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 shrink-0"
                title="Download CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Drilldown Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                    <th className="py-2.5 px-3 w-12 text-center font-mono">#</th>
                    <th className="py-2.5 px-4 font-semibold">Label / Dimension</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Aggregated Value</th>
                    <th className="py-2.5 px-4 text-right font-semibold">% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(() => {
                    const data = drilldownChart.data || [];
                    const filtered = drilldownSearch.trim()
                      ? data.filter(d => String(d.label).toLowerCase().includes(drilldownSearch.toLowerCase().trim()))
                      : data;
                    const totalVal = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            No matching records found.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((row, i) => {
                      const valNum = Number(row.value) || 0;
                      const pct = totalVal > 0 ? ((valNum / totalVal) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={i} className="hover:bg-slate-900/60 transition">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-2.5 px-4 font-medium text-white">{row.label || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-300">
                            {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                            {pct}%
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-end bg-slate-900/60">
              <button
                onClick={() => { setDrilldownChart(null); setDrilldownSearch(''); }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Place Chart Editor Modal */}
      {editingChart && (
        <ChartEditorModal
          chart={editingChart}
          columns={allColumns}
          tables={currentDataset.tables || []}
          isOpen={true}
          onClose={() => setEditingChart(null)}
          onSave={handleSaveChart}
        />
      )}

      {/* AI Dashboard Studio Modal */}
      <AIDashboardStudioModal
        dataset={currentDataset}
        sheets={sheets}
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onChartCreated={fetchSheets}
      />

      {/* AI Storyteller Presentation Deck Modal */}
      {activeSheet && (
        <StoryModeModal
          dataset={currentDataset}
          sheet={activeSheet}
          overview={overview}
          isOpen={isStoryModeOpen}
          onClose={() => setIsStoryModeOpen(false)}
        />
      )}

      {/* Executive Template Report Modal */}
      <ExecutiveDashboardReportModal
        datasetId={currentDataset.id}
        datasetName={currentDataset.name}
        isOpen={isExecutiveReportOpen}
        onClose={() => setIsExecutiveReportOpen(false)}
      />

      {/* Generate AI Dashboard Studio Wizard Modal */}
      <GenerateAIDashboardModal
        dataset={currentDataset}
        isOpen={isAIGenerateModalOpen}
        onClose={() => setIsAIGenerateModalOpen(false)}
        onSuccess={(newSheets, msg) => {
          setSheets(prev => {
            return newSheets.map(ns => {
              const existing = prev.find(p => p.id === ns.id);
              if (existing && existing.charts) {
                const updatedCharts = (ns.charts || []).map(c => {
                  if (c.data && c.data.length > 0) return c;
                  const existingChart = existing.charts.find(ec => ec.id === c.id);
                  return existingChart && existingChart.data ? { ...c, data: existingChart.data } : c;
                });
                return { ...ns, charts: updatedCharts };
              }
              return ns;
            });
          });
          if (newSheets.length > 0) {
            setActiveSheetIndex(newSheets.length - 1);
          }
          setChartTypeOverrides({});
          setSelectedInsightId(null);
          setFocusedChartId(null);
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 5000);
        }}
      />
    </div>
  );
};
