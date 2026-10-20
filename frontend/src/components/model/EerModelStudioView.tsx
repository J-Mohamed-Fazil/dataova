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
  ExternalLink,
  Download,
  Compass,
  Focus,
  Copy,
  Check,
  Filter,
  ChevronDown,
  ChevronUp,
  Grid,
  Cpu,
  CircleDot,
  Zap,
  Boxes,
  FileCode,
  CornerDownRight,
  Minus,
  Spline
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

type GridStyle = 'blueprint' | 'dots' | 'matrix' | 'minimal';
type NotationMode = 'neon' | 'crowsfoot';
type ColumnDisplayMode = 'all' | 'keys_only';
type JoinType = 'inner' | 'left' | 'right' | 'full';
type LineRouting = 'orthogonal' | 'straight' | 'smooth';

interface ConnectorPathResult {
  pathData: string;
  badgeX: number;
  badgeY: number;
}

// Neat & Professional CAD / ERD Line Routing
function getConnectorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  isTargetToRight: boolean,
  isTargetToLeft: boolean,
  mode: LineRouting
): ConnectorPathResult {
  // 1. Direct Straight Line
  if (mode === 'straight') {
    return {
      pathData: `M ${x1} ${y1} L ${x2} ${y2}`,
      badgeX: (x1 + x2) / 2,
      badgeY: (y1 + y2) / 2
    };
  }

  // 2. Smooth Gentle Curve
  if (mode === 'smooth') {
    const dx = Math.abs(x2 - x1);
    const curveOffset = Math.max(50, Math.min(160, dx * 0.45));
    const cx1 = isTargetToRight ? x1 + curveOffset : x1 - curveOffset;
    const cx2 = isTargetToRight ? x2 - curveOffset : x2 + curveOffset;
    return {
      pathData: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
      badgeX: (x1 + x2) / 2,
      badgeY: (y1 + y2) / 2
    };
  }

  // 3. Orthogonal Stepped Line (Professional CAD / ERD 90-degree lines)
  const dy = y2 - y1;
  const isDirectHorizontal = Math.abs(dy) < 4;

  if (isDirectHorizontal) {
    return {
      pathData: `M ${x1} ${y1} L ${x2} ${y2}`,
      badgeX: (x1 + x2) / 2,
      badgeY: y1
    };
  }

  const radius = 6;

  if (isTargetToRight) {
    // Source exits right from x1, target enters left at x2
    const midX = x1 + (x2 - x1) * 0.5;
    const isDown = dy > 0;
    const r = Math.min(radius, Math.abs(midX - x1) * 0.5, Math.abs(dy) * 0.5);

    const pathData = isDown
      ? `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1}, ${midX} ${y1 + r} L ${midX} ${y2 - r} Q ${midX} ${y2}, ${midX + r} ${y2} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1}, ${midX} ${y1 - r} L ${midX} ${y2 + r} Q ${midX} ${y2}, ${midX + r} ${y2} L ${x2} ${y2}`;

    return {
      pathData,
      badgeX: midX,
      badgeY: (y1 + y2) / 2
    };
  } else if (isTargetToLeft) {
    // Source exits left from x1, target enters right at x2
    const midX = x1 + (x2 - x1) * 0.5;
    const isDown = dy > 0;
    const r = Math.min(radius, Math.abs(x1 - midX) * 0.5, Math.abs(dy) * 0.5);

    const pathData = isDown
      ? `M ${x1} ${y1} L ${midX + r} ${y1} Q ${midX} ${y1}, ${midX} ${y1 + r} L ${midX} ${y2 - r} Q ${midX} ${y2}, ${midX - r} ${y2} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${midX + r} ${y1} Q ${midX} ${y1}, ${midX} ${y1 - r} L ${midX} ${y2 + r} Q ${midX} ${y2}, ${midX - r} ${y2} L ${x2} ${y2}`;

    return {
      pathData,
      badgeX: midX,
      badgeY: (y1 + y2) / 2
    };
  } else {
    // Overlapping or vertically stacked
    const stub = 32;
    const exitX = x1 > x2 ? x1 + stub : x1 - stub;
    const isDown = dy > 0;
    const r = Math.min(radius, stub * 0.5, Math.abs(dy) * 0.5);
    const isExitRight = exitX > x1;

    let pathData = '';
    if (isExitRight) {
      pathData = isDown
        ? `M ${x1} ${y1} L ${exitX - r} ${y1} Q ${exitX} ${y1}, ${exitX} ${y1 + r} L ${exitX} ${y2 - r} Q ${exitX} ${y2}, ${exitX - r} ${y2} L ${x2} ${y2}`
        : `M ${x1} ${y1} L ${exitX - r} ${y1} Q ${exitX} ${y1}, ${exitX} ${y1 - r} L ${exitX} ${y2 + r} Q ${exitX} ${y2}, ${exitX - r} ${y2} L ${x2} ${y2}`;
    } else {
      pathData = isDown
        ? `M ${x1} ${y1} L ${exitX + r} ${y1} Q ${exitX} ${y1}, ${exitX} ${y1 + r} L ${exitX} ${y2 - r} Q ${exitX} ${y2}, ${exitX + r} ${y2} L ${x2} ${y2}`
        : `M ${x1} ${y1} L ${exitX + r} ${y1} Q ${exitX} ${y1}, ${exitX} ${y1 - r} L ${exitX} ${y2 + r} Q ${exitX} ${y2}, ${exitX + r} ${y2} L ${x2} ${y2}`;
    }

    return {
      pathData,
      badgeX: exitX,
      badgeY: (y1 + y2) / 2
    };
  }
}

