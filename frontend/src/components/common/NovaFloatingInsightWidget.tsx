import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { X, Minus, Maximize2, Minimize2, Square, Sparkles, ArrowLeft } from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { Insight } from '../../types';
import { RobotGuide3D } from '../tutorial/RobotGuide3D';

// Lazy-load the enhanced Nova AI Analyst panel
const NovaAnalystPanel = lazy(() =>
  import('../chat/NovaAnalystPanel').then((m) => ({ default: m.NovaAnalystPanel }))
);

// ─── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'nova-3d-position';
const WIDGET_SIZE = 64; // px – approximate width/height of the Nova button
const EDGE_MARGIN = 12; // px – minimum distance from any viewport edge
const DRAG_THRESHOLD = 5; // px – movement beyond this = drag, not click
const DEFAULT_WIDTH = 480; // px – default compact panel width
const DEFAULT_HEIGHT = 660; // px – default compact panel height

export interface NovaFloatingInsightWidgetProps {
  onOpenUpload?: () => void;
}

// ─── Confetti Particle ───────────────────────────────────────────────────────
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadSavedPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
  } catch {}
  return null;
}

function clampPosition(x: number, y: number): { x: number; y: number } {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const bottomOffset = isMobile ? 76 : EDGE_MARGIN;
  const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1200) - WIDGET_SIZE - EDGE_MARGIN;
  const maxY = (typeof window !== 'undefined' ? window.innerHeight : 800) - WIDGET_SIZE - bottomOffset;
  return {
    x: Math.max(EDGE_MARGIN, Math.min(x, maxX)),
    y: Math.max(EDGE_MARGIN, Math.min(y, maxY)),
  };
}

function defaultPosition(): { x: number; y: number } {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const bottomOffset = isMobile ? 76 : EDGE_MARGIN + 4;
  return clampPosition(
    (typeof window !== 'undefined' ? window.innerWidth : 1200) - WIDGET_SIZE - EDGE_MARGIN - 4,
    (typeof window !== 'undefined' ? window.innerHeight : 800) - WIDGET_SIZE - bottomOffset
  );
}

// ─── Panel position calculation ──────────────────────────────────────────────
function getPanelStyle(
  novaX: number,
  novaY: number,
  windowMode: 'compact' | 'maximized' | 'fullscreen',
  customSize: { width: number; height: number }
): React.CSSProperties {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (windowMode === 'fullscreen') {
    return {
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 10000,
      borderRadius: 0,
    };
  }

  if (windowMode === 'maximized') {
    const maxW = Math.min(880, vw - 32);
    const maxH = Math.min(820, vh - 40);
    return {
      position: 'fixed',
      left: Math.max(16, Math.round((vw - maxW) / 2)),
      top: Math.max(16, Math.round((vh - maxH) / 2)),
      width: maxW,
      height: maxH,
      zIndex: 9999,
    };
  }

  // Mobile sheet mode
  if (vw < 768) {
    return {
      position: 'fixed',
      left: '8px',
      right: '8px',
      top: '56px',
      bottom: '68px',
      width: 'calc(100vw - 16px)',
      maxHeight: 'calc(100dvh - 128px)',
      zIndex: 9999,
      borderRadius: '1.25rem',
    };
  }

  // Compact floating mode for tablet/desktop
  const panelW = Math.min(customSize.width, vw - 24);
  const panelH = Math.min(customSize.height, vh - 24);

  let left: number;
  if (novaX - panelW - 12 >= EDGE_MARGIN) {
    left = novaX - panelW - 12;
  } else {
    left = Math.min(novaX + WIDGET_SIZE + 12, vw - panelW - EDGE_MARGIN);
  }

  let top = Math.max(EDGE_MARGIN, Math.min(novaY - (panelH - WIDGET_SIZE), vh - panelH - EDGE_MARGIN));
  if (top < EDGE_MARGIN) top = EDGE_MARGIN;

  return {
    position: 'fixed',
    left,
    top,
    width: panelW,
    height: panelH,
    zIndex: 9999,
  };
}

