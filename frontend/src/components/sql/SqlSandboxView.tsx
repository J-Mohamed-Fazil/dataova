import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { SqlQueryResult, SqlTranslateResult } from '../../types';

export const SqlSandboxView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const primaryTable = currentDataset?.tables[0]?.table_name || 'data';

  const [nlPrompt, setNlPrompt] = useState<string>('');
  const [sqlCode, setSqlCode] = useState<string>(
    `SELECT *\nFROM [${primaryTable}]\nLIMIT 15;`
  );
  const [pandasCode, setPandasCode] = useState<string>(
    `df.head(15)`
  );
  const [activeTab, setActiveTab] = useState<'sql' | 'pandas'>('sql');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    {
      label: 'Top Aggregates',
      sql: `SELECT Category, ROUND(SUM(Revenue), 2) as total_revenue\nFROM [${primaryTable}]\nGROUP BY Category\nORDER BY total_revenue DESC\nLIMIT 10;`,
      pandas: `df.groupby('Category')['Revenue'].sum().round(2).reset_index().sort_values('Revenue', ascending=False).head(10)`
    },
    {
      label: 'Average per Group',
      sql: `SELECT Category, ROUND(AVG(Sales), 2) as avg_sales, COUNT(*) as volume\nFROM [${primaryTable}]\nGROUP BY Category\nORDER BY volume DESC;`,
      pandas: `df.groupby('Category').agg(avg_sales=('Sales', 'mean'), volume=('Sales', 'count')).round(2).reset_index()`
    },
    {
      label: 'Filtered Ranking',
      sql: `SELECT *\nFROM [${primaryTable}]\nWHERE Sales > 500\nORDER BY Sales DESC\nLIMIT 20;`,
      pandas: `df[df['Sales'] > 500].sort_values('Sales', ascending=False).head(20)`
    }
  ];

  const handleExecuteSql = async (overrideSql?: string) => {
    if (!currentDataset) return;
    const queryToRun = overrideSql || sqlCode;
    try {
      setIsExecuting(true);
      setError(null);
      const res = await api.executeSql(currentDataset.id, queryToRun, primaryTable);
      setQueryResult(res);
      if (res.chart_suggestion) {
        setViewMode('chart');
      }
    } catch (err: any) {
      setError(err.message || 'SQL execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTranslateNl = async () => {
    if (!currentDataset || !nlPrompt.trim()) return;
    try {
      setIsTranslating(true);
      setError(null);
      const res = await api.translateNlToSql(currentDataset.id, nlPrompt, primaryTable);
      setSqlCode(res.sql_query);
      setPandasCode(res.pandas_code);
      // Auto-run translated query
      handleExecuteSql(res.sql_query);
    } catch (err: any) {
      setError(err.message || 'Failed to translate natural language prompt.');
    } finally {
      setIsTranslating(false);
    }
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

  // Prepare chart data if chart view is active
  const chartData = React.useMemo(() => {
    if (!queryResult || queryResult.rows.length === 0) return [];
    const cols = queryResult.columns;
    if (cols.length < 2) return [];

    const xCol = cols[0];
    const yCol = cols[1];

    return queryResult.rows.slice(0, 15).map(r => ({
      name: String(r[xCol] ?? 'Unknown'),
      value: typeof r[yCol] === 'number' ? r[yCol] : parseFloat(r[yCol]) || 0
    }));
  }, [queryResult]);

  return (
    <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full overflow-y-auto custom-scrollbar perspective-1000">
      {/* Header Banner in 3D */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-3d-card rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden border border-slate-700/80">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-500 shadow-sm" />
        <div className="pt-2 space-y-1 translate-z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full badge-neon-blue text-[10px] font-black uppercase tracking-wider flex items-center gap-1 font-mono shadow-sm">
              <Terminal className="w-3 h-3 text-cyan-400" />
              SQL & Analytics Lab
            </span>
            <span className="text-xs text-slate-400 font-medium">
              In-Memory Vectorized Query Sandbox
            </span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            Natural Language SQL Lab & Python Sandbox
          </h1>
        </div>

        {/* Quick Sample Query Buttons */}
        <div className="flex items-center gap-2 translate-z-15 flex-wrap">
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              data-tour={`sql-sample-${idx}`}
              onClick={() => {
                setSqlCode(q.sql);
                setPandasCode(q.pandas);
                handleExecuteSql(q.sql);
              }}
              className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Prompt Input */}
      <div className="glass-3d-card rounded-2xl p-4 shadow-xl space-y-2 relative overflow-hidden border border-slate-700/80">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Ask in Plain English (Generates ANSI SQL & Pandas DataFrames Automatically)</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTranslateNl()}
            placeholder="e.g. 'Show top 5 categories by total revenue' or 'Find average discount by region'"
            className="flex-1 bg-slate-950/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner font-mono"
          />
          <button
            onClick={handleTranslateNl}
            disabled={isTranslating || !nlPrompt.trim()}
            className="btn-3d-cyan px-4 py-2.5 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTranslating ? 'Synthesizing...' : 'Translate & Run'}</span>
          </button>
        </div>
      </div>

      {/* Editor & Action Control Deck in 3D */}
      <div className="glass-3d-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl relative overflow-hidden border border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>

            {activeTab === 'sql' && (
              <button
                data-tour="sql-run-btn"
                onClick={() => handleExecuteSql()}
                disabled={isExecuting}
                className="btn-3d-primary px-4 py-1.5 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isExecuting ? 'Executing...' : 'Run Query'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Text Area Code Editor */}
        <div className="relative">
          {activeTab === 'sql' ? (
            <textarea
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500 transition leading-relaxed resize-y shadow-inner"
            />
          ) : (
            <textarea
              value={pandasCode}
              onChange={(e) => setPandasCode(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y shadow-inner"
            />
          )}
        </div>
      </div>

      {/* Query Execution Status Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section in 3D */}
      {queryResult && (
        <div className="glass-3d-card table-3d-container rounded-2xl p-3.5 sm:p-5 space-y-4 shadow-2xl border border-slate-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
              <div className="tabs-3d-rail">
                <button
                  onClick={() => setViewMode('table')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'table' ? 'tab-3d-item-active' : ''
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={`tab-3d-item flex items-center gap-1 ${
                    viewMode === 'chart' ? 'tab-3d-item-active' : ''
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Chart</span>
                </button>
              </div>

              <button
                onClick={handleExportResultCsv}
                className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table or Chart Visualization */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="table-3d-header text-slate-300 text-[11px] font-bold uppercase tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    {queryResult.columns.map((col) => (
                      <th key={col} className="px-4 py-3.5 font-mono">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {queryResult.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      {queryResult.columns.map((col) => (
                        <td key={col} className="px-4 py-3.5 font-mono text-slate-200 leading-normal text-xs">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : (
                            <span className="text-slate-500 italic">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
};
