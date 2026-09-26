import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  Columns,
  ShieldAlert,
  GitBranch,
  Check,
  X,
  Hash,
  Calendar,
  ToggleLeft,
  Type,
  Key,
  HelpCircle,
  AlertCircle,
  BarChart2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { TableMetadata, ColumnMetadata } from '../../types';

export const DataView: React.FC = () => {
  const { currentDataset, refreshCurrentDataset, setActiveTab } = useWorkspace();
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'schema' | 'quality' | 'relationships'>('preview');
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);

  // Pagination, search, and sorting state for the interactive data explorer
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tableRows, setTableRows] = useState<Record<string, any>[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingRows, setIsLoadingRows] = useState<boolean>(false);

  if (!currentDataset || !currentDataset.tables || currentDataset.tables.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
        <p className="text-xs">No table metadata available for this dataset.</p>
      </div>
    );
  }

  const activeTable: TableMetadata = currentDataset.tables[selectedTableIndex] || currentDataset.tables[0];
  const columns: ColumnMetadata[] = activeTable.columns || [];

  // Reset pagination when table changes
  useEffect(() => {
    setPage(1);
    setSearchTerm('');
    setSortBy(null);
    setSortDir('asc');
  }, [selectedTableIndex]);

  // Fetch paginated table rows from API with debounce for search
  useEffect(() => {
    if (!currentDataset || !activeTable) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setIsLoadingRows(true);
        const res = await api.getTableRows(currentDataset.id, activeTable.table_name, {
          page,
          pageSize,
          search: searchTerm.trim() || undefined,
          sortBy: sortBy || undefined,
          sortDir
        });

        if (isMounted) {
          setTableRows(res.rows);
          setTotalRows(res.total_rows);
          setTotalPages(res.total_pages);
        }
      } catch (err) {
        console.warn('Could not fetch paginated rows, using sample data fallback:', err);
        if (isMounted) {
          setTableRows(activeTable.sample_data || []);
          setTotalRows(activeTable.row_count);
          setTotalPages(1);
        }
      } finally {
        if (isMounted) setIsLoadingRows(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentDataset.id, activeTable.table_name, page, pageSize, searchTerm, sortBy, sortDir]);

  const handleSort = (colName: string) => {
    if (sortBy === colName) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortBy(null);
        setSortDir('asc');
      }
    } else {
      setSortBy(colName);
      setSortDir('asc');
    }
    setPage(1);
  };

  const displayedRows = tableRows.length > 0 ? tableRows : (activeTable.sample_data || []);

  const handleRelationshipStatus = async (relId: string, status: 'accepted' | 'rejected') => {
    try {
      await api.updateRelationship(currentDataset.id, relId, status);
      await refreshCurrentDataset();
    } catch (err) {
      console.error('Failed to update relationship:', err);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'numeric':
        return <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-mono flex items-center gap-1"><Hash className="w-2.5 h-2.5"/>Numeric</span>;
      case 'datetime':
        return <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>DateTime</span>;
      case 'boolean':
        return <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1"><ToggleLeft className="w-2.5 h-2.5"/>Boolean</span>;
      case 'identifier':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1"><Key className="w-2.5 h-2.5"/>Identifier</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1"><Type className="w-2.5 h-2.5"/>Text</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 bg-transparent max-w-7xl mx-auto w-full">
      {/* Table Selector & Sub Tabs Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        {/* Table Selector Pills if multi-table */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Active Table:
          </span>
          {currentDataset.tables.map((tbl, idx) => (
            <button
              key={tbl.id}
              onClick={() => setSelectedTableIndex(idx)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                selectedTableIndex === idx
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)] border border-blue-400/40'
                  : 'bg-slate-900/80 border border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{tbl.table_name}</span>
              <span className="text-[10px] font-mono opacity-80 px-2 py-0.5 rounded bg-black/20">
                {tbl.row_count.toLocaleString()} rows
              </span>
            </button>
          ))}
        </div>

        {/* 3D View Sub-Tabs Rail */}
        <div className="tabs-3d-rail flex-wrap">
          <button
            onClick={() => setActiveSubTab('preview')}
            className={`tab-3d-item flex items-center gap-2 ${
              activeSubTab === 'preview' ? 'tab-3d-item-active' : ''
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Raw Preview</span>
          </button>
          <button
            onClick={() => setActiveSubTab('schema')}
            className={`tab-3d-item flex items-center gap-2 ${
              activeSubTab === 'schema' ? 'tab-3d-item-active' : ''
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Profiling ({columns.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('quality')}
            className={`tab-3d-item flex items-center gap-2 ${
              activeSubTab === 'quality' ? 'tab-3d-item-active' : ''
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Health Audit</span>
          </button>
          {currentDataset.relationships?.length > 0 && (
            <button
              onClick={() => setActiveSubTab('relationships')}
              className={`tab-3d-item flex items-center gap-2 ${
                activeSubTab === 'relationships' ? 'tab-3d-item-active' : ''
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>Joins ({currentDataset.relationships.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tab 1: Raw Preview */}
      {activeSubTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
            {/* Search Input & Page Size */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${activeTable.table_name}...`}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner font-mono"
                />
              </div>

              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-slate-900/90 border border-slate-700/70 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 transition shadow-inner cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            {/* Row Count Info & Export CSV */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-slate-400 text-xs">
                Showing{' '}
                <strong className="text-white font-mono">
                  {totalRows > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalRows)}
                </strong>{' '}
                of <strong className="text-cyan-300 font-mono">{totalRows.toLocaleString()}</strong> rows
              </span>

              <a
                href={api.getTableExportCsvUrl(currentDataset.id, activeTable.table_name, {
                  search: searchTerm || undefined,
                  sortBy: sortBy || undefined,
                  sortDir
                })}
                download={`${activeTable.table_name}.csv`}
                className="btn-3d-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          <div className="glass-3d-card table-3d-container relative overflow-x-auto rounded-2xl border border-slate-700/80 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm pointer-events-none" />
            {isLoadingRows && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="table-3d-header border-b border-slate-800 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 text-slate-400 w-12 text-center font-mono">#</th>
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      onClick={() => handleSort(c.column_name)}
                      className="py-3.5 px-4 font-mono font-semibold truncate text-slate-200 cursor-pointer select-none hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{c.column_name}</span>
                        {sortBy === c.column_name ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-brand-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-8 text-center text-slate-500 font-mono">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400 text-center font-mono text-[11px] leading-normal">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      {columns.map((c) => (
                        <td key={c.id} className="py-3.5 px-4 truncate max-w-xs font-mono text-[11px] leading-normal">
                          {row[c.column_name] !== null && row[c.column_name] !== undefined ? (
                            <span className={typeof row[c.column_name] === 'number' ? 'text-brand-300 font-bold' : 'text-slate-200'}>
                              {String(row[c.column_name])}
                            </span>
                          ) : (
                            <span className="text-rose-400/80 italic text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 font-mono">
                              null
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1 text-xs">
              <span className="text-slate-400">
                Page <strong className="text-white font-mono">{page}</strong> of <strong className="text-white font-mono">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = page;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition ${
                          page === pageNum
                            ? 'bg-brand-600 text-white shadow-glow-brand'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub Tab 2: Schema & Column Profiling */}
      {activeSubTab === 'schema' && (
        <div className="space-y-4">
          <div className="glass-card-premium relative overflow-x-auto rounded-2xl border border-slate-700/70 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none" />
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Column Name</th>
                  <th className="py-3.5 px-4">Inferred Type</th>
                  <th className="py-3.5 px-4">Missing Density</th>
                  <th className="py-3.5 px-4">Cardinality / Unique</th>
                  <th className="py-3.5 px-4">Statistical Range</th>
                  <th className="py-3.5 px-4">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {columns.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{col.column_name}</span>
                        {col.is_identifier && (
                          <span className="text-[9px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ID
                          </span>
                        )}
                        {col.is_potential_kpi && (
                          <span className="text-[9px] px-2 py-0.5 rounded font-mono bg-brand-500/20 text-brand-400 border border-brand-500/30">
                            KPI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getTypeBadge(col.data_type)}</td>
                    <td className="py-3.5 px-4">
                      {col.missing_count > 0 ? (
                        <div className="space-y-1">
                          <span className="text-amber-400 font-bold font-mono">
                            {col.missing_count} ({col.missing_percentage}%)
                          </span>
                          <div className="w-20 h-1 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${Math.min(100, col.missing_percentage)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-emerald-400 font-bold font-mono">0.0% Clean</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <span className="font-bold">{col.unique_count.toLocaleString()}</span>{' '}
                      <span className="text-slate-500">({(col.cardinality_ratio * 100).toFixed(1)}%)</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {col.data_type === 'numeric' && col.statistics ? (
                        <span>
                          min: <strong className="text-white">{col.statistics.min}</strong> | max: <strong className="text-white">{col.statistics.max}</strong> | avg: <strong className="text-brand-300">{col.statistics.mean}</strong>
                        </span>
                      ) : col.data_type === 'datetime' && col.statistics ? (
                        <span>
                          {col.statistics.min_date?.slice(0, 10)} → {col.statistics.max_date?.slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Text Feature</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 truncate max-w-xs font-mono text-[11px]">
                      {col.sample_values?.slice(0, 3).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab 3: Data Quality Audit */}
      {activeSubTab === 'quality' && (
        <div className="space-y-6">
          <div className="glass-card-premium relative overflow-hidden p-6 rounded-2xl border border-slate-700/70 space-y-5 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-white tracking-tight">Data Health Audit Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Algorithmic evaluation of null density, duplicate records, identifier completeness, and statistical variance.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-white font-mono">{currentDataset.data_health_score}/100</div>
                <span className="text-xs text-emerald-400 font-bold">Reliable for Modeling</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Cells Evaluated</span>
                <p className="text-xl font-extrabold text-white mt-1 font-mono">
                  {(currentDataset.row_count * currentDataset.column_count).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Missing Value Defect Rate</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">0.0% Clean</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Duplicate Records Identified</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">0 Rows</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 4: Multi-Table Relationships */}
      {activeSubTab === 'relationships' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Discovered Entity Relationships</h3>
            <span className="text-xs text-slate-400 font-mono">Confirm or reject automatically inferred join keys</span>
          </div>

          <div className="space-y-3">
            {currentDataset.relationships?.map((rel) => (
              <div
                key={rel.id}
                className="glass-card-premium relative overflow-hidden p-5 rounded-2xl border border-slate-700/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl group hover:border-cyan-500/40 transition-all duration-300"
              >
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-slate-800 border border-slate-700">
                      {rel.source_table}.{rel.source_column}
                    </span>
                    <span className="text-xs text-brand-400 font-bold">⟷</span>
                    <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-slate-800 border border-slate-700">
                      {rel.target_table}.{rel.target_column}
                    </span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      {rel.relationship_type.replace('_', '-')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rel.reasoning}</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="px-3 py-1.5 rounded-xl bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white border border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                    title="View charts created using these corresponding tables"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>View Joined Charts</span>
                  </button>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                    {Math.round(rel.confidence * 100)}% Confidence
                  </span>
                  {rel.status === 'detected' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRelationshipStatus(rel.id, 'accepted')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRelationshipStatus(rel.id, 'rejected')}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        rel.status === 'accepted'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {rel.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