// ─── Inline loading fallback for lazy panel ──────────────────────────────────
const PanelFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px]">
    <div className="relative">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center animate-pulse">
        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
    <span className="text-[11px] text-cyan-400 font-mono tracking-wider animate-pulse">
      INITIALIZING AI ANALYST...
    </span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const NovaFloatingInsightWidget: React.FC<NovaFloatingInsightWidgetProps> = ({
  onOpenUpload,
}) => {
  const { currentDataset, activeTab, isNovaOpen, setIsNovaOpen } = useWorkspace();

  // ── Position state (viewport-relative) ──────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadSavedPosition();
    if (saved) return clampPosition(saved.x, saved.y);
    return { x: -1, y: -1 }; // sentinel; resolved in effect below
  });

  useEffect(() => {
    if (pos.x === -1 && pos.y === -1) {
      setPos(defaultPosition());
    }
    const onResize = () => setPos((p) => clampPosition(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Window Chrome state ────────────────────────────────────────────────────
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [windowMode, setWindowMode] = useState<'compact' | 'maximized' | 'fullscreen'>('compact');
  const [sizePreset, setSizePreset] = useState<'S' | 'M' | 'L'>('S');
  const [customSize, setCustomSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  // Sync with global workspace context isNovaOpen trigger
  useEffect(() => {
    if (isNovaOpen) {
      setIsPanelOpen(true);
      setIsMinimized(false);
      setRobotExpression('wink');
    }
  }, [isNovaOpen]);

  const applySizePreset = (preset: 'S' | 'M' | 'L') => {
    setSizePreset(preset);
    if (windowMode !== 'compact') {
      setWindowMode('compact');
    }
    if (preset === 'S') {
      setCustomSize({ width: 440, height: 580 });
    } else if (preset === 'M') {
      setCustomSize({ width: 640, height: 720 });
    } else if (preset === 'L') {
      setCustomSize({ width: 840, height: 800 });
    }
  };

  // Corner resizing tracking
  const isResizing = useRef(false);
  const resizeStart = useRef<{
    mx: number;
    my: number;
    w: number;
    h: number;
    dir: 'bottom-left' | 'bottom-right';
  }>({ mx: 0, my: 0, w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT, dir: 'bottom-right' });

  const onResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: 'bottom-left' | 'bottom-right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isResizing.current = true;
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      w: customSize.width,
      h: customSize.height,
      dir: direction,
    };
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    const dx = e.clientX - resizeStart.current.mx;
    const dy = e.clientY - resizeStart.current.my;
    const maxW = Math.floor(window.innerWidth * 0.95);
    const maxH = Math.floor(window.innerHeight * 0.95);

    let newW = resizeStart.current.w;
    if (resizeStart.current.dir === 'bottom-left') {
      newW = Math.max(380, Math.min(maxW, resizeStart.current.w - dx));
    } else {
      newW = Math.max(380, Math.min(maxW, resizeStart.current.w + dx));
    }
    const newH = Math.max(420, Math.min(maxH, resizeStart.current.h + dy));
    setCustomSize({ width: newW, height: newH });
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizing.current) {
      isResizing.current = false;
    }
  };

  // Window actions
  const handleMinimize = () => {
    setIsMinimized(true);
    setIsPanelOpen(false);
    setIsNovaOpen(false);
  };

  const handleToggleMaximize = () => {
    if (windowMode === 'maximized') {
      setWindowMode('compact');
    } else {
      setWindowMode('maximized');
    }
  };

  const handleToggleFullscreen = () => {
    if (windowMode === 'fullscreen') {
      setWindowMode('compact');
    } else {
      setWindowMode('fullscreen');
    }
  };

  const handleClose = () => {
    setIsPanelOpen(false);
    setIsMinimized(false);
    setIsNovaOpen(false);
  };

  // ── Drag state ─────────────────────────────────────────────────────────────
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const [isActiveDrag, setIsActiveDrag] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      didDrag.current = false;
      setIsActiveDrag(false);
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      if (!didDrag.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!didDrag.current) {
        didDrag.current = true;
        setIsActiveDrag(true);
      }
      const next = clampPosition(dragStart.current.ox + dx, dragStart.current.oy + dy);
      setPos(next);
    },
    []
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setIsActiveDrag(false);
      if (didDrag.current) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
      } else {
        // Nova 3D Click handler
        if (isMinimized) {
          setIsMinimized(false);
          setIsPanelOpen(true);
          setIsNovaOpen(true);
          setRobotExpression('celebrate');
        } else if (isPanelOpen) {
          setIsPanelOpen(false);
          setIsNovaOpen(false);
        } else {
          setIsPanelOpen(true);
          setIsMinimized(false);
          setIsNovaOpen(true);
          setRobotExpression('wink');
        }
      }
    },
    [pos, isMinimized, isPanelOpen, setIsNovaOpen]
  );

  // ── Robot expression ───────────────────────────────────────────────────────
  const [robotExpression, setRobotExpression] = useState<
    'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink'
  >('wave');
  const [celebrateCount, setCelebrateCount] = useState(0);

  useEffect(() => {
    if (isPanelOpen) {
      setRobotExpression('wink');
    } else if (isMinimized) {
      setRobotExpression('thinking');
    } else if (activeTab === 'insights') {
      setRobotExpression('celebrate');
    } else {
      setRobotExpression('wave');
    }
  }, [isPanelOpen, isMinimized, activeTab]);

  // ── Insights badge count ───────────────────────────────────────────────────
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (!currentDataset) {
      setInsights([]);
      return;
    }
    api
      .getAnalysisOverview(currentDataset.id)
      .then((res) => setInsights(res.insights || []))
      .catch(() => {});
  }, [currentDataset]);

  // ── Confetti ───────────────────────────────────────────────────────────────
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState(false);

  const triggerCelebration = useCallback(() => {
    setCelebrateCount((c) => c + 1);
    setRobotExpression('celebrate');
    setShowCelebrationBanner(true);
    const originX = pos.x + WIDGET_SIZE / 2;
    const originY = pos.y;
    const colors = ['#38bdf8', '#fbbf24', '#34d399', '#f43f5e', '#a855f7', '#60a5fa', '#f59e0b'];
    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < 28; i++) {
      const angle = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 7 + Math.random() * 12;
      particles.push({
        id: Date.now() + i,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 7,
        rotation: Math.random() * 360,
      });
    }
    setConfetti(particles);
    setTimeout(() => setShowCelebrationBanner(false), 2800);
  }, [pos]);

  useEffect(() => {
    if (confetti.length === 0) return;
    const interval = setInterval(() => {
      setConfetti((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.42,
            rotation: p.rotation + 10,
          }))
          .filter((p) => p.y < window.innerHeight && p.x > 0 && p.x < window.innerWidth)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [confetti.length]);

  // Save position whenever it changes
  useEffect(() => {
    if (pos.x === -1 && pos.y === -1) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, [pos]);

  if (pos.x === -1 && pos.y === -1) return null;

  const panelStyle = getPanelStyle(pos.x, pos.y, windowMode, customSize);

  return (
    <>
      {/* ── Confetti layer ── */}
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[10001] overflow-hidden">
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
                backgroundColor: p.color,
                width: `${p.size}px`,
                height: `${p.size * 0.65}px`,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
              className="rounded-sm shadow-md"
            />
          ))}
        </div>
      )}

      {/* ── AI Analyst Window ── */}
      {isPanelOpen && (
        <>
          {/* Backdrop (in compact / maximized mode) */}
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
              windowMode === 'fullscreen' ? 'z-[9998]' : 'z-[9990]'
            }`}
            onClick={() => handleMinimize()}
          />

          <div
            style={panelStyle}
            className={`flex flex-col bg-[#080D18] border border-cyan-500/35 shadow-[0_24px_80px_rgba(0,0,0,0.92),0_0_50px_rgba(6,182,212,0.18)] overflow-hidden transition-all duration-150 animate-fadeIn ${
              windowMode === 'fullscreen' ? 'rounded-none' : 'rounded-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Window Chrome Header ── */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-[#070D1A] shrink-0 select-none">
              <div className="flex items-center gap-2">
                {/* Back button to return to original page */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-semibold transition active:scale-95 shadow-sm group mr-0.5"
                  title="Return to the underlying page"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Back</span>
                </button>

                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-500/40 flex items-center justify-center text-sm shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                  🤖
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-white tracking-wide">
                    Nova AI Analyst
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Mini ChatGPT
                  </span>
                </div>
              </div>

              {/* ── Chrome Window Controls ── */}
              <div className="flex items-center gap-1.5">
                {/* Size Presets (S / M / L) - when not in fullscreen */}
                {windowMode === 'compact' && (
                  <div className="flex items-center gap-0.5 bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 mr-1 text-[10px] font-mono">
                    {(['S', 'M', 'L'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => applySizePreset(p)}
                        className={`px-1.5 py-0.5 rounded transition ${
                          sizePreset === p
                            ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title={`Set window size: ${p === 'S' ? 'Small (440x580)' : p === 'M' ? 'Medium (640x720)' : 'Large (840x800)'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Minimize button */}
                <button
                  onClick={handleMinimize}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                  title="Minimize AI Analyst (preserves conversation in floating Nova 3D)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* Maximize / Restore button */}
                <button
                  onClick={handleToggleMaximize}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                  title={windowMode === 'maximized' ? 'Restore compact window' : 'Maximize window'}
                >
                  {windowMode === 'maximized' ? (
                    <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Fullscreen / Exit Full Screen button */}
                <button
                  onClick={handleToggleFullscreen}
                  className={`p-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    windowMode === 'fullscreen'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 px-2.5 text-xs font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                  title={
                    windowMode === 'fullscreen'
                      ? 'Exit full screen (restore previous floating size)'
                      : 'Full-screen (expand to fill entire viewport)'
                  }
                >
                  {windowMode === 'fullscreen' ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline">Exit Full Screen</span>
                    </>
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Close (X) button */}
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition ml-0.5"
                  title="Close AI Analyst (preserves dashboard location and state)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Panel Body: NovaAnalystPanel ── */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <Suspense fallback={<PanelFallback />}>
                <NovaAnalystPanel
                  onOpenUpload={onOpenUpload}
                  onClose={handleClose}
                  isMaximized={windowMode === 'maximized'}
                  isFullscreen={windowMode === 'fullscreen'}
                />
              </Suspense>

              {/* ── Corner Resize Handles (Compact mode only) ── */}
              {windowMode === 'compact' && (
                <>
                  {/* Bottom-right grip */}
                  <div
                    onPointerDown={(e) => onResizePointerDown(e, 'bottom-right')}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
                    title="Drag corner to resize window width & height"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className="text-cyan-400 fill-current"
                    >
                      <circle cx="8" cy="8" r="1.2" />
                      <circle cx="5" cy="8" r="1.2" />
                      <circle cx="8" cy="5" r="1.2" />
                      <circle cx="2" cy="8" r="1.2" />
                      <circle cx="5" cy="5" r="1.2" />
                      <circle cx="8" cy="2" r="1.2" />
                    </svg>
                  </div>

                  {/* Bottom-left grip */}
                  <div
                    onPointerDown={(e) => onResizePointerDown(e, 'bottom-left')}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
                    title="Drag corner to resize window width & height"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className="text-cyan-400 fill-current"
                    >
                      <circle cx="2" cy="8" r="1.2" />
                      <circle cx="5" cy="8" r="1.2" />
                      <circle cx="2" cy="5" r="1.2" />
                      <circle cx="8" cy="8" r="1.2" />
                      <circle cx="5" cy="5" r="1.2" />
                      <circle cx="2" cy="2" r="1.2" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Nova 3D Floating Portable Button ── */}
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: WIDGET_SIZE,
          height: WIDGET_SIZE,
          zIndex: 10000,
          cursor: isActiveDrag ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Nova 3D · Click to open AI Analyst · Drag to move anywhere"
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Celebration banner */}
          {showCelebrationBanner && (
            <div className="absolute bottom-full mb-3 right-0 whitespace-nowrap px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-cyan-500 to-indigo-600 text-white font-black text-xs shadow-[0_0_30px_rgba(251,191,36,0.6)] border border-amber-300/80 animate-bounce-gentle z-50 flex items-center gap-2 backdrop-blur-xl pointer-events-none">
              <span>🎉 AI Analyst Ready!</span>
            </div>
          )}

          {/* Minimized indicator pill */}
          {isMinimized && !isPanelOpen && (
            <div className="absolute bottom-full mb-2.5 right-0 whitespace-nowrap px-3 py-1 rounded-xl bg-[#091122]/95 border border-cyan-400/60 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-xl z-50 pointer-events-none animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[10px] font-bold text-cyan-300 font-mono">AI Active · Click to resume</span>
            </div>
          )}

          {/* Nova 3D Robot */}
          <div
            className={`relative flex items-center justify-center w-full h-full transition-transform duration-200 ${
              isPanelOpen ? 'scale-110' : 'hover:scale-105'
            }`}
          >
            <div className="relative w-14 h-14 bg-transparent flex items-center justify-center overflow-visible">
              <RobotGuide3D
                size="xs"
                expression={robotExpression}
                celebrateTrigger={celebrateCount}
                peekingHorizontal={false}
                showBackground={false}
                onRobotClick={triggerCelebration}
                className="scale-105"
              />
            </div>

            {/* Insight count badge */}
            {insights.length > 0 && !isPanelOpen && !isMinimized && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-[9px] font-black font-mono text-white flex items-center justify-center border-2 border-[#090D16] shadow-lg pointer-events-none animate-pulse-gentle">
                {insights.length}
              </span>
            )}

            {/* Active indicator ring when panel is open */}
            {isPanelOpen && (
              <span className="absolute inset-0 rounded-full border-2 border-cyan-400/60 animate-ping pointer-events-none" />
            )}

            {/* Minimized pulsing ring */}
            {isMinimized && !isPanelOpen && (
              <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-pulse pointer-events-none" />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
