import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Network,
  Database,
  Key,
  Link2,
  Sparkles,
  Info,
  HelpCircle,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Play,
  Table,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Maximize2,
  Minimize2,
  Move,
  Hash,
  Type,
  Calendar,
  Eye,
  RefreshCw,
  Share2,
  ExternalLink
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import {
  EerTableNode,
  EerRelationshipEdge,
  EerSchemaGraph,
  EerSimulationResult
} from '../../types';

interface TablePosition {
  x: number;
  y: number;
}

export const EerModelStudioView: React.FC = () => {
  const { currentDataset } = useWorkspace();

  // Scope: 'current' (current active dataset) vs 'all' (enterprise multi-dataset graph)
  const [scope, setScope] = useState<'current' | 'all'>('current');

  // Schema graph state
  const [graphData, setGraphData] = useState<EerSchemaGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table positions for canvas layout (keyed by table_name)
  const [positions, setPositions] = useState<Record<string, TablePosition>>({});

  // Canvas zoom & pan
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging state for tables
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; tableX: number; tableY: number }>({
    mouseX: 0,
    mouseY: 0,
    tableX: 0,
    tableY: 0
  });

  // Selected relationship for inspection
  const [selectedRel, setSelectedRel] = useState<EerRelationshipEdge | null>(null);

  // Selected table for highlight
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<EerSimulationResult | null>(null);
  const [simStrategy, setSimStrategy] = useState<'left' | 'inner' | 'full'>('left');
  const [simDrawerOpen, setSimDrawerOpen] = useState<boolean>(false);

  // Custom Relationship Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createSrcTable, setCreateSrcTable] = useState<string>('');
  const [createSrcCol, setCreateSrcCol] = useState<string>('');
  const [createTgtTable, setCreateTgtTable] = useState<string>('');
  const [createTgtCol, setCreateTgtCol] = useState<string>('');
  const [createCard, setCreateCard] = useState<string>('many_to_one');
  const [isCreatingRel, setIsCreatingRel] = useState<boolean>(false);

  // Canvas element reference
  const canvasRef = useRef<HTMLDivElement>(null);

  // 1. Fetch schema graph
  const loadGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const dsParam = scope === 'current' && currentDataset ? currentDataset.id : undefined;
      const res = await api.getModelSchemaGraph(dsParam);
      setGraphData(res);

      // Initialize table positions in a neat grid / DAG layout
      const initPositions: Record<string, TablePosition> = {};
      const colsPerRow = 3;
      const cardWidth = 320;
      const cardHeight = 360;
      const gapX = 80;
      const gapY = 60;

      res.tables.forEach((tbl, idx) => {
        const col = idx % colsPerRow;
        const row = Math.floor(idx / colsPerRow);
        initPositions[tbl.table_name] = {
          x: 40 + col * (cardWidth + gapX),
          y: 40 + row * (cardHeight + gapY)
        };
      });

      setPositions(initPositions);

      // Auto-select first relationship if available
      if (res.relationships.length > 0) {
        setSelectedRel(res.relationships[0]);
      } else {
        setSelectedRel(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load E-ER schema graph');
    } finally {
      setIsLoading(false);
    }
  }, [scope, currentDataset]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // 2. Auto-Arrange Layout (Clean Power BI / MySQL DAG algorithm)
  const handleAutoArrange = () => {
    if (!graphData) return;
    const newPos: Record<string, TablePosition> = {};
    const colsPerRow = Math.max(2, Math.ceil(Math.sqrt(graphData.tables.length)));
    const cardWidth = 320;
    const cardHeight = 380;
    const gapX = 90;
    const gapY = 70;

    graphData.tables.forEach((tbl, idx) => {
      const col = idx % colsPerRow;
      const row = Math.floor(idx / colsPerRow);
      newPos[tbl.table_name] = {
        x: 40 + col * (cardWidth + gapX),
        y: 40 + row * (cardHeight + gapY)
      };
    });

    setPositions(newPos);
    setPan({ x: 20, y: 20 });
    setZoom(0.85);
  };

  // 3. Mouse Pan Controls
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background directly
    if ((e.target as HTMLElement).id === 'canvas-board' || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    } else if (draggingTable) {
      const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
      setPositions((prev) => ({
        ...prev,
        [draggingTable]: {
          x: Math.max(0, dragStartRef.current.tableX + dx),
          y: Math.max(0, dragStartRef.current.tableY + dy)
        }
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingTable(null);
  };

  // Wheel Pan / Zoom (Trackpad support)
  const handleWheelCanvas = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zooming via trackpad pinch
      const zoomSensitivity = 0.005;
      const newZoom = Math.max(0.4, Math.min(2.0, zoom - e.deltaY * zoomSensitivity));
      setZoom(newZoom);
    } else {
      // Panning via two-finger scroll
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Touch support for tablets/touch-laptops
  const handleTouchStartCanvas = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).id === 'canvas-board' || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    }
  };

  const handleTouchMoveCanvas = (e: React.TouchEvent) => {
    if (isPanning) {
      setPan({
        x: e.touches[0].clientX - panStartRef.current.x,
        y: e.touches[0].clientY - panStartRef.current.y
      });
    } else if (draggingTable) {
      const dx = (e.touches[0].clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (e.touches[0].clientY - dragStartRef.current.mouseY) / zoom;
      setPositions((prev) => ({
        ...prev,
        [draggingTable]: {
          x: Math.max(0, dragStartRef.current.tableX + dx),
          y: Math.max(0, dragStartRef.current.tableY + dy)
        }
      }));
    }
  };

  const handleTouchEndCanvas = () => {
    setIsPanning(false);
    setDraggingTable(null);
  };

  // Drag Table Card
  const handleStartDragTable = (tableName: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const curPos = positions[tableName] || { x: 0, y: 0 };
    setDraggingTable(tableName);
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      tableX: curPos.x,
      tableY: curPos.y
    };
  };

  // 4. Run Live Simulation ("What happens when applied to the dataset?")
  const runSimulation = async (rel: EerRelationshipEdge, strategy = simStrategy) => {
    if (!graphData) return;
    try {
      setIsSimulating(true);
      const srcTbl = graphData.tables.find((t) => t.table_name === rel.source_table);
      const tgtTbl = graphData.tables.find((t) => t.table_name === rel.target_table);

      if (!srcTbl || !tgtTbl) {
        throw new Error('Source or target table metadata missing');
      }

      const res = await api.simulateRelationship({
        source_dataset_id: srcTbl.dataset_id,
        source_table: rel.source_table,
        source_column: rel.source_column,
        target_dataset_id: tgtTbl.dataset_id,
        target_table: rel.target_table,
        target_column: rel.target_column,
        relationship_type: rel.relationship_type,
        join_strategy: strategy
      });

      setSimResult(res);
      setSimDrawerOpen(true);
    } catch (err: any) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered tables based on search
  const filteredTables = useMemo(() => {
    if (!graphData) return [];
    if (!searchQuery.trim()) return graphData.tables;
    const q = searchQuery.toLowerCase();
    return graphData.tables.filter(
      (t) =>
        t.table_name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.column_name.toLowerCase().includes(q))
    );
  }, [graphData, searchQuery]);

  // Create Manual Relationship
  const handleCreateRelationship = async () => {
    if (!currentDataset || !createSrcTable || !createSrcCol || !createTgtTable || !createTgtCol) return;
    try {
      setIsCreatingRel(true);
      await api.createRelationship({
        dataset_id: currentDataset.id,
        source_table: createSrcTable,
        source_column: createSrcCol,
        target_table: createTgtTable,
        target_column: createTgtCol,
        relationship_type: createCard,
        reasoning: `User-defined ${createCard.replace('_', '-')} relationship`
      });
      setIsCreateModalOpen(false);
      loadGraph();
    } catch (err: any) {
      alert(err.message || 'Failed to create relationship');
    } finally {
      setIsCreatingRel(false);
    }
  };

  // Helper for column icon
  const getColIcon = (col: any) => {
    if (col.is_primary_key) return <Key className="w-3.5 h-3.5 text-amber-400" />;
    if (col.is_foreign_key) return <Link2 className="w-3.5 h-3.5 text-purple-400" />;
    if (col.data_type === 'numeric') return <Hash className="w-3.5 h-3.5 text-cyan-400" />;
    if (col.data_type === 'datetime') return <Calendar className="w-3.5 h-3.5 text-emerald-400" />;
    return <Type className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#060D1E] select-none pb-20 md:pb-28">
      {/* 1. Header Command Bar */}
      <div className="h-auto py-3 px-3.5 sm:px-6 border-b border-slate-800 bg-[#071126]/90 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-cyan-400/40">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white font-sans">
                Enterprise E-ER Diagram & Relational Model
              </h1>
              <span className="badge-neon-purple text-[9px] font-mono uppercase px-2 py-0.5 rounded font-extrabold">
                MODEL VIEW
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Power BI & MySQL Workbench Schema Designer • Inspect Cardinalities (1:1, 1:M, M:1, M:M)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Scope Selector: Current vs All */}
          <div className="flex items-center bg-[#091633] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setScope('current')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                scope === 'current'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Current Dataset ({graphData?.total_tables ?? 0})
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                scope === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Enterprise Multi-Dataset Graph
            </button>
          </div>

          {/* Search Box */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or column..."
              className="bg-[#091633] border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 w-44 font-mono transition"
            />
          </div>

          {/* Zoom / Layout Controls */}
          <div className="flex items-center bg-[#091633] rounded-xl border border-slate-800 p-1 text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAutoArrange}
              className="p-1.5 hover:bg-slate-800 rounded-lg ml-1 text-cyan-400 transition"
              title="Auto-Arrange Layout"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Relationship Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(147,51,234,0.4)] border border-purple-400/40 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Tables</span>
          </button>
        </div>
      </div>

      {/* 2. Main E-ER Workspace Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Board (Drag & Pan Area) */}
        <div
          id="canvas-board"
          ref={canvasRef}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          onMouseLeave={handleMouseUpCanvas}
          onWheel={handleWheelCanvas}
          onTouchStart={handleTouchStartCanvas}
          onTouchMove={handleTouchMoveCanvas}
          onTouchEnd={handleTouchEndCanvas}
          onTouchCancel={handleTouchEndCanvas}
          className="flex-1 relative overflow-hidden bg-[#050B18] cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: `radial-gradient(#1E293B 1px, transparent 1px)`,
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`
          }}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-30">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Loading E-ER schema entities and foreign keys...</p>
            </div>
          ) : !graphData || graphData.tables.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 p-8 text-center">
              <Database className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Relational Tables Found</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Upload or select a dataset containing tables to view its interactive E-ER schema diagram.
              </p>
            </div>
          ) : (
            <div
              className="absolute inset-0 origin-top-left transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
              }}
            >
              {/* SVG Relationships Layer (Power BI / MySQL style connector wires) */}
              <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>

                {graphData.relationships.map((rel) => {
                  const srcPos = positions[rel.source_table];
                  const tgtPos = positions[rel.target_table];
                  if (!srcPos || !tgtPos) return null;

                  const isSelected = selectedRel?.id === rel.id;

                  // Find column offsets inside cards
                  const cardWidth = 300;
                  const headerHeight = 70;
                  const rowHeight = 28;

                  const srcTblObj = graphData.tables.find((t) => t.table_name === rel.source_table);
                  const tgtTblObj = graphData.tables.find((t) => t.table_name === rel.target_table);

                  const srcColIdx = srcTblObj?.columns.findIndex((c) => c.column_name === rel.source_column) ?? 0;
                  const tgtColIdx = tgtTblObj?.columns.findIndex((c) => c.column_name === rel.target_column) ?? 0;

                  // Determine source and target connector anchor points
                  const isLeftToRight = srcPos.x < tgtPos.x;
                  const x1 = isLeftToRight ? srcPos.x + cardWidth : srcPos.x;
                  const y1 = srcPos.y + headerHeight + srcColIdx * rowHeight + 14;

                  const x2 = isLeftToRight ? tgtPos.x : tgtPos.x + cardWidth;
                  const y2 = tgtPos.y + headerHeight + tgtColIdx * rowHeight + 14;

                  // Bézier curve control points
                  const deltaX = Math.abs(x2 - x1) * 0.55;
                  const cx1 = isLeftToRight ? x1 + deltaX : x1 - deltaX;
                  const cx2 = isLeftToRight ? x2 - deltaX : x2 + deltaX;

                  const pathData = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;

                  // Colors by cardinality
                  let strokeColor = '#6366F1'; // Indigo for 1:M
                  if (rel.cardinality_label === '1:1') strokeColor = '#06B6D4'; // Cyan
                  if (rel.cardinality_label === 'M:M') strokeColor = '#EC4899'; // Pink

                  return (
                    <g key={rel.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedRel(rel)}>
                      {/* Invisible wider hit area for easy clicking */}
                      <path d={pathData} fill="none" stroke="transparent" strokeWidth="18" />

                      {/* Ambient Glow path when selected */}
                      {isSelected && (
                        <path
                          d={pathData}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="6"
                          opacity="0.5"
                          filter="url(#glow)"
                        />
                      )}

                      {/* Primary Wire */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isSelected ? '3' : '2'}
                        strokeDasharray={rel.status === 'detected' ? 'none' : '4 2'}
                        className="transition-all"
                      />

                      {/* Source Terminal Anchor (1 or Many) */}
                      <circle cx={x1} cy={y1} r="4" fill={strokeColor} />
                      {/* Target Terminal Anchor */}
                      <circle cx={x2} cy={y2} r="4" fill={strokeColor} />

                      {/* Interactive Center Cardinality Badge */}
                      <foreignObject x={midX - 24} y={midY - 14} width="48" height="28">
                        <div
                          className={`w-full h-full rounded-lg flex items-center justify-center text-[10px] font-black font-mono shadow-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)] scale-110'
                              : 'bg-[#0B1528] text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {rel.cardinality_label}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* Table Schema Cards Layer */}
              {filteredTables.map((tbl) => {
                const pos = positions[tbl.table_name] || { x: 40, y: 40 };
                const isSelected = selectedTable === tbl.table_name;
                const isRelSource = selectedRel?.source_table === tbl.table_name;
                const isRelTarget = selectedRel?.target_table === tbl.table_name;

                return (
                  <div
                    key={tbl.table_name}
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px)`,
                      width: '300px'
                    }}
                    onClick={() => setSelectedTable(tbl.table_name)}
                    className={`absolute rounded-2xl overflow-hidden glass-3d-card border transition-shadow select-none shadow-2xl ${
                      isSelected || isRelSource || isRelTarget
                        ? 'border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Draggable Card Header */}
                    <div
                      onMouseDown={(e) => handleStartDragTable(tbl.table_name, e)}
                      onTouchStart={(e) => handleStartDragTable(tbl.table_name, e)}
                      className={`px-4 py-3 cursor-move border-b flex items-center justify-between transition ${
                        isRelSource
                          ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-500/40'
                          : isRelTarget
                          ? 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border-purple-500/40'
                          : 'bg-[#0A1633] border-slate-800 hover:bg-[#0E1E42]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="font-bold text-xs text-white truncate font-mono">{tbl.table_name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                        {tbl.row_count.toLocaleString()} rows
                      </span>
                    </div>

                    {/* Columns List (Schema Attributes) */}
                    <div className="max-h-72 overflow-y-auto bg-[#070F22]/90 divide-y divide-slate-900/60">
                      {tbl.columns.map((col) => {
                        const isConnectedSource =
                          selectedRel?.source_table === tbl.table_name && selectedRel?.source_column === col.column_name;
                        const isConnectedTarget =
                          selectedRel?.target_table === tbl.table_name && selectedRel?.target_column === col.column_name;
                        const isConnectedKey = isConnectedSource || isConnectedTarget;

                        return (
                          <div
                            key={col.column_name}
                            className={`px-3.5 py-1.5 flex items-center justify-between text-xs transition ${
                              isConnectedKey
                                ? 'bg-indigo-500/25 text-cyan-200 font-semibold'
                                : 'hover:bg-slate-800/40 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {getColIcon(col)}
                              <span className="truncate font-mono text-[11px]">{col.column_name}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {col.is_primary_key && (
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">
                                  PK
                                </span>
                              )}
                              {col.is_foreign_key && (
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-purple-500/20 text-purple-300 rounded font-bold">
                                  FK
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-500">{col.data_type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Domain & Column count */}
                    <div className="px-3.5 py-2 bg-[#050C1B] border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Domain: {tbl.detected_domain}</span>
                      <span>{tbl.columns.length} columns</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Right Inspection HUD & Cardinality Explainer Drawer */}
        <div className="w-96 border-l border-slate-800 bg-[#071126]/95 backdrop-blur-2xl flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-2xl p-5 space-y-5">
          {selectedRel ? (
            <>
              {/* Relationship Header */}
              <div className="space-y-2 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="badge-neon-purple text-[10px] font-mono uppercase px-2 py-0.5 rounded font-extrabold">
                    Cardinality Inspection
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                    {selectedRel.cardinality_label}
                  </span>
                </div>

                <div className="text-sm font-bold text-white flex items-center gap-2 truncate">
                  <span className="text-cyan-400 truncate">{selectedRel.source_table}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-purple-400 truncate">{selectedRel.target_table}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0B1733] border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>Key: <strong className="text-cyan-300">{selectedRel.source_column}</strong></span>
                  <span className="text-slate-500">=</span>
                  <span>Key: <strong className="text-purple-300">{selectedRel.target_column}</strong></span>
                </div>
              </div>

              {/* Educational Cardinality Breakdown HUD */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  What is a {selectedRel.cardinality_label} Relationship?
                </h4>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  {selectedRel.cardinality_label === '1:1' && (
                    <>
                      <div className="text-cyan-300 font-bold">One-to-One (1:1) Parity</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Each entity in Table A maps to exactly one record in Table B. Merging these tables augments
                        attributes horizontally with <strong>zero row duplication</strong>.
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono">Example: User ↔ User Profile</div>
                    </>
                  )}

                  {selectedRel.cardinality_label === '1:M' && (
                    <>
                      <div className="text-emerald-300 font-bold">One-to-Many (1:M) Master-Detail</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        A single parent row replicates for each matching child transaction. Parent attributes are preserved
                        alongside each detail record.
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono">Example: Customer ↔ Orders</div>
                    </>
                  )}

                  {selectedRel.cardinality_label === 'M:1' && (
                    <>
                      <div className="text-indigo-300 font-bold">Many-to-One (M:1) Lookup Dimension</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Multiple transaction rows reference a single lookup dimension. The base grain of Table A is
                        preserved with enriched dimension attributes.
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono">Example: Order Lines ↔ Product Catalog</div>
                    </>
                  )}

                  {selectedRel.cardinality_label === 'M:M' && (
                    <>
                      <div className="text-pink-300 font-bold">Many-to-Many (M:M) Cross-Link</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Entities on both sides can have multiple matches. Direct joins risk <strong>Cartesian explosion</strong>.
                        Decomposed via bridge junction tables in enterprise models.
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono">Example: Students ↔ Courses</div>
                    </>
                  )}
                </div>

                {selectedRel.reasoning && (
                  <p className="text-[11px] text-slate-400 italic bg-[#081226] p-2.5 rounded-xl border border-slate-800">
                    "{selectedRel.reasoning}"
                  </p>
                )}
              </div>

              {/* Action Trigger: "If Applied, What Will the Dataset Look Like?" */}
              <div className="pt-2">
                <button
                  onClick={() => runSimulation(selectedRel)}
                  disabled={isSimulating}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/50 transition flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSimulating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Simulating Unified Dataset...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>Simulate & Preview Applied Dataset</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Link2 className="w-10 h-10 text-slate-600" />
              <h4 className="text-sm font-bold text-white">Select a Relationship</h4>
              <p className="text-xs text-slate-400">
                Click any relationship line or cardinality badge on the canvas to inspect its relational algebra, foreign
                key integrity, and live applied simulation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. "If Applied, What Will the Dataset Look Like?" Live Simulation Drawer */}
      {simDrawerOpen && simResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 z-50">
          <div className="glass-3d-card w-full max-w-5xl max-h-[88vh] rounded-t-3xl md:rounded-3xl border border-cyan-500/40 flex flex-col overflow-hidden shadow-[0_0_60px_rgba(6,182,212,0.25)]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-[#071126] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Table className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Applied Relationship Simulation: {simResult.summary.source_table} ⟕ {simResult.summary.target_table}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Cardinality: {simResult.summary.cardinality_name} • Key: {simResult.summary.source_column} = {simResult.summary.target_column}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSimDrawerOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Simulation Telemetry Banner */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono">Source Grain</div>
                  <div className="text-lg font-black font-mono text-white">
                    {simResult.summary.source_rows.toLocaleString()} rows
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono truncate">{simResult.summary.source_table}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono">Unified Output Grain</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {simResult.summary.unified_rows.toLocaleString()} rows
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Factor: {simResult.summary.row_multiplication_factor}x
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono">Synthesized Columns</div>
                  <div className="text-lg font-black font-mono text-purple-400">
                    {simResult.summary.unified_columns} attributes
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Lineage preserved</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono">Key Overlap Match</div>
                  <div className="text-lg font-black font-mono text-cyan-300">
                    {simResult.summary.match_rate_pct}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Orphans: {simResult.summary.orphan_source_count}
                  </div>
                </div>
              </div>

              {/* What Happens When Applied Narrative */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-1.5">
                <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  What happens when this {simResult.summary.cardinality_name} relationship is applied?
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {simResult.summary.what_happens}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {simResult.summary.business_example}
                </p>
              </div>

              {/* Column Lineage Tags */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                  Synthesized Schema Lineage
                </div>
                <div className="flex flex-wrap gap-2">
                  {simResult.columns.map((col) => {
                    const isSrc = col.source_table === simResult.summary.source_table;
                    return (
                      <span
                        key={col.column_name}
                        className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border ${
                          col.is_key
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                            : isSrc
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            col.is_key ? 'bg-amber-400' : isSrc ? 'bg-cyan-400' : 'bg-purple-400'
                          }`}
                        />
                        {col.column_name}
                        <span className="text-[9px] text-slate-500">({col.source_table})</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Data Grid */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                  Live Applied Data Preview ({simResult.sample_rows.length} sample rows)
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#060D1E] max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#09152E] z-10 border-b border-slate-800 font-mono">
                      <tr>
                        {simResult.columns.map((col) => (
                          <th key={col.column_name} className="p-2.5 text-slate-300 whitespace-nowrap text-xs">
                            <span className="font-bold">{col.column_name}</span>
                            <span className="text-[10px] text-slate-500 block">{col.source_table}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {simResult.sample_rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/40 transition">
                          {simResult.columns.map((col) => {
                            const val = row[col.column_name];
                            return (
                              <td key={col.column_name} className="p-2.5 whitespace-nowrap text-slate-300">
                                {val === null || val === undefined ? (
                                  <span className="text-slate-600 italic">NULL</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Custom Relationship Modal */}
      {isCreateModalOpen && graphData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-3d-card w-full max-w-lg p-6 rounded-2xl border border-purple-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-purple-400" />
                Connect Relational Tables
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Source Table & Column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Source Table (PK)</label>
                  <select
                    value={createSrcTable}
                    onChange={(e) => {
                      setCreateSrcTable(e.target.value);
                      const t = graphData.tables.find((tbl) => tbl.table_name === e.target.value);
                      if (t && t.columns.length > 0) setCreateSrcCol(t.columns[0].column_name);
                    }}
                    className="w-full bg-[#081226] border border-slate-700 text-white text-xs rounded-xl p-2.5"
                  >
                    <option value="">Select table...</option>
                    {graphData.tables.map((t) => (
                      <option key={t.table_name} value={t.table_name}>
                        {t.table_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Source Column</label>
                  <select
                    value={createSrcCol}
                    onChange={(e) => setCreateSrcCol(e.target.value)}
                    className="w-full bg-[#081226] border border-slate-700 text-white text-xs rounded-xl p-2.5"
                  >
                    {graphData.tables
                      .find((t) => t.table_name === createSrcTable)
                      ?.columns.map((c) => (
                        <option key={c.column_name} value={c.column_name}>
                          {c.column_name} ({c.data_type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Target Table & Column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Table (FK)</label>
                  <select
                    value={createTgtTable}
                    onChange={(e) => {
                      setCreateTgtTable(e.target.value);
                      const t = graphData.tables.find((tbl) => tbl.table_name === e.target.value);
                      if (t && t.columns.length > 0) setCreateTgtCol(t.columns[0].column_name);
                    }}
                    className="w-full bg-[#081226] border border-slate-700 text-white text-xs rounded-xl p-2.5"
                  >
                    <option value="">Select table...</option>
                    {graphData.tables.map((t) => (
                      <option key={t.table_name} value={t.table_name}>
                        {t.table_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Column</label>
                  <select
                    value={createTgtCol}
                    onChange={(e) => setCreateTgtCol(e.target.value)}
                    className="w-full bg-[#081226] border border-slate-700 text-white text-xs rounded-xl p-2.5"
                  >
                    {graphData.tables
                      .find((t) => t.table_name === createTgtTable)
                      ?.columns.map((c) => (
                        <option key={c.column_name} value={c.column_name}>
                          {c.column_name} ({c.data_type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Cardinality Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Cardinality Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'one_to_one', label: '1:1' },
                    { id: 'one_to_many', label: '1:M' },
                    { id: 'many_to_one', label: 'M:1' },
                    { id: 'many_to_many', label: 'M:M' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setCreateCard(btn.id)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                        createCard === btn.id
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRelationship}
                disabled={isCreatingRel || !createSrcTable || !createTgtTable}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCreatingRel ? 'Saving...' : 'Save Relationship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
