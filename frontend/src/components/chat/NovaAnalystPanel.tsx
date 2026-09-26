import React, { useState, useRef } from 'react';
import {
  Database,
  Table,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Tag,
  Hash,
  Calendar,
  Type,
  ToggleLeft,
  Key,
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { AskDatovaView } from './AskDatovaView';
import { ColumnMetadata } from '../../types';

export interface NovaAnalystPanelProps {
  onOpenUpload?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
  isFullscreen?: boolean;
}

export const NovaAnalystPanel: React.FC<NovaAnalystPanelProps> = ({
  onOpenUpload,
  onClose,
  isMaximized = false,
  isFullscreen = false,
}) => {
  const { currentDataset, activeTab } = useWorkspace();
  const [isSchemaOpen, setIsSchemaOpen] = useState<boolean>(false);
  const [schemaSearch, setSchemaSearch] = useState<string>('');
  const [copiedCol, setCopiedCol] = useState<string | null>(null);

  // Function registered by AskDatovaView to insert text into its prompt input
  const insertPromptRef = useRef<((text: string) => void) | null>(null);

  const getTabDisplayName = (tab: string): string => {
    const tabMap: Record<string, string> = {
      overview: 'Executive Overview',
      dashboard: 'Interactive Dashboard',
      insights: '3D Nova Insights',
      forecast: 'Predictive Studio',
      clusters: 'ML Segments',
      automl: 'AutoML Studio',
      dataprep: 'Data Prep & Cleaning',
      model: 'E-ER Model Studio',
      sql: 'SQL Lab',
      data: 'Data Hub',
      chat: 'Ask AI Analyst',
      report: 'Executive Dossier',
      settings: 'Settings',
    };
    return tabMap[tab] || tab;
  };

  const handleColumnClick = (colName: string) => {
    if (insertPromptRef.current) {
      insertPromptRef.current(colName);
    }
    setCopiedCol(colName);
    setTimeout(() => setCopiedCol(null), 1400);
  };

  const handleTableQuery = (tableName: string) => {
    if (insertPromptRef.current) {
      insertPromptRef.current(`Summarize key metrics and distributions in table "${tableName}"`);
    }
    setIsSchemaOpen(false);
  };

  const getColumnTypeIcon = (type: ColumnMetadata['data_type']) => {
    switch (type) {
      case 'numeric':
        return <Hash className="w-3 h-3 text-emerald-400" />;
      case 'datetime':
        return <Calendar className="w-3 h-3 text-cyan-400" />;
      case 'categorical':
      case 'text':
        return <Type className="w-3 h-3 text-blue-400" />;
      case 'boolean':
        return <ToggleLeft className="w-3 h-3 text-purple-400" />;
      case 'identifier':
        return <Key className="w-3 h-3 text-amber-400" />;
      default:
        return <Tag className="w-3 h-3 text-slate-400" />;
    }
  };

  const totalColumns = currentDataset?.tables?.reduce((acc, t) => acc + (t.columns?.length || 0), 0) || 0;
  const tableCount = currentDataset?.tables?.length || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D1A] overflow-hidden select-text">
      {/* ── Context Ribbon ── */}
      {currentDataset && (
        <div className="px-3.5 py-2 bg-[#0A1224] border-b border-cyan-500/15 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            {/* Active Dataset Chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-200 font-medium shrink-0">
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-white max-w-[130px] truncate" title={currentDataset.name}>
                {currentDataset.name}
              </span>
              <span className="text-[10px] text-cyan-400/80 font-mono">
                ({currentDataset.row_count.toLocaleString()} rows)
              </span>
            </div>

            {/* Detected Domain */}
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10.5px] text-slate-300 capitalize shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {currentDataset.detected_domain}
            </span>

            {/* Health Score */}
            {typeof currentDataset.data_health_score === 'number' && (
              <span
                className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono shrink-0 border ${
                  currentDataset.data_health_score >= 80
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {currentDataset.data_health_score}% Clean
              </span>
            )}

            {/* Current Dashboard View Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[10.5px] font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Viewing:</span>
              <span className="text-white font-semibold">{getTabDisplayName(activeTab)}</span>
            </div>
          </div>

          {/* Schema Explorer Toggle Button */}
          <button
            onClick={() => setIsSchemaOpen(!isSchemaOpen)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border shrink-0 ${
              isSchemaOpen
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:text-white hover:border-cyan-500/40'
            }`}
            title="Inspect schema columns to insert into prompts"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px]">Schema ({tableCount}T · {totalColumns}C)</span>
            {isSchemaOpen ? (
              <ChevronUp className="w-3 h-3 text-cyan-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      )}

      {/* ── Collapsible Schema Explorer Drawer ── */}
      {isSchemaOpen && currentDataset && (
        <div className="bg-[#070D18] border-b border-cyan-500/25 p-3 animate-fadeIn shrink-0 max-h-64 overflow-y-auto custom-scrollbar shadow-inner">
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-cyan-400" />
                Dataset Schema Explorer
              </span>
              <span className="text-[10px] text-slate-400">
                (Click any column to insert into prompt)
              </span>
            </div>

            {/* Quick search inside schema */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                placeholder="Filter columns..."
                className="bg-slate-900/90 border border-slate-700/70 rounded-md pl-6 pr-2 py-0.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-32 sm:w-44"
              />
            </div>
          </div>

          <div className="space-y-3">
            {currentDataset.tables?.map((table) => {
              const filteredCols = (table.columns || []).filter((c) =>
                !schemaSearch || c.column_name.toLowerCase().includes(schemaSearch.toLowerCase())
              );

              if (schemaSearch && filteredCols.length === 0) return null;

              return (
                <div
                  key={table.id || table.table_name}
                  className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-300">
                        {table.table_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({table.row_count.toLocaleString()} rows)
                      </span>
                    </div>

                    <button
                      onClick={() => handleTableQuery(table.table_name)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      Query table
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {filteredCols.map((col) => {
                      const isJustClicked = copiedCol === col.column_name;
                      return (
                        <button
                          key={col.column_name}
                          onClick={() => handleColumnClick(col.column_name)}
                          className={`px-2 py-1 rounded-md text-[11px] font-mono flex items-center gap-1 transition ${
                            isJustClicked
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300 scale-95'
                              : 'bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-white'
                          }`}
                          title={`Click to insert column "${col.column_name}" into question (${col.data_type})`}
                        >
                          {isJustClicked ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            getColumnTypeIcon(col.data_type)
                          )}
                          <span>{col.column_name}</span>
                          {isJustClicked && (
                            <span className="text-[9px] text-emerald-400 font-sans">Added!</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Chat Component ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AskDatovaView
          compact={true}
          activeTabLabel={getTabDisplayName(activeTab)}
          onOpenUpload={onOpenUpload}
          onInsertPromptRegister={(fn) => {
            insertPromptRef.current = fn;
          }}
        />
      </div>
    </div>
  );
};