export const EerModelStudioView: React.FC = () => {
  const { currentDataset } = useWorkspace();

  // Schema graph state
  const [graphData, setGraphData] = useState<EerSchemaGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table positions for canvas layout (keyed by table_name)
  const [positions, setPositions] = useState<Record<string, TablePosition>>({});

  // Canvas zoom & pan
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
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

  // Selected & Hovered elements
  const [selectedRel, setSelectedRel] = useState<EerRelationshipEdge | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<EerRelationshipEdge | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  // Graphic Customization States
  const [lineRouting, setLineRouting] = useState<LineRouting>('orthogonal');
  const [isFlowAnimationActive, setIsFlowAnimationActive] = useState<boolean>(true);
  const [gridStyle, setGridStyle] = useState<GridStyle>('blueprint');
  const [notationMode, setNotationMode] = useState<NotationMode>('neon');
  const [columnDisplayMode, setColumnDisplayMode] = useState<ColumnDisplayMode>('all');
  const [isolateFocusMode, setIsolateFocusMode] = useState<boolean>(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState<boolean>(true);

  // Per-card column search & collapse state
  const [cardColumnFilter, setCardColumnFilter] = useState<Record<string, string>>({});
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  // Join Venn Diagram Visualizer state
  const [activeVennJoin, setActiveVennJoin] = useState<JoinType>('left');

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

  // 1. Fetch schema graph for the current active dataset
  const loadGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const dsParam = currentDataset ? currentDataset.id : undefined;
      const res = await api.getModelSchemaGraph(dsParam);
      setGraphData(res);

      // Initialize table positions in a neat grid / DAG layout
      const initPositions: Record<string, TablePosition> = {};
      const colsPerRow = Math.max(2, Math.ceil(Math.sqrt(res.tables.length)));
      const cardWidth = 320;
      const cardHeight = 360;
      const gapX = 100;
      const gapY = 80;

      res.tables.forEach((tbl, idx) => {
        const col = idx % colsPerRow;
        const row = Math.floor(idx / colsPerRow);
        initPositions[tbl.table_name] = {
          x: 60 + col * (cardWidth + gapX),
          y: 60 + row * (cardHeight + gapY)
        };
      });

      setPositions(initPositions);

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
  }, [currentDataset]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // 2. Smart Layout Algorithms
  // A. Star Schema Layout (Center Fact table, Radially arrange Dimensions)
  const handleStarSchemaLayout = () => {
    if (!graphData || graphData.tables.length === 0) return;

    // Count degrees (connections) per table
    const degreeMap: Record<string, number> = {};
    graphData.tables.forEach((t) => (degreeMap[t.table_name] = 0));
    graphData.relationships.forEach((r) => {
      degreeMap[r.source_table] = (degreeMap[r.source_table] || 0) + 1;
      degreeMap[r.target_table] = (degreeMap[r.target_table] || 0) + 1;
    });

    // Find hub table with highest connections
    const sortedTables = [...graphData.tables].sort(
      (a, b) => (degreeMap[b.table_name] || 0) - (degreeMap[a.table_name] || 0)
    );

    const hub = sortedTables[0];
    const satellites = sortedTables.slice(1);

    const centerX = 650;
    const centerY = 450;
    const radiusX = Math.max(480, satellites.length * 75);
    const radiusY = Math.max(380, satellites.length * 60);

    const newPos: Record<string, TablePosition> = {
      [hub.table_name]: { x: centerX - 160, y: centerY - 150 }
    };

    satellites.forEach((tbl, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, satellites.length);
      newPos[tbl.table_name] = {
        x: Math.round(centerX + radiusX * Math.cos(angle) - 160),
        y: Math.round(centerY + radiusY * Math.sin(angle) - 140)
      };
    });

    setPositions(newPos);
    setPan({ x: 30, y: 30 });
    setZoom(0.8);
  };

  // B. Hierarchical DAG Flow Layout (Sources on left -> Reports on right)
  const handleDagFlowLayout = () => {
    if (!graphData || graphData.tables.length === 0) return;

    // In-degree & out-degree
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    graphData.tables.forEach((t) => {
      inDegree[t.table_name] = 0;
      outDegree[t.table_name] = 0;
    });

    graphData.relationships.forEach((r) => {
      outDegree[r.source_table] = (outDegree[r.source_table] || 0) + 1;
      inDegree[r.target_table] = (inDegree[r.target_table] || 0) + 1;
    });

    // Tier 0: Dimensions (high in-degree or zero outgoing)
    // Tier 1: Bridge / Intermediate
    // Tier 2: Facts / Transactions
    const tier0: EerTableNode[] = [];
    const tier1: EerTableNode[] = [];
    const tier2: EerTableNode[] = [];

    graphData.tables.forEach((t) => {
      const outD = outDegree[t.table_name] || 0;
      const inD = inDegree[t.table_name] || 0;
      if (outD > 0 && inD === 0) {
        tier0.push(t);
      } else if (outD > 0 && inD > 0) {
        tier1.push(t);
      } else {
        tier2.push(t);
      }
    });

    const newPos: Record<string, TablePosition> = {};
    const columnSpacing = 440;
    const rowSpacing = 400;

    const arrangeTier = (items: EerTableNode[], tierIndex: number) => {
      items.forEach((tbl, rIdx) => {
        newPos[tbl.table_name] = {
          x: 60 + tierIndex * columnSpacing,
          y: 60 + rIdx * rowSpacing
        };
      });
    };

    arrangeTier(tier0.length ? tier0 : graphData.tables.slice(0, 2), 0);
    arrangeTier(tier1.length ? tier1 : graphData.tables.slice(2, 4), 1);
    arrangeTier(tier2.length ? tier2 : graphData.tables.slice(4), 2);

    setPositions(newPos);
    setPan({ x: 30, y: 30 });
    setZoom(0.8);
  };

  // C. Balanced Grid Layout
  const handleAutoArrangeGrid = () => {
    if (!graphData) return;
    const newPos: Record<string, TablePosition> = {};
    const colsPerRow = Math.max(2, Math.ceil(Math.sqrt(graphData.tables.length)));
    const cardWidth = 320;
    const cardHeight = 380;
    const gapX = 110;
    const gapY = 80;

    graphData.tables.forEach((tbl, idx) => {
      const col = idx % colsPerRow;
      const row = Math.floor(idx / colsPerRow);
      newPos[tbl.table_name] = {
        x: 60 + col * (cardWidth + gapX),
        y: 60 + row * (cardHeight + gapY)
      };
    });

    setPositions(newPos);
    setPan({ x: 30, y: 30 });
    setZoom(0.85);
  };

  // D. Zoom to Fit All
  const handleZoomToFit = () => {
    if (!graphData || graphData.tables.length === 0 || !canvasRef.current) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const cardWidth = 320;
    const cardHeight = 360;

    graphData.tables.forEach((t) => {
      const pos = positions[t.table_name] || { x: 0, y: 0 };
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + cardWidth);
      maxY = Math.max(maxY, pos.y + cardHeight);
    });

    const contentWidth = maxX - minX + 120;
    const contentHeight = maxY - minY + 120;
    const containerWidth = canvasRef.current.clientWidth || 900;
    const containerHeight = canvasRef.current.clientHeight || 600;

    const fitZoom = Math.max(0.4, Math.min(1.1, Math.min(containerWidth / contentWidth, containerHeight / contentHeight)));
    
    const targetPanX = (containerWidth - contentWidth * fitZoom) / 2 - minX * fitZoom + 40;
    const targetPanY = (containerHeight - contentHeight * fitZoom) / 2 - minY * fitZoom + 40;

    setZoom(Number(fitZoom.toFixed(2)));
    setPan({ x: Math.round(targetPanX), y: Math.round(targetPanY) });
  };

  // 3. Mouse & Touch Canvas Panning
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === 'canvas-board' || target.tagName === 'svg' || target.id === 'canvas-grid-bg') {
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

  const handleWheelCanvas = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const zoomSensitivity = 0.005;
      const newZoom = Math.max(0.4, Math.min(2.0, zoom - e.deltaY * zoomSensitivity));
      setZoom(Number(newZoom.toFixed(2)));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleTouchStartCanvas = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === 'canvas-board' || target.tagName === 'svg' || target.id === 'canvas-grid-bg') {
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

  const handleStartDragTable = (tableName: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const curPos = positions[tableName] || { x: 0, y: 0 };
    setDraggingTable(tableName);

    let clientX = 0;
    let clientY = 0;
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

  // 4. Run Live Simulation
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

  // 5. Create Relationship Handler
  const handleCreateRelationship = async () => {
    if (!createSrcTable || !createSrcCol || !createTgtTable || !createTgtCol) return;
    const srcTblObj = graphData?.tables.find((t) => t.table_name === createSrcTable);
    const effectiveDsId = srcTblObj?.dataset_id || currentDataset?.id;
    if (!effectiveDsId) return;

    try {
      setIsCreatingRel(true);
      await api.createRelationship({
        dataset_id: effectiveDsId,
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

  // 6. Export Schema Diagram as SVG Image
  const handleExportDiagramSvg = () => {
    if (!graphData) return;
    const svgElement = canvasRef.current?.querySelector('svg');
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${currentDataset?.name || 'relational_model'}_schema_diagram.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  // 7. Copy Table Name
  const handleCopyTableName = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tableName);
    setCopiedTable(tableName);
    setTimeout(() => setCopiedTable(null), 1800);
  };

  // 8. Filtered tables based on global search
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

  // Connected tables to the selected table for Subgraph Focus Mode
  const connectedTableNames = useMemo(() => {
    if (!selectedTable || !graphData) return new Set<string>();
    const names = new Set<string>([selectedTable]);
    graphData.relationships.forEach((r) => {
      if (r.source_table === selectedTable) names.add(r.target_table);
      if (r.target_table === selectedTable) names.add(r.source_table);
    });
    return names;
  }, [selectedTable, graphData]);

  // Check if all tables are collapsed
  const isAllCollapsed = useMemo(() => {
    if (!graphData || graphData.tables.length === 0) return false;
    return graphData.tables.every((t) => Boolean(collapsedCards[t.table_name]));
  }, [graphData, collapsedCards]);

  const handleToggleCollapseAll = () => {
    if (!graphData) return;
    if (isAllCollapsed) {
      setCollapsedCards({});
    } else {
      const next: Record<string, boolean> = {};
      graphData.tables.forEach((t) => {
        next[t.table_name] = true;
      });
      setCollapsedCards(next);
    }
  };

  // Precise CAD/ERD Relationship Routing & Port Calculations (Handles Minimised/Collapsed Cards & Expanded Cards)
  const { renderedRelationships, collapsedPortsByTable } = useMemo(() => {
    if (!graphData || !graphData.relationships) {
      return { renderedRelationships: [], collapsedPortsByTable: {} as Record<string, Array<{ id: string; side: 'left' | 'right'; offsetY: number; isHighlighted: boolean }>> };
    }

    const cardWidth = 320;

    // Step 1: Group endpoints by table and side ('left' | 'right')
    interface ConnectionEndpoint {
      rel: EerRelationshipEdge;
      isSource: boolean;
      tableName: string;
      side: 'left' | 'right';
      otherPosY: number;
      colName: string;
    }

    const endpointsByTableSide: Record<string, { left: ConnectionEndpoint[]; right: ConnectionEndpoint[] }> = {};

    graphData.tables.forEach((t) => {
      endpointsByTableSide[t.table_name] = { left: [], right: [] };
    });

    const relOrientation: Record<string, {
      srcSide: 'left' | 'right';
      tgtSide: 'left' | 'right';
      isTargetToRight: boolean;
      isTargetToLeft: boolean;
    }> = {};

    graphData.relationships.forEach((rel) => {
      const srcPos = positions[rel.source_table];
      const tgtPos = positions[rel.target_table];
      if (!srcPos || !tgtPos) return;

      const isTargetToRight = tgtPos.x >= srcPos.x + 240;
      const isTargetToLeft = tgtPos.x + cardWidth <= srcPos.x + 80;

      let srcSide: 'left' | 'right' = 'right';
      let tgtSide: 'left' | 'right' = 'left';

      if (isTargetToLeft) {
        srcSide = 'left';
        tgtSide = 'right';
      } else if (!isTargetToRight) {
        if (srcPos.x < tgtPos.x) {
          srcSide = 'right';
          tgtSide = 'right';
        } else {
          srcSide = 'left';
          tgtSide = 'left';
        }
      }

      relOrientation[rel.id] = { srcSide, tgtSide, isTargetToRight, isTargetToLeft };

      if (!endpointsByTableSide[rel.source_table]) {
        endpointsByTableSide[rel.source_table] = { left: [], right: [] };
      }
      if (!endpointsByTableSide[rel.target_table]) {
        endpointsByTableSide[rel.target_table] = { left: [], right: [] };
      }

      endpointsByTableSide[rel.source_table][srcSide].push({
        rel,
        isSource: true,
        tableName: rel.source_table,
        side: srcSide,
        otherPosY: tgtPos.y,
        colName: rel.source_column
      });

      endpointsByTableSide[rel.target_table][tgtSide].push({
        rel,
        isSource: false,
        tableName: rel.target_table,
        side: tgtSide,
        otherPosY: srcPos.y,
        colName: rel.target_column
      });
    });

    // Step 2: Compute Y offset for each endpoint
    const yOffsetMap: Record<string, number> = {};
    const collapsedPorts: Record<string, Array<{ id: string; side: 'left' | 'right'; offsetY: number; isHighlighted: boolean }>> = {};

    graphData.tables.forEach((t) => {
      collapsedPorts[t.table_name] = [];
      const isCollapsed = Boolean(collapsedCards[t.table_name]);

      (['left', 'right'] as const).forEach((side) => {
        const conns = endpointsByTableSide[t.table_name]?.[side] || [];
        if (conns.length === 0) return;

        if (isCollapsed) {
          // Sort endpoints by opposite table's vertical position to ensure lines stay parallel without crossing
          conns.sort((a, b) => a.otherPosY - b.otherPosY);

          const count = conns.length;
          const minY = 22;
          const maxY = 68;

          conns.forEach((conn, idx) => {
            let offset: number;
            if (count === 1) {
              offset = 44; // Vertical midpoint of collapsed card
            } else {
              offset = minY + (idx / (count - 1)) * (maxY - minY);
            }
            const key = `${conn.tableName}:${conn.side}:${conn.rel.id}:${conn.isSource ? 'src' : 'tgt'}`;
            yOffsetMap[key] = offset;

            const isRelSelected = selectedRel?.id === conn.rel.id;
            const isRelHovered = hoveredRel?.id === conn.rel.id;
            collapsedPorts[t.table_name].push({
              id: `${conn.rel.id}-${conn.side}-${conn.isSource ? 'src' : 'tgt'}`,
              side: conn.side,
              offsetY: offset,
              isHighlighted: isRelSelected || isRelHovered
            });
          });
        } else {
          // Expanded Table: compute offset according to visible column position
          const cardSearch = (cardColumnFilter[t.table_name] || '').toLowerCase();
          const visibleCols = t.columns.filter((col) => {
            if (columnDisplayMode === 'keys_only' && !col.is_primary_key && !col.is_foreign_key) return false;
            if (cardSearch && !col.column_name.toLowerCase().includes(cardSearch)) return false;
            return true;
          });

          const hasSearchInput = t.columns.length > 6;
          const headerHeight = hasSearchInput ? 86 : 58;
          const rowHeight = 29;

          conns.forEach((conn) => {
            const colIdx = visibleCols.findIndex((c) => c.column_name === conn.colName);
            let offset: number;
            if (colIdx >= 0) {
              offset = headerHeight + colIdx * rowHeight + 14.5;
            } else {
              // Column filtered out or hidden in keys-only: fallback to top header level
              offset = 32;
            }
            const key = `${conn.tableName}:${conn.side}:${conn.rel.id}:${conn.isSource ? 'src' : 'tgt'}`;
            yOffsetMap[key] = offset;
          });
        }
      });
    });

    // Step 3: Precalculate path and visual attributes for each relationship
    const rendered = graphData.relationships.map((rel) => {
      const srcPos = positions[rel.source_table];
      const tgtPos = positions[rel.target_table];
      if (!srcPos || !tgtPos) return null;

      const orient = relOrientation[rel.id] || {
        srcSide: 'right',
        tgtSide: 'left',
        isTargetToRight: true,
        isTargetToLeft: false
      };

      const x1 = orient.srcSide === 'right' ? srcPos.x + cardWidth : srcPos.x;
      const x2 = orient.tgtSide === 'right' ? tgtPos.x + cardWidth : tgtPos.x;

      const srcKey = `${rel.source_table}:${orient.srcSide}:${rel.id}:src`;
      const tgtKey = `${rel.target_table}:${orient.tgtSide}:${rel.id}:tgt`;

      const y1 = srcPos.y + (yOffsetMap[srcKey] ?? 44);
      const y2 = tgtPos.y + (yOffsetMap[tgtKey] ?? 44);

      const isSelected = selectedRel?.id === rel.id;
      const isHovered = hoveredRel?.id === rel.id;
      const isHighlighted = isSelected || isHovered;

      const isDimmed =
        isolateFocusMode &&
        selectedTable &&
        rel.source_table !== selectedTable &&
        rel.target_table !== selectedTable;

      const { pathData, badgeX, badgeY } = getConnectorPath(
        x1,
        y1,
        x2,
        y2,
        orient.isTargetToRight,
        orient.isTargetToLeft,
        lineRouting
      );

      let strokeColor = '#6366F1'; // 1:M Indigo
      if (rel.cardinality_label === '1:1') {
        strokeColor = '#06B6D4'; // 1:1 Cyan
      } else if (rel.cardinality_label === 'M:1') {
        strokeColor = '#8B5CF6'; // M:1 Purple
      } else if (rel.cardinality_label === 'M:M') {
        strokeColor = '#EC4899'; // M:M Pink
      }

      return {
        rel,
        x1,
        y1,
        x2,
        y2,
        pathData,
        badgeX,
        badgeY,
        strokeColor,
        isSelected,
        isHovered,
        isHighlighted,
        isDimmed
      };
    }).filter(Boolean);

    return {
      renderedRelationships: rendered as Array<{
        rel: EerRelationshipEdge;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        pathData: string;
        badgeX: number;
        badgeY: number;
        strokeColor: string;
        isSelected: boolean;
        isHovered: boolean;
        isHighlighted: boolean;
        isDimmed: boolean;
      }>,
      collapsedPortsByTable: collapsedPorts
    };
  }, [
    graphData,
    positions,
    collapsedCards,
    columnDisplayMode,
    cardColumnFilter,
    selectedRel,
    hoveredRel,
    isolateFocusMode,
    selectedTable,
    lineRouting
  ]);

  // Helper: Domain Classification & Gradient Colors
  const getDomainTheme = (domain: string, isFact: boolean) => {
    const d = (domain || '').toLowerCase();
    if (isFact || d.includes('fact') || d.includes('order') || d.includes('trans') || d.includes('sale')) {
      return {
        badge: 'FACT TABLE',
        color: 'from-cyan-500 to-blue-600',
        textColor: 'text-cyan-300',
        borderColor: 'border-cyan-500/40',
        glowColor: 'rgba(6,182,212,0.4)',
        bgRgb: 'rgba(6,182,212,0.1)'
      };
    }
    if (d.includes('user') || d.includes('cust') || d.includes('dim') || d.includes('people')) {
      return {
        badge: 'DIMENSION',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-300',
        borderColor: 'border-emerald-500/40',
        glowColor: 'rgba(16,185,129,0.4)',
        bgRgb: 'rgba(16,185,129,0.1)'
      };
    }
    if (d.includes('bridge') || d.includes('link') || d.includes('map') || d.includes('rel')) {
      return {
        badge: 'BRIDGE / JUNCTION',
        color: 'from-purple-500 to-fuchsia-600',
        textColor: 'text-purple-300',
        borderColor: 'border-purple-500/40',
        glowColor: 'rgba(168,85,247,0.4)',
        bgRgb: 'rgba(168,85,247,0.1)'
      };
    }
    return {
      badge: 'LOOKUP / ENTITY',
      color: 'from-indigo-500 to-violet-600',
      textColor: 'text-indigo-300',
      borderColor: 'border-indigo-500/40',
      glowColor: 'rgba(99,102,241,0.4)',
      bgRgb: 'rgba(99,102,241,0.1)'
    };
  };

  // Helper for column icon
  const getColIcon = (col: any) => {
    if (col.is_primary_key) return <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (col.is_foreign_key) return <Link2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (col.data_type === 'numeric') return <Hash className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (col.data_type === 'datetime') return <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    return <Type className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  // Canvas background style mapper
  const getCanvasGridClass = () => {
    switch (gridStyle) {
      case 'blueprint':
        return 'eer-grid-blueprint';
      case 'dots':
        return 'eer-grid-dots';
      case 'matrix':
        return 'eer-grid-matrix';
      case 'minimal':
        return 'eer-grid-minimal';
      default:
        return 'eer-grid-blueprint';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#030712] select-none pb-20 md:pb-28">
      {/* =========================================================================
          1. HEADER COMMAND BAR (Studio Controls, Notation, Layouts, Zoom)
         ========================================================================= */}
      <div className="h-auto py-2.5 px-3 sm:px-5 border-b border-slate-800/90 bg-[#060D1E]/95 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 z-30 shadow-xl">
        {/* Brand & Schema Stats */}
        <div className="flex items-center gap-3">
          <div className="dept-section-icon dept-section-icon-purple" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem' }}>
            <Network className="w-5 h-5 text-purple-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="view-header-title text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>E-ER Relational Studio</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  GRAPHIC v2.5
                </span>
              </h1>
              {graphData && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60 font-semibold">
                    {graphData.total_tables} Entities
                  </span>
                  <span className="text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/60 font-semibold">
                    {graphData.total_relationships} Connections
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Interactive Blueprint & Crow&apos;s Foot Relational Engine • Visual Join Simulator
            </p>
          </div>
        </div>

        {/* Studio Controls Cluster */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Quick Search */}
          <div className="relative hidden xl:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter table or column..."
              className="bg-[#081226] border border-slate-800/80 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 w-44 font-mono transition"
            />
          </div>

          {/* Line Style Selector: Step Line (Orthogonal CAD) vs Straight vs Curved */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setLineRouting('orthogonal')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] font-bold ${
                lineRouting === 'orthogonal'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Stepped Orthogonal Lines (Neat 90° CAD/ERD Schematics)"
            >
              <CornerDownRight className="w-3 h-3 text-cyan-300" />
              <span>Step Line</span>
            </button>
            <button
              onClick={() => setLineRouting('straight')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] font-bold ${
                lineRouting === 'straight'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Direct Straight Lines (Point-to-Point)"
            >
              <Minus className="w-3 h-3 text-cyan-300" />
              <span>Straight</span>
            </button>
            <button
              onClick={() => setLineRouting('smooth')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] ${
                lineRouting === 'smooth'
                  ? 'bg-slate-800 text-slate-200 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Soft Curved Lines"
            >
              <Spline className="w-3 h-3" />
            </button>
          </div>

          {/* Flow Animation Toggle */}
          <button
            onClick={() => setIsFlowAnimationActive(!isFlowAnimationActive)}
            className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              isFlowAnimationActive
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-[#081226] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Flowing Data Packet Animation on Relationship Lines"
          >
            <Zap className={`w-3.5 h-3.5 ${isFlowAnimationActive ? 'text-cyan-300 fill-cyan-400/40' : 'text-slate-400'}`} />
            <span>Flow {isFlowAnimationActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Notation Mode Toggle: Neon Energy vs Crow's Foot ERD */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setNotationMode('neon')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] font-bold ${
                notationMode === 'neon'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Clean Solid Color Lines"
            >
              <Zap className="w-3 h-3 text-cyan-300" />
              <span>Clean</span>
            </button>
            <button
              onClick={() => setNotationMode('crowsfoot')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] font-bold ${
                notationMode === 'crowsfoot'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classic Database Engineering Crow's Foot Notations"
            >
              <Boxes className="w-3 h-3 text-purple-300" />
              <span>Crow&apos;s Foot</span>
            </button>
          </div>

          {/* Column Detail Mode: All Attributes vs Keys Only */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setColumnDisplayMode('all')}
              className={`px-2 py-1 rounded-lg transition text-[11px] font-medium ${
                columnDisplayMode === 'all'
                  ? 'bg-slate-800 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Display all attributes and datatypes"
            >
              Full
            </button>
            <button
              onClick={() => setColumnDisplayMode('keys_only')}
              className={`px-2 py-1 rounded-lg transition text-[11px] font-medium flex items-center gap-1 ${
                columnDisplayMode === 'keys_only'
                  ? 'bg-slate-800 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Display only Primary Keys & Foreign Keys (Compact View)"
            >
              <Key className="w-2.5 h-2.5 text-amber-400" />
              <span>Keys</span>
            </button>
          </div>

          {/* Minimize / Expand All Tables Toggle */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={handleToggleCollapseAll}
              className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium flex items-center gap-1.5 ${
                isAllCollapsed
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={isAllCollapsed ? 'Expand All Table Attributes' : 'Minimize All Tables (Compact Architectural Overview)'}
            >
              {isAllCollapsed ? (
                <>
                  <ChevronDown className="w-3 h-3 text-cyan-300" />
                  <span>Expand All</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3 text-cyan-300" />
                  <span>Minimize All</span>
                </>
              )}
            </button>
          </div>

          {/* Canvas Blueprint Grid Switcher */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5">
            {[
              { id: 'blueprint', label: 'Blueprint', icon: Grid },
              { id: 'dots', label: 'Dots', icon: CircleDot },
              { id: 'matrix', label: 'Matrix', icon: Cpu }
            ].map((g) => {
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  onClick={() => setGridStyle(g.id as GridStyle)}
                  className={`p-1.5 rounded-lg transition ${
                    gridStyle === g.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`${g.label} Grid Style`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Smart Auto-Layout Presets */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5">
            <button
              onClick={handleStarSchemaLayout}
              className="px-2 py-1 hover:bg-slate-800 rounded-lg text-slate-300 text-[11px] font-mono transition flex items-center gap-1"
              title="Star Schema Layout (Fact in Center, Dimensions Radial)"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Star</span>
            </button>
            <button
              onClick={handleDagFlowLayout}
              className="px-2 py-1 hover:bg-slate-800 rounded-lg text-slate-300 text-[11px] font-mono transition flex items-center gap-1"
              title="DAG Flow Layout (Left-to-Right Pipeline)"
            >
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden md:inline">Flow</span>
            </button>
            <button
              onClick={handleAutoArrangeGrid}
              className="px-2 py-1 hover:bg-slate-800 rounded-lg text-slate-300 text-[11px] font-mono transition flex items-center gap-1"
              title="Clean Balanced Grid"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>

          {/* Subgraph Isolate Focus Toggle */}
          <button
            onClick={() => setIsolateFocusMode(!isolateFocusMode)}
            className={`p-1.5 rounded-xl border transition ${
              isolateFocusMode
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-[#081226] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Focus Mode: Dim tables unconnected to the selected entity"
          >
            <Focus className="w-4 h-4" />
          </button>

          {/* Zoom / Viewport Controls */}
          <div className="flex items-center bg-[#081226] rounded-xl border border-slate-800 p-0.5 text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomToFit}
              className="text-[11px] font-mono px-2 text-cyan-300 hover:text-white transition font-bold"
              title="Click to Zoom to Fit All Tables"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomToFit}
              className="p-1.5 hover:bg-slate-800 rounded-lg ml-0.5 text-emerald-400 transition"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export Diagram SVG */}
          <button
            onClick={handleExportDiagramSvg}
            className="p-1.5 rounded-xl bg-[#081226] border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
            title="Export Vector SVG Graphic"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Connect Tables Action */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_18px_rgba(147,51,234,0.45)] border border-purple-400/50 transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Connect Tables</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. MAIN E-ER WORKSPACE (Canvas + SVG Connector Layer + Entities)
         ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Board Area */}
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
          className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing transition-colors duration-300 ${getCanvasGridClass()}`}
          style={{
            backgroundSize: `${40 * zoom}px ${40 * zoom}px, ${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px, ${pan.x + 10 * zoom}px ${pan.y + 10 * zoom}px`
          }}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-40 bg-[#040915]/80 backdrop-blur-sm">
              <div className="relative">
                <div className="w-14 h-14 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_30px_rgba(6,182,212,0.6)]" />
                <Database className="w-6 h-6 text-cyan-300 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-xs text-cyan-300 font-mono tracking-wider font-bold">GENERATING E-ER BLUEPRINT...</p>
                <p className="text-[11px] text-slate-400">Discovering keys, cardinality constraints, and entity schemas</p>
              </div>
            </div>
          ) : !graphData || graphData.tables.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 p-8 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center shadow-2xl">
                <Database className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-base font-bold text-white">No Relational Tables Found</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Upload or select a dataset with relational tables to render the interactive Blueprint diagram.
              </p>
            </div>
          ) : (
            <div
              className="absolute inset-0 origin-top-left transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
              }}
            >
              {/* =================================================================
                  SVG RELATIONSHIP CONNECTORS LAYER
                 ================================================================= */}
              <svg className="absolute inset-0 w-[7000px] h-[7000px] pointer-events-none z-0">
                <defs>
                  {/* High-Fidelity Glow Filters */}
                  <filter id="neonWireGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5" result="blur1" />
                    <feGaussianBlur stdDeviation="9" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Gradient Palettes by Cardinality */}
                  <linearGradient id="gradCyanBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>

                  <linearGradient id="gradIndigoPurple" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#A855F7" />
                  </linearGradient>

                  <linearGradient id="gradEmeraldTeal" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>

                  <linearGradient id="gradPinkRose" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#F43F5E" />
                  </linearGradient>

                  {/* Crow's Foot SVG Markers */}
                  {/* Crow's Foot: Many Terminator (>|) */}
                  <marker
                    id="crowsFootMany"
                    viewBox="0 0 20 20"
                    refX="16"
                    refY="10"
                    markerWidth="16"
                    markerHeight="16"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 3 L 14 10 L 0 17" fill="none" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="14" y1="2" x2="14" y2="18" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" />
                  </marker>

                  {/* Crow's Foot: One Terminator (||) */}
                  <marker
                    id="crowsFootOne"
                    viewBox="0 0 20 20"
                    refX="12"
                    refY="10"
                    markerWidth="14"
                    markerHeight="14"
                    orient="auto-start-reverse"
                  >
                    <line x1="6" y1="2" x2="6" y2="18" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="12" y1="2" x2="12" y2="18" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />
                  </marker>
                </defs>

                {renderedRelationships.map((item) => {
                  const {
                    rel,
                    x1,
                    y1,
                    x2,
                    y2,
                    pathData,
                    badgeX,
                    badgeY,
                    strokeColor,
                    isSelected,
                    isHovered,
                    isHighlighted,
                    isDimmed
                  } = item;

                  return (
                    <g
                      key={rel.id}
                      className={`pointer-events-auto cursor-pointer transition-opacity duration-200 ${
                        isDimmed ? 'opacity-15' : 'opacity-100'
                      }`}
                      onClick={() => setSelectedRel(rel)}
                      onMouseEnter={() => setHoveredRel(rel)}
                      onMouseLeave={() => setHoveredRel(null)}
                    >
                      {/* Invisible wider hit area for effortless clicking */}
                      <path d={pathData} fill="none" stroke="transparent" strokeWidth="20" />

                      {/* Subtle crisp highlight casing when selected or hovered */}
                      {isHighlighted && (
                        <path
                          d={pathData}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isSelected ? '6' : '4.5'}
                          opacity={isSelected ? '0.35' : '0.18'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Primary Clean CAD/ERD Relational Line */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? '2.5' : '1.75'}
                        strokeDasharray={rel.status === 'detected' ? 'none' : '5 4'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerStart={notationMode === 'crowsfoot' ? 'url(#crowsFootOne)' : undefined}
                        markerEnd={notationMode === 'crowsfoot' ? 'url(#crowsFootMany)' : undefined}
                        className="transition-colors duration-150"
                      />

                      {/* Flowing Data Animation along the line */}
                      {isFlowAnimationActive && (
                        <>
                          {/* Flowing animated dash pulse stream */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={isHighlighted ? '2.2' : '1.5'}
                            strokeDasharray="6 10"
                            className="eer-wire-flow"
                            opacity={isHighlighted ? '0.9' : '0.65'}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Flowing Data Packet (Photon Bead gliding along the neat line) */}
                          <circle r="4" fill={strokeColor} filter="url(#particleGlow)" opacity="0.85">
                            <animateMotion
                              dur={isHighlighted ? '1.8s' : '3.0s'}
                              repeatCount="indefinite"
                              path={pathData}
                            />
                          </circle>
                          <circle r="2" fill="#FFFFFF">
                            <animateMotion
                              dur={isHighlighted ? '1.8s' : '3.0s'}
                              repeatCount="indefinite"
                              path={pathData}
                            />
                          </circle>
                        </>
                      )}

                      {/* Crisp Terminal Port Beads (Only when Crow's Foot is not active) */}
                      {notationMode !== 'crowsfoot' && (
                        <>
                          <circle
                            cx={x1}
                            cy={y1}
                            r={isHighlighted ? '4' : '2.5'}
                            fill={strokeColor}
                            stroke="#030712"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={x2}
                            cy={y2}
                            r={isHighlighted ? '4' : '2.5'}
                            fill={strokeColor}
                            stroke="#030712"
                            strokeWidth="1.5"
                          />
                        </>
                      )}

                      {/* Clean Crisp Cardinality Pill Badge */}
                      <foreignObject x={badgeX - 22} y={badgeY - 11} width="44" height="22">
                        <div
                          className={`w-full h-full rounded-md flex items-center justify-center text-[10px] font-bold font-mono transition-all duration-150 cursor-pointer select-none shadow-md border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-105'
                              : isHovered
                              ? 'bg-slate-900 text-cyan-300 border-cyan-400'
                              : 'bg-[#081226] text-slate-300 border-slate-700/80 hover:border-cyan-400 hover:text-white'
                          }`}
                        >
                          <span>{rel.cardinality_label}</span>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* =================================================================
                  TABLE ENTITY CARDS LAYER (High-Fidelity 3D Glassmorphism)
                 ================================================================= */}
              {filteredTables.map((tbl) => {
                const pos = positions[tbl.table_name] || { x: 60, y: 60 };
                const isSelected = selectedTable === tbl.table_name;
                const isRelSource = selectedRel?.source_table === tbl.table_name;
                const isRelTarget = selectedRel?.target_table === tbl.table_name;
                const isConnected = isSelected || isRelSource || isRelTarget;

                // Subgraph Focus Mode Dimming
                const isDimmed =
                  isolateFocusMode && selectedTable && !connectedTableNames.has(tbl.table_name);

                // Detect if Fact table or Dimension table
                const isFact =
                  tbl.columns.filter((c) => c.is_foreign_key).length >= 2 || tbl.row_count > 5000;
                const theme = getDomainTheme(tbl.detected_domain, isFact);

                const isCollapsed = collapsedCards[tbl.table_name] || false;
                const cardSearch = (cardColumnFilter[tbl.table_name] || '').toLowerCase();

                // Visible columns based on display mode & card search
                const visibleColumns = tbl.columns.filter((col) => {
                  if (columnDisplayMode === 'keys_only' && !col.is_primary_key && !col.is_foreign_key) {
                    return false;
                  }
                  if (cardSearch && !col.column_name.toLowerCase().includes(cardSearch)) {
                    return false;
                  }
                  return true;
                });

                return (
                  <div
                    key={tbl.table_name}
                    style={{
                      transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                      width: '320px'
                    }}
                    onClick={() => setSelectedTable(tbl.table_name)}
                    className={`absolute rounded-2xl overflow-hidden glass-3d-card transition-all duration-200 select-none ${
                      isDimmed ? 'opacity-20 pointer-events-none' : 'opacity-100'
                    } ${
                      isConnected
                        ? 'border-2 border-cyan-400/90 shadow-[0_25px_65px_-10px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.4),inset_0_1px_2px_rgba(255,255,255,0.3)] ring-2 ring-cyan-400/40 -translate-y-1 z-20'
                        : 'border border-slate-700/80 hover:border-slate-500 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 z-10'
                    }`}
                  >
                    {/* Glowing Top Ambient Accent Strip */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${theme.color}`} />

                    {/* Collapsed Card Port Beacons (Left & Right) */}
                    {isCollapsed && collapsedPortsByTable[tbl.table_name]?.map((port) => (
                      <span
                        key={port.id}
                        style={{ top: `${port.offsetY - 4}px` }}
                        className={`absolute ${port.side === 'left' ? 'left-0' : 'right-0'} w-2 h-2 rounded-full border border-slate-950 pointer-events-none transition-all ${
                          port.isHighlighted
                            ? 'bg-cyan-400 eer-port-beacon shadow-[0_0_8px_rgba(6,182,212,0.9)] scale-125'
                            : 'bg-indigo-400/90 shadow-[0_0_4px_rgba(99,102,241,0.5)]'
                        }`}
                      />
                    ))}

                    {/* Draggable Card Header */}
                    <div
                      onMouseDown={(e) => handleStartDragTable(tbl.table_name, e)}
                      onTouchStart={(e) => handleStartDragTable(tbl.table_name, e)}
                      className="px-4 py-3 cursor-move border-b border-slate-800 bg-gradient-to-r from-slate-900/95 via-[#081226] to-slate-900/95 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`p-1.5 rounded-lg border ${
                            isConnected
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-sm'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                          }`}
                        >
                          <Table className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate font-mono tracking-wide">
                              {tbl.table_name}
                            </span>
                            <button
                              onClick={(e) => handleCopyTableName(tbl.table_name, e)}
                              className="text-slate-400 hover:text-cyan-300 transition"
                              title="Copy table name"
                            >
                              {copiedTable === tbl.table_name ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                          <span className={`text-[9px] font-mono font-extrabold uppercase ${theme.textColor}`}>
                            {theme.badge}
                          </span>
                        </div>
                      </div>

                      {/* Header Actions & Row Counter */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-cyan-300 bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-800 font-semibold shadow-inner">
                          {tbl.row_count.toLocaleString()} rows
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedCards((prev) => ({ ...prev, [tbl.table_name]: !isCollapsed }));
                          }}
                          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title={isCollapsed ? 'Expand Attributes' : 'Minimize Attributes'}
                        >
                          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Optional In-Card Column Search (if > 6 columns) */}
                    {!isCollapsed && tbl.columns.length > 6 && (
                      <div className="px-3 py-1.5 bg-[#050C1B] border-b border-slate-800/80 flex items-center gap-1.5">
                        <Search className="w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          value={cardColumnFilter[tbl.table_name] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCardColumnFilter((prev) => ({ ...prev, [tbl.table_name]: val }));
                          }}
                          placeholder="Filter attributes..."
                          className="w-full bg-transparent text-[11px] font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Columns List (Schema Attributes) */}
                    {!isCollapsed && (
                      <div className="max-h-64 overflow-y-auto bg-slate-950/90 divide-y divide-slate-900/80 custom-scrollbar">
                        {visibleColumns.length === 0 ? (
                          <div className="p-3 text-center text-[11px] text-slate-500 font-mono">
                            No matching attributes found
                          </div>
                        ) : (
                          visibleColumns.map((col) => {
                            const isConnectedSource =
                              selectedRel?.source_table === tbl.table_name &&
                              selectedRel?.source_column === col.column_name;
                            const isConnectedTarget =
                              selectedRel?.target_table === tbl.table_name &&
                              selectedRel?.target_column === col.column_name;
                            const isConnectedKey = isConnectedSource || isConnectedTarget;

                            return (
                              <div
                                key={col.column_name}
                                className={`px-3.5 py-1.5 flex items-center justify-between text-xs transition relative group ${
                                  isConnectedKey
                                    ? 'bg-indigo-600/30 text-cyan-200 font-bold border-l-2 border-cyan-400 shadow-inner'
                                    : 'hover:bg-slate-800/50 text-slate-300 hover:text-white'
                                }`}
                              >
                                {/* Left Port Beacon Indicator for PK/FK */}
                                {(col.is_primary_key || col.is_foreign_key) && (
                                  <span
                                    className={`absolute -left-1.5 w-2 h-2 rounded-full border border-slate-900 ${
                                      isConnectedKey
                                        ? 'bg-cyan-400 eer-port-beacon'
                                        : col.is_primary_key
                                        ? 'bg-amber-400/80'
                                        : 'bg-purple-400/80'
                                    }`}
                                  />
                                )}

                                <div className="flex items-center gap-2 truncate">
                                  {getColIcon(col)}
                                  <span className="truncate font-mono text-[11px] font-medium tracking-tight">
                                    {col.column_name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {col.is_primary_key && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md font-extrabold shadow-sm">
                                      PK
                                    </span>
                                  )}
                                  {col.is_foreign_key && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-md font-extrabold shadow-sm">
                                      FK
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-1 rounded">
                                    {col.data_type}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Card Footer: Domain & Schema Stats */}
                    <div className="px-3.5 py-2 bg-slate-950 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="truncate">Domain: {tbl.detected_domain}</span>
                      <span className="text-slate-500 shrink-0">{tbl.columns.length} cols</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =====================================================================
              3. RADAR MINIMAP (Live Canvas Navigator)
             ===================================================================== */}
          {graphData && graphData.tables.length > 0 && isMinimapOpen && (
            <div className="absolute bottom-4 right-4 bg-[#060D1E]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-2.5 shadow-2xl z-30 w-52 hidden sm:block">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
                <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  RADAR MINIMAP
                </span>
                <button
                  onClick={() => setIsMinimapOpen(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Minimap SVG Area */}
              <div
                className="w-full h-28 bg-[#030712] rounded-xl relative overflow-hidden border border-slate-900 cursor-crosshair"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const clickY = e.clientY - rect.top;
                  const mapScale = 2200 / rect.width;
                  setPan({
                    x: Math.round(-(clickX * mapScale - 400)),
                    y: Math.round(-(clickY * mapScale - 250))
                  });
                }}
              >
                <svg className="w-full h-full" viewBox="0 0 2200 1400">
                  {/* Table Nodes on Minimap */}
                  {graphData.tables.map((t) => {
                    const pos = positions[t.table_name] || { x: 0, y: 0 };
                    const isSelected = selectedTable === t.table_name;
                    return (
                      <rect
                        key={t.table_name}
                        x={pos.x}
                        y={pos.y}
                        width="320"
                        height={collapsedCards[t.table_name] ? '88' : '280'}
                        rx="20"
                        fill={isSelected ? '#06B6D4' : '#1E293B'}
                        stroke={isSelected ? '#38BDF8' : '#334155'}
                        strokeWidth="10"
                      />
                    );
                  })}
                </svg>

                {/* Viewport Highlight Rect */}
                <div
                  className="absolute border border-cyan-400/80 bg-cyan-500/15 pointer-events-none rounded"
                  style={{
                    left: `${Math.max(0, (-pan.x / (2200 * zoom)) * 100)}%`,
                    top: `${Math.max(0, (-pan.y / (1400 * zoom)) * 100)}%`,
                    width: `${Math.min(100, (600 / (2200 * zoom)) * 100)}%`,
                    height: `${Math.min(100, (400 / (1400 * zoom)) * 100)}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1">
                <span>{graphData.tables.length} tables</span>
                <span>Zoom: {Math.round(zoom * 100)}%</span>
              </div>
            </div>
          )}

          {/* Minimap Re-open Button if closed */}
          {!isMinimapOpen && (
            <button
              onClick={() => setIsMinimapOpen(true)}
              className="absolute bottom-4 right-4 bg-[#081226]/90 border border-slate-800 text-slate-300 p-2 rounded-xl text-xs font-mono flex items-center gap-1 shadow-lg hover:text-white transition z-30"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Minimap</span>
            </button>
          )}
        </div>

        {/* =========================================================================
            4. RIGHT INSPECTION HUD & INTERACTIVE VENN JOIN VISUALIZER
           ========================================================================= */}
        <div className="w-80 md:w-96 border-l border-slate-800/90 bg-[#060D1E]/95 backdrop-blur-2xl flex flex-col h-full overflow-y-auto shrink-0 z-20 shadow-2xl p-4 sm:p-5 space-y-5 custom-scrollbar">
          {selectedRel ? (
            <>
              {/* Inspection Header */}
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="badge-neon-purple text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Cardinality Engine
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/40 shadow-sm">
                    {selectedRel.cardinality_label}
                  </span>
                </div>

                <div className="text-sm font-bold text-white flex items-center gap-2 truncate">
                  <span className="text-cyan-400 truncate font-mono">{selectedRel.source_table}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-purple-400 truncate font-mono">{selectedRel.target_table}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between shadow-inner">
                  <span>
                    PK: <strong className="text-cyan-300">{selectedRel.source_column}</strong>
                  </span>
                  <span className="text-slate-500">&harr;</span>
                  <span>
                    FK: <strong className="text-purple-300">{selectedRel.target_column}</strong>
                  </span>
                </div>
              </div>

              {/* Interactive Venn Diagram & Join Visualizer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                    Relational Join Venn Diagram
                  </h4>
                </div>

                {/* Join Selector Buttons */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono">
                  {(['inner', 'left', 'right', 'full'] as JoinType[]).map((j) => (
                    <button
                      key={j}
                      onClick={() => {
                        setActiveVennJoin(j);
                        if (j === 'left' || j === 'inner' || j === 'full') {
                          setSimStrategy(j);
                        }
                      }}
                      className={`py-1 rounded-lg font-bold uppercase transition ${
                        activeVennJoin === j
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>

                {/* Dynamic SVG Venn Graphic */}
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  <svg viewBox="0 0 240 130" className="w-full h-32">
                    <defs>
                      <linearGradient id="vennCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
                      </linearGradient>
                      <linearGradient id="vennPurple" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#EC4899" stopOpacity="0.8" />
                      </linearGradient>
                      <clipPath id="leftCircleClip">
                        <circle cx="85" cy="65" r="50" />
                      </clipPath>
                    </defs>

                    {/* Left Circle (Table A) */}
                    <circle
                      cx="85"
                      cy="65"
                      r="50"
                      fill={
                        activeVennJoin === 'left' || activeVennJoin === 'full'
                          ? 'url(#vennCyan)'
                          : 'rgba(30, 41, 59, 0.4)'
                      }
                      stroke="#06B6D4"
                      strokeWidth="2"
                      opacity={activeVennJoin === 'right' ? '0.25' : '1'}
                      className="transition-all duration-300"
                    />

                    {/* Right Circle (Table B) */}
                    <circle
                      cx="155"
                      cy="65"
                      r="50"
                      fill={
                        activeVennJoin === 'right' || activeVennJoin === 'full'
                          ? 'url(#vennPurple)'
                          : 'rgba(30, 41, 59, 0.4)'
                      }
                      stroke="#8B5CF6"
                      strokeWidth="2"
                      opacity={activeVennJoin === 'left' ? '0.25' : '1'}
                      className="transition-all duration-300"
                    />

                    {/* Center Intersection Lens */}
                    <circle
                      cx="155"
                      cy="65"
                      r="50"
                      clipPath="url(#leftCircleClip)"
                      fill={
                        activeVennJoin === 'inner' ||
                        activeVennJoin === 'left' ||
                        activeVennJoin === 'right' ||
                        activeVennJoin === 'full'
                          ? '#38BDF8'
                          : 'transparent'
                      }
                      opacity={activeVennJoin === 'inner' ? '0.9' : '0.6'}
                      className="transition-all duration-300"
                    />

                    {/* Table Labels */}
                    <text x="50" y="68" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {selectedRel.source_table.slice(0, 7)}
                    </text>
                    <text x="190" y="68" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {selectedRel.target_table.slice(0, 7)}
                    </text>
                    <text x="120" y="68" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      KEY =
                    </text>
                  </svg>

                  {/* Join Explanation Summary */}
                  <div className="text-[11px] text-slate-300 text-center font-sans mt-2">
                    {activeVennJoin === 'inner' && (
                      <span><strong>INNER JOIN:</strong> Only returns matched rows where both keys exist.</span>
                    )}
                    {activeVennJoin === 'left' && (
                      <span><strong>LEFT JOIN:</strong> Preserves all rows from <strong>{selectedRel.source_table}</strong>; fills missing matches with NULLs.</span>
                    )}
                    {activeVennJoin === 'right' && (
                      <span><strong>RIGHT JOIN:</strong> Preserves all rows from <strong>{selectedRel.target_table}</strong>; unmapped rows get NULL.</span>
                    )}
                    {activeVennJoin === 'full' && (
                      <span><strong>FULL OUTER JOIN:</strong> Preserves all entities from both tables with bidirectional NULL padding.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cardinality Narrative Explanation */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  What is a {selectedRel.cardinality_label} Relationship?
                </h4>

                <div className="p-4 rounded-2xl glass-3d-card border border-slate-800/90 space-y-2.5 text-xs shadow-xl">
                  {selectedRel.cardinality_label === '1:1' && (
                    <>
                      <div className="text-cyan-300 font-bold text-sm">One-to-One (1:1) Parity</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Each entity in Table A maps to exactly one record in Table B. Merging these tables augments
                        attributes horizontally with <strong>zero row duplication</strong>.
                      </p>
                    </>
                  )}

                  {selectedRel.cardinality_label === '1:M' && (
                    <>
                      <div className="text-emerald-300 font-bold text-sm">One-to-Many (1:M) Master-Detail</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        A single parent row replicates for each matching child transaction. Parent attributes are preserved
                        alongside each detail record.
                      </p>
                    </>
                  )}

                  {selectedRel.cardinality_label === 'M:1' && (
                    <>
                      <div className="text-indigo-300 font-bold text-sm">Many-to-One (M:1) Lookup Dimension</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Multiple transaction rows reference a single lookup dimension. The base grain of Table A is
                        preserved with enriched dimension attributes.
                      </p>
                    </>
                  )}

                  {selectedRel.cardinality_label === 'M:M' && (
                    <>
                      <div className="text-pink-300 font-bold text-sm">Many-to-Many (M:M) Cross-Link</div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        Entities on both sides can have multiple matches. Direct joins risk Cartesian explosion.
                        Decomposed via bridge junction tables in enterprise data models.
                      </p>
                    </>
                  )}
                </div>

                {selectedRel.reasoning && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 leading-relaxed shadow-inner">
                    &ldquo;{selectedRel.reasoning}&rdquo;
                  </p>
                )}
              </div>

              {/* Simulation Action Trigger */}
              <div className="pt-2">
                <button
                  onClick={() => runSimulation(selectedRel)}
                  disabled={isSimulating}
                  className="w-full btn-3d-cyan py-3 px-4 rounded-xl text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSimulating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Simulating Unified Dataset...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Simulate Live Join Output</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Link2 className="w-10 h-10 text-slate-600 animate-pulse" />
              <h4 className="text-sm font-bold text-white">Select a Relationship</h4>
              <p className="text-xs text-slate-400">
                Click any relationship line or cardinality badge on the canvas to inspect its relational algebra, foreign
                key integrity, and live applied simulation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. LIVE SIMULATION APPLIED DATA DRAWER
         ========================================================================= */}
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

              <button
                onClick={() => setSimDrawerOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Simulation Telemetry Banner */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
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

              {/* What Happens Narrative */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-1.5">
                <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  What happens when this {simResult.summary.cardinality_name} relationship is applied?
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{simResult.summary.what_happens}</p>
                <p className="text-[11px] text-slate-400 font-mono">{simResult.summary.business_example}</p>
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

      {/* =========================================================================
          6. CUSTOM RELATIONSHIP MODAL
         ========================================================================= */}
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
