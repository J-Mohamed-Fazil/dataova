import React, { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Play,
  Sparkles,
  Copy,
  Check,
  Download,
  BarChart2,
  Table as TableIcon,
  Code2,
  Clock,
  Layers,
  HelpCircle,
  AlertCircle,
  MessageSquareQuote,
  Lightbulb,
  ArrowRight,
  Database,
  Key,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  History,
  Wand2,
  FileJson,
  Search,
  PieChart as PieChartIcon,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { SqlQueryResult, SqlTranslateResult } from '../../types';

const CHART_COLORS = ['#06B6D4', '#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#14B8A6'];

export const SqlSandboxView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const tables = currentDataset?.tables || [];
  const [showSchemaDrawer, setShowSchemaDrawer] = useState<boolean>(true);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ sql: string; question?: string; time: string }>>([]);
  const [tableSearchFilter, setTableSearchFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'sql' | 'pandas'>('sql');
  const [viewMode, setViewMode] = useState<'table' | 'bar' | 'area' | 'pie'>('table');

  const primaryTable = tables[0]?.table_name || 'data';

  // Dynamic column detection across all relational tables
  const { dimCol, metCol, isMultiTable, hasRelationships } = useMemo(() => {
    const allCols = tables.flatMap(t => t.columns || []);
    const firstTableCols = tables[0]?.columns || [];

    const strCandidate = firstTableCols.find(
      (c) => (c.data_type === 'categorical' || c.data_type === 'text') && !c.is_identifier
    )?.column_name || allCols.find(
      (c) => (c.data_type === 'categorical' || c.data_type === 'text') && !c.is_identifier
    )?.column_name;

    const numCandidate = firstTableCols.find(
      (c) => c.data_type === 'numeric' && !c.is_identifier
    )?.column_name || allCols.find(
      (c) => c.data_type === 'numeric' && !c.is_identifier
    )?.column_name;

    return {
      dimCol: strCandidate || firstTableCols[0]?.column_name || 'Category',
      metCol: numCandidate || 'Revenue',
      isMultiTable: tables.length > 1,
      hasRelationships: (currentDataset?.relationships?.length || 0) > 0 || tables.length > 1
    };
  }, [currentDataset, tables]);

  const [nlPrompt, setNlPrompt] = useState<string>('');
  const [activeQuestion, setActiveQuestion] = useState<string>('');
  const [lastExplanation, setLastExplanation] = useState<string | null>(null);
  const [sqlCode, setSqlCode] = useState<string>(
    `SELECT *\nFROM [${primaryTable}]\nLIMIT 15;`
  );
  const [pandasCode, setPandasCode] = useState<string>(
    `df.head(15)`
  );
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isAutoFixing, setIsAutoFixing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Suggested plain English questions
  const suggestedQuestions = useMemo(() => [
    `Show top 5 ${dimCol} by total ${metCol}`,
    `What is the average ${metCol}?`,
    `Count total records in ${primaryTable}`,
    `Show unique ${dimCol} values`,
    `Find lowest 3 ${dimCol} by ${metCol}`
  ], [dimCol, metCol, primaryTable]);

  const handleExecuteSql = async (overrideSql?: string, questionContext?: string) => {
    if (!currentDataset) return;
    const queryToRun = overrideSql || sqlCode;
    const effectiveQuestion = questionContext !== undefined ? questionContext : activeQuestion;

    try {
      setIsExecuting(true);
      setError(null);
      const res = await api.executeSql(
        currentDataset.id,
        queryToRun,
        primaryTable,
        200,
        effectiveQuestion
      );
      setQueryResult(res);
      if (res.chart_suggestion && res.rows.length >= 1) {
        setViewMode('bar');
      }

      // Add to session query history
      setQueryHistory(prev => [
        { sql: queryToRun, question: effectiveQuestion, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 19)
      ]);
    } catch (err: any) {
      setError(err.message || 'SQL execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTranslateNl = async (customPrompt?: string) => {
    const promptToRun = (customPrompt || nlPrompt).trim();
    if (!currentDataset || !promptToRun) return;

    try {
      setIsTranslating(true);
      setError(null);
      setActiveQuestion(promptToRun);
      if (customPrompt) {
        setNlPrompt(customPrompt);
      }

      const res = await api.translateNlToSql(currentDataset.id, promptToRun, primaryTable);
      setSqlCode(res.sql_query);
      setPandasCode(res.pandas_code);
      setLastExplanation(res.explanation || null);

      // Auto-run translated query and pass question context for answer synthesis
      await handleExecuteSql(res.sql_query, promptToRun);
    } catch (err: any) {
      setError(err.message || 'Failed to translate natural language question to SQL.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAiAutoFix = async () => {
    if (!currentDataset || !sqlCode) return;
    try {
      setIsAutoFixing(true);
      setError(null);
      const prompt = `Fix this SQL query that produced error: "${error}". Query:\n${sqlCode}`;
      const res = await api.translateNlToSql(currentDataset.id, prompt, primaryTable);
      setSqlCode(res.sql_query);
      setPandasCode(res.pandas_code);
      setLastExplanation(res.explanation || "Self-healed query syntax and relationships.");
      await handleExecuteSql(res.sql_query, activeQuestion || "AI Auto-Fix");
    } catch (err: any) {
      setError(err.message || 'Auto-fix failed to resolve query.');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleFormatSql = () => {
    let formatted = sqlCode
      .replace(/\s+/g, ' ')
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\b(LEFT|RIGHT|INNER|FULL)?\s*JOIN\b/gi, '\nJOIN')
      .replace(/\bON\b/gi, ' ON')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();
    if (!formatted.endsWith(';')) formatted += ';';
    setSqlCode(formatted);
  };

  const handleInsertIdentifier = (text: string) => {
    setSqlCode(prev => prev + ` [${text}]`);
  };

  const handleCopyCode = () => {
    const textToCopy = activeTab === 'sql' ? sqlCode : pandasCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportResultCsv = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const cols = queryResult.columns;
    const csvContent = [
      cols.join(','),
      ...queryResult.rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql_query_result.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResultJson = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const blob = new Blob([JSON.stringify(queryResult.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql_query_result.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare chart data if chart view is active
  const chartData = useMemo(() => {
    if (!queryResult || queryResult.rows.length === 0) return [];
    const cols = queryResult.columns;
    if (cols.length < 2) return [];

    const xCol = cols[0];
    const yCol = cols[1];

    return queryResult.rows.slice(0, 20).map(r => ({
      name: String(r[xCol] ?? 'Unknown'),
      value: typeof r[yCol] === 'number' ? r[yCol] : parseFloat(r[yCol]) || 0
    }));
  }, [queryResult]);

  // Filtered rows for result search
  const filteredRows = useMemo(() => {
    if (!queryResult || !queryResult.rows) return [];
    if (!tableSearchFilter.trim()) return queryResult.rows;
    const q = tableSearchFilter.toLowerCase();
    return queryResult.rows.filter(r => 
      queryResult.columns.some(c => String(r[c] ?? '').toLowerCase().includes(q))
    );
  }, [queryResult, tableSearchFilter]);

  return (
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full overflow-y-auto custom-scrollbar perspective-1000">
      {/* Header Banner in 3D */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-3d-card rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden border border-slate-700/80">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-500 shadow-sm" />
        <div className="pt-2 space-y-1.5 translate-z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full badge-neon-blue text-[10px] font-black uppercase tracking-wider flex items-center gap-1 font-mono shadow-sm">
              <Terminal className="w-3 h-3 text-cyan-400" />
              SQL & Analytics Lab
            </span>
            {hasRelationships && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-mono shadow-sm">
                <Layers className="w-3 h-3 text-indigo-400" />
                EER Relational Graph ({tables.length} Tables Connected)
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80 text-[10px] font-medium flex items-center gap-1.5 font-mono shadow-sm">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>{tables.length} Table{tables.length > 1 ? 's' : ''} Live</span>
            </span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            Natural Language SQL Lab & Python Sandbox
          </h1>
        </div>

        {/* Schema Inspector Action */}
        <div className="flex items-center gap-2 translate-z-15">
          <button
            onClick={() => setShowSchemaDrawer(!showSchemaDrawer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              showSchemaDrawer 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Schema Inspector</span>
            {showSchemaDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Interactive EER Schema Inspector Drawer */}
      {showSchemaDrawer && (
        <div className="glass-3d-card rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700/80 space-y-3 bg-gradient-to-b from-slate-900/90 to-slate-950/90 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                EER Relational Schema & Columns Inspector
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                (Click any column to insert into query)
              </span>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/60">
              {tables.length} Table{tables.length > 1 ? 's' : ''} Mounted
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tables.map((tbl) => (
              <div
                key={tbl.table_name}
                className={`p-3 rounded-xl border transition ${
                  tbl.table_name === primaryTable
                    ? 'bg-cyan-950/20 border-cyan-500/50 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    {tbl.table_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {tbl.columns.length} cols &bull; {tbl.row_count?.toLocaleString() || 'live'} rows
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar pt-1">
                  {tbl.columns.map((c) => {
                    const isKey = c.is_identifier || c.column_name.toLowerCase().endsWith('_id') || c.column_name.toLowerCase() === 'id';
                    const isNum = c.data_type === 'numeric';
                    return (
                      <button
                        key={c.column_name}
                        onClick={() => handleInsertIdentifier(`${tbl.table_name}].[${c.column_name}`)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 transition ${
                          isKey
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            : isNum
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={`${c.column_name} (${c.data_type}) - Click to insert`}
                      >
                        {isKey && <Key className="w-2.5 h-2.5 text-amber-400" />}
                        <span>{c.column_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Relational Foreign Key links */}
          {currentDataset?.relationships && currentDataset.relationships.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-indigo-400" />
                Foreign Key Links:
              </span>
              {currentDataset.relationships.map((rel, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-indigo-950/40 text-indigo-300 rounded-md border border-indigo-800/50 font-mono text-[10px]"
                >
                  [{rel.source_table}].[{rel.source_column}] &harr; [{rel.target_table}].[{rel.target_column}]
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Natural Language Prompt Input */}
      <div className="glass-3d-card rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 relative overflow-hidden border border-slate-700/80">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Ask Any Question in Plain English</span>
            <span className="text-[11px] text-slate-400 font-normal ml-1">
              (Synthesizes Multi-Table ANSI SQL, Executes Live, and Returns the Direct Answer)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTranslateNl()}
            placeholder={`e.g. 'Show top 5 ${dimCol} by total ${metCol}' or 'What is the average ${metCol}?' or 'Show all records where ${metCol} > 500'`}
            className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner font-mono"
          />
          <button
            onClick={() => handleTranslateNl()}
            disabled={isTranslating || !nlPrompt.trim()}
            className="btn-3d-cyan px-5 py-2.5 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTranslating ? 'Analyzing & Running...' : 'Translate & Run'}</span>
          </button>
        </div>

        {/* Suggested Question Pills */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto custom-scrollbar pb-1 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1 shrink-0">
            <Lightbulb className="w-3 h-3 text-amber-400" />
            Try:
          </span>
          {suggestedQuestions.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleTranslateNl(sq)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] font-medium transition border border-slate-700/60 shrink-0 flex items-center gap-1 shadow-sm"
            >
              <span>{sq}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Direct Plain English Answer Card (if available) */}
      {queryResult?.summary && (
        <div className="glass-3d-card rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden border border-cyan-500/40 bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-blue-950/30 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0 mt-0.5">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-900/40 border border-cyan-700/50 px-2 py-0.5 rounded-full font-mono">
                  Direct Answer
                </span>
                {activeQuestion && (
                  <span className="text-xs text-slate-300 font-medium truncate max-w-md">
                    &ldquo;{activeQuestion}&rdquo;
                  </span>
                )}
                {lastExplanation && (
                  <span className="text-[11px] text-slate-400 italic">
                    &bull; {lastExplanation}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white leading-relaxed">
                {queryResult.summary.split('**').map((chunk, i) => 
                  i % 2 === 1 ? <strong key={i} className="text-cyan-300 font-bold">{chunk}</strong> : chunk
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Editor & Action Control Deck in 3D */}
      <div className="glass-3d-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl relative overflow-hidden border border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          {/* 3D Language Tabs */}
          <div className="tabs-3d-rail">
            <button
              onClick={() => setActiveTab('sql')}
              className={`tab-3d-item flex items-center gap-1.5 ${
                activeTab === 'sql' ? 'tab-3d-item-active' : ''
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>ANSI SQL Query</span>
            </button>
            <button
              onClick={() => setActiveTab('pandas')}
              className={`tab-3d-item flex items-center gap-1.5 ${
                activeTab === 'pandas' ? 'tab-3d-item-active' : ''
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Python / Pandas Snippet</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'sql' && (
              <button
                onClick={handleFormatSql}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                title="Format & Beautify SQL"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Format</span>
              </button>
            )}

            <button
              onClick={handleCopyCode}
              className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {queryHistory.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`btn-3d-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm ${
                  showHistory ? 'text-cyan-300 border-cyan-500/50' : 'text-slate-300'
                }`}
                title="Query History"
              >
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>History ({queryHistory.length})</span>
              </button>
            )}

            {activeTab === 'sql' && (
              <button
                data-tour="sql-run-btn"
                onClick={() => handleExecuteSql()}
                disabled={isExecuting}
                className="btn-3d-primary px-4 py-1.5 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isExecuting ? 'Executing...' : 'Run Query'}</span>
                <span className="text-[10px] text-cyan-200 font-mono opacity-80 hidden sm:inline">(Ctrl+Enter)</span>
              </button>
            )}
          </div>
        </div>

        {/* History Drawer */}
        {showHistory && queryHistory.length > 0 && (
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Session Query History
            </div>
            {queryHistory.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSqlCode(item.sql);
                  if (item.question) setActiveQuestion(item.question);
                  handleExecuteSql(item.sql, item.question);
                }}
                className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition text-xs font-mono text-slate-300 flex items-center justify-between gap-3"
              >
                <span className="truncate flex-1">{item.question || item.sql.replace(/\n/g, ' ')}</span>
                <span className="text-[10px] text-slate-500 shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Text Area Code Editor */}
        <div className="relative">
          {activeTab === 'sql' ? (
            <textarea
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteSql();
                }
              }}
              rows={6}
              spellCheck={false}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500 transition leading-relaxed resize-y shadow-inner"
            />
          ) : (
            <textarea
              value={pandasCode}
              onChange={(e) => setPandasCode(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y shadow-inner"
            />
          )}
        </div>
      </div>

      {/* Query Execution Error Banner with AI Auto-Fix */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-mono">{error}</span>
          </div>
          <button
            onClick={handleAiAutoFix}
            disabled={isAutoFixing}
            className="btn-3d-cyan px-3.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-spin" />
            <span>{isAutoFixing ? 'Fixing Query...' : 'AI Auto-Fix Error'}</span>
          </button>
        </div>
      )}

      {/* Results Section in 3D */}
      {queryResult && (
        <div className="glass-3d-card table-3d-container rounded-2xl p-3.5 sm:p-5 space-y-4 shadow-2xl border border-slate-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-extrabold text-white">Execution Result</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full badge-neon-emerald font-mono flex items-center gap-1 shadow-sm">
                <Clock className="w-3 h-3" />
                {queryResult.execution_time_ms} ms
              </span>
              <span className="text-xs text-cyan-400 font-medium font-mono">
                {queryResult.total_returned} rows returned
              </span>
            </div>

            {/* View Mode & Export Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="tabs-3d-rail">
                <button
                  onClick={() => setViewMode('table')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'table' ? 'tab-3d-item-active' : ''
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setViewMode('bar')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'bar' ? 'tab-3d-item-active' : ''
                  }`}
                  title="Bar Chart"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Bar</span>
                </button>
                <button
                  onClick={() => setViewMode('area')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'area' ? 'tab-3d-item-active' : ''
                  }`}
                  title="Area Trend"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Area</span>
                </button>
                <button
                  onClick={() => setViewMode('pie')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'pie' ? 'tab-3d-item-active' : ''
                  }`}
                  title="Pie Breakdown"
                >
                  <PieChartIcon className="w-3.5 h-3.5" />
                  <span>Pie</span>
                </button>
              </div>

              <button
                onClick={handleExportResultCsv}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                title="Export Result as CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportResultJson}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                title="Export Result as JSON"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Quick Result Search Filter */}
          {viewMode === 'table' && queryResult.rows.length > 5 && (
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearchFilter}
                  onChange={(e) => setTableSearchFilter(e.target.value)}
                  placeholder="Filter returned rows..."
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Table or Chart Visualization */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto max-h-96 custom-scrollbar rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="table-3d-header text-slate-300 text-[11px] font-bold uppercase tracking-wider sticky top-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
                  <tr>
                    {queryResult.columns.map((col) => (
                      <th key={col} className="px-4 py-3.5 font-mono">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      {queryResult.columns.map((col) => (
                        <td key={col} className="px-4 py-3.5 font-mono text-slate-200 leading-normal text-xs">
                          {row[col] !== null && row[col] !== undefined ? (
                            typeof row[col] === 'number' ? (
                              <span className="text-cyan-300 font-semibold">{row[col].toLocaleString()}</span>
                            ) : (
                              String(row[col])
                            )
                          ) : (
                            <span className="text-slate-500 italic">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'bar' ? (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 14, right: 28, left: 14, bottom: 26 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} tickMargin={8} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} tickMargin={8} width={48} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : viewMode === 'area' ? (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 28, left: 14, bottom: 26 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} tickMargin={8} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} tickMargin={8} width={48} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full pt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
