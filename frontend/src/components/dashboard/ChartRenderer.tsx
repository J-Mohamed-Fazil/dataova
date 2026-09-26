import React, { useState } from 'react';
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
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Treemap
} from 'recharts';
import { MapPin, Globe, Compass, Layers, AlignLeft, BarChart3, TrendingUp, Info, Grid, LayoutGrid, Flame } from 'lucide-react';
import { DashboardChart } from '../../types';

interface ChartRendererProps {
  chart: DashboardChart;
}

const PALETTES = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6', // Teal
];

// Custom Sleek Glass Tooltip with Forecast & Dual-Metric Intelligence
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rawPoint = payload[0]?.payload || {};
    const isForecast = rawPoint.is_forecast;
    const actualVal = rawPoint.value;
    const secondaryVal = rawPoint.secondary_value;
    const forecastVal = rawPoint.forecast;
    const lower = rawPoint.forecast_lower;
    const upper = rawPoint.forecast_upper;
    const sharePct = rawPoint.share_pct;

    return (
      <div className="p-3 rounded-xl bg-[#0B1120]/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50 min-w-48">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-200">{label || rawPoint.label || 'Dimension'}</span>
          {isForecast && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Forecast (95% CI)
            </span>
          )}
          {sharePct !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
              {sharePct}% Share
            </span>
          )}
        </div>

        {actualVal !== null && actualVal !== undefined && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              Primary:
            </span>
            <span className="font-bold text-white font-mono">
              {typeof actualVal === 'number' ? actualVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : actualVal}
            </span>
          </div>
        )}

        {secondaryVal !== null && secondaryVal !== undefined && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Secondary:
            </span>
            <span className="font-bold text-emerald-300 font-mono">
              {typeof secondaryVal === 'number' ? secondaryVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : secondaryVal}
            </span>
          </div>
        )}

        {forecastVal !== null && forecastVal !== undefined && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Projected:
            </span>
            <span className="font-bold text-emerald-300 font-mono">
              {typeof forecastVal === 'number' ? forecastVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : forecastVal}
            </span>
          </div>
        )}

        {lower !== undefined && upper !== undefined && (
          <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80 flex items-center justify-between">
            <span>Range:</span>
            <span className="text-slate-300 font-semibold">{lower?.toLocaleString()} – {upper?.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Interactive High-Tech Vector Geographic Map Component
interface GeoMapProps {
  data: Array<any>;
  chartId: string;
}

const GeographicMapRenderer: React.FC<GeoMapProps> = ({ data, chartId }) => {
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);

  const maxVal = Math.max(...data.map(d => (typeof d.value === 'number' ? d.value : 0)), 1);

  // Approximate world continent outlines in SVG path coordinates (800x400 viewBox)
  const continents = [
    // North America
    "M 120 70 L 220 60 L 260 90 L 240 140 L 190 190 L 160 180 L 140 230 L 120 180 L 90 120 Z",
    // South America
    "M 190 220 L 260 240 L 280 290 L 250 380 L 220 370 L 200 300 L 180 250 Z",
    // Europe
    "M 380 60 L 470 50 L 480 100 L 430 130 L 370 120 L 360 80 Z",
    // Africa
    "M 370 140 L 480 140 L 490 210 L 450 310 L 400 320 L 360 220 L 350 160 Z",
    // Asia
    "M 480 50 L 680 50 L 710 110 L 680 190 L 590 180 L 560 230 L 510 200 L 490 120 Z",
    // Australia & Oceania
    "M 620 260 L 710 250 L 720 320 L 660 340 L 610 300 Z"
  ];

  // Derive SVG (x, y) coordinates from lat/lng or regional presets
  const getNodeCoordinates = (item: any, idx: number) => {
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      const x = ((item.lng + 180) / 360) * 720 + 40;
      const y = ((85 - Math.max(-65, Math.min(80, item.lat))) / 150) * 320 + 40;
      return { x, y };
    }
    // Deterministic distribution fallback across major continents
    const fallbackLocations = [
      { x: 180, y: 120 }, // NA East
      { x: 130, y: 130 }, // NA West
      { x: 420, y: 90 },  // Central Europe
      { x: 440, y: 130 }, // Mediterranean
      { x: 640, y: 110 }, // East Asia
      { x: 550, y: 170 }, // South Asia
      { x: 420, y: 220 }, // Africa Central
      { x: 230, y: 280 }, // South America
      { x: 660, y: 290 }, // Oceania
    ];
    return fallbackLocations[idx % fallbackLocations.length];
  };

  const topSorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-3 p-1">
      {/* Interactive Cartographic Canvas */}
      <div className="relative flex-1 h-56 md:h-full bg-gradient-to-b from-[#090D1A] to-[#0D1527] rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
        {/* World Cartographic Grid & Landmass SVG */}
        <svg viewBox="0 0 800 400" className="w-full h-full select-none">
          <defs>
            <radialGradient id={`node-glow-${chartId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`node-fill-${chartId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Graticule Latitude & Longitude Grid */}
          <line x1="0" y1="80" x2="800" y2="80" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="0" y1="160" x2="800" y2="160" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="0" y1="240" x2="800" y2="240" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="0" y1="320" x2="800" y2="320" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />

          <line x1="160" y1="0" x2="160" y2="400" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="320" y1="0" x2="320" y2="400" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="480" y1="0" x2="480" y2="400" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />
          <line x1="640" y1="0" x2="640" y2="400" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="0.8" />

          {/* Continent Landmass Silhouettes */}
          {continents.map((path, i) => (
            <path
              key={`continent-${i}`}
              d={path}
              fill="#131c31"
              stroke="#243452"
              strokeWidth="1.2"
              className="opacity-75 transition hover:opacity-90"
            />
          ))}

          {/* Geographic Hotspot Nodes */}
          {data.map((item, idx) => {
            const { x, y } = getNodeCoordinates(item, idx);
            const ratio = Math.max(0.15, (item.value || 0) / maxVal);
            const radius = 5 + ratio * 14;
            const isTop = idx < 3;
            const isHovered = hoveredNode?.label === item.label;

            return (
              <g
                key={`geo-node-${idx}`}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={() => setHoveredNode(item)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Glowing Outer Ripple for Top Nodes */}
                {isTop && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius * 1.7}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.2"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                )}

                {/* Core Data Node */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? radius + 3 : radius}
                  fill={isHovered ? '#38bdf8' : `url(#node-fill-${chartId})`}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : 0.9}
                  className="transition-all duration-200"
                />

                {/* Hotspot Code/Rank Label */}
                {(isTop || isHovered) && (
                  <text
                    x={x}
                    y={y - radius - 4}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="9.5"
                    fontWeight="bold"
                    className="pointer-events-none drop-shadow-md select-none"
                  >
                    {item.code || item.label.slice(0, 3).toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Floating Details Card */}
        {hoveredNode && (
          <div className="absolute top-2 left-2 p-2.5 rounded-lg bg-[#0B1120]/95 border border-cyan-500/40 backdrop-blur-md text-xs space-y-1 shadow-xl z-20 pointer-events-none animate-in fade-in">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{hoveredNode.label}</span>
              {hoveredNode.code && (
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono">
                  {hoveredNode.code}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-slate-400">Total Volume:</span>
              <span className="font-bold text-cyan-300 font-mono">
                {typeof hoveredNode.value === 'number'
                  ? hoveredNode.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                  : hoveredNode.value}
              </span>
            </div>
            {hoveredNode.share_pct !== undefined && (
              <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
                <span>Global Share:</span>
                <span className="font-mono text-emerald-400 font-semibold">{hoveredNode.share_pct}%</span>
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-2 right-2 text-[9px] text-slate-500 font-mono flex items-center gap-1">
          <Globe className="w-3 h-3 text-slate-500" />
          <span>Geospatial Vector Projection</span>
        </div>
      </div>

      {/* Side Leaderboard & Geo Density Summary */}
      <div className="w-full md:w-44 flex flex-col justify-between bg-slate-900/50 p-2.5 rounded-xl border border-slate-800 text-xs">
        <div>
          <div className="flex items-center justify-between mb-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-indigo-400" />
              <span>Top Hubs</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{data.length} regions</span>
          </div>

          <div className="space-y-1.5">
            {topSorted.slice(0, 4).map((item, i) => {
              const pct = maxVal > 0 ? Math.round(((item.value || 0) / maxVal) * 100) : 0;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredNode(item)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    hoveredNode?.label === item.label
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-medium truncate max-w-[85px]">{item.label}</span>
                    <span className="font-mono font-bold text-white text-[10px]">
                      {typeof item.value === 'number'
                        ? item.value >= 1000
                          ? `${(item.value / 1000).toFixed(1)}k`
                          : item.value.toLocaleString()
                        : item.value}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-1.5 mt-1 flex items-center justify-between font-mono">
          <span>Global Total:</span>
          <span className="text-slate-300 font-semibold">
            {data.reduce((acc, c) => acc + (typeof c.value === 'number' ? c.value : 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  );
};

// Interactive Multi-Cohort Heatmap Matrix Component
interface HeatmapRendererProps {
  data: Array<any>;
  chartId: string;
}

const HeatmapRenderer: React.FC<HeatmapRendererProps> = ({ data, chartId }) => {
  const [hoveredCell, setHoveredCell] = useState<any | null>(null);

  // Derive unique X and Y dimensions
  const xLabels = Array.from(new Set(data.map(d => String(d.x || d.label || '')).filter(Boolean)));
  const yLabels = Array.from(new Set(data.map(d => String(d.y || 'Cohort')).filter(Boolean)));

  // Lookup map for fast cell retrieval
  const cellMap = new Map<string, any>();
  let minVal = Infinity;
  let maxVal = -Infinity;

  data.forEach(d => {
    const key = `${d.x || d.label}__${d.y || 'Cohort'}`;
    const val = typeof d.value === 'number' ? d.value : 0;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    cellMap.set(key, d);
  });

  if (minVal === Infinity) minVal = 0;
  if (maxVal === -Infinity) maxVal = 1;

  // Color interpolator for cyber heat matrix
  const getCellBgColor = (intensity: number) => {
    const clamped = Math.max(0.04, Math.min(1.0, intensity));
    if (clamped < 0.25) {
      return `rgba(30, 58, 138, ${0.35 + clamped * 1.5})`; // Blue
    } else if (clamped < 0.55) {
      return `rgba(6, 182, 212, ${0.45 + (clamped - 0.25) * 1.6})`; // Cyan
    } else if (clamped < 0.8) {
      return `rgba(139, 92, 246, ${0.65 + (clamped - 0.55) * 1.4})`; // Violet/Purple
    } else {
      return `rgba(245, 158, 11, ${0.8 + (clamped - 0.8) * 1.2})`; // Amber/Fire
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-1 select-none">
      {/* 2D Grid Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative rounded-xl bg-[#090D1A]/90 border border-slate-800/80 p-3">
        <div
          className="grid gap-1.5 min-w-full"
          style={{
            gridTemplateColumns: `auto repeat(${Math.max(xLabels.length, 1)}, minmax(48px, 1fr))`
          }}
        >
          {/* Top-Left Empty Corner */}
          <div className="text-[10px] font-mono text-slate-500 font-semibold p-1.5 flex items-center justify-end">
            Y \ X
          </div>

          {/* Column Headers (X-Axis) */}
          {xLabels.map(x => (
            <div
              key={`head-x-${x}`}
              title={x}
              className="text-[10px] font-mono font-medium text-slate-400 p-1.5 text-center truncate border-b border-slate-800/80"
            >
              {x}
            </div>
          ))}

          {/* Row Rows */}
          {yLabels.map(y => (
            <React.Fragment key={`row-y-${y}`}>
              {/* Row Header (Y-Axis) */}
              <div
                title={y}
                className="text-[10px] font-mono font-medium text-slate-400 p-1.5 text-right truncate border-r border-slate-800/80 pr-2 flex items-center justify-end"
              >
                {y}
              </div>

              {/* Matrix Cells */}
              {xLabels.map(x => {
                const item = cellMap.get(`${x}__${y}`) || {
                  x,
                  y,
                  value: 0,
                  intensity: 0.04,
                  share_pct: 0
                };
                const val = typeof item.value === 'number' ? item.value : 0;
                const intensity = item.intensity !== undefined ? item.intensity : ((val - minVal) / Math.max(maxVal - minVal, 1e-6));
                const isHovered = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;

                return (
                  <div
                    key={`cell-${x}-${y}`}
                    onMouseEnter={() => setHoveredCell(item)}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center p-1 cursor-pointer transition-all duration-200 relative border ${
                      isHovered
                        ? 'border-cyan-300 ring-2 ring-cyan-400/60 scale-105 z-20 shadow-lg shadow-cyan-950/50'
                        : 'border-slate-800/50 hover:border-slate-600'
                    }`}
                    style={{
                      backgroundColor: getCellBgColor(intensity)
                    }}
                  >
                    <span className={`text-[10px] font-mono font-bold truncate leading-tight ${intensity > 0.5 ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString()}
                    </span>
                    {item.share_pct !== undefined && item.share_pct > 0 && (
                      <span className="text-[8px] font-mono text-slate-300/80 leading-tight">
                        {item.share_pct}%
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Footer Legend & Live Cell Status */}
      <div className="flex items-center justify-between pt-2 px-1 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>Heat Scale:</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">{minVal.toLocaleString()}</span>
            <div className="w-24 h-2 rounded-full bg-gradient-to-r from-blue-900 via-cyan-500 via-purple-500 to-amber-400" />
            <span className="text-amber-300 font-bold">{maxVal.toLocaleString()}</span>
          </div>
        </div>

        {hoveredCell ? (
          <div className="text-cyan-300 font-semibold flex items-center gap-1.5 animate-fadeIn">
            <span>{hoveredCell.x} × {hoveredCell.y}:</span>
            <span className="text-white font-mono">{hoveredCell.value?.toLocaleString()}</span>
            {hoveredCell.share_pct && <span className="text-cyan-400">({hoveredCell.share_pct}% share)</span>}
          </div>
        ) : (
          <span className="text-slate-500 italic">Hover any matrix cell for granular metrics</span>
        )}
      </div>
    </div>
  );
};

// Custom Interactive Treemap Content Node
const CustomTreemapTile = (props: any) => {
  const { x, y, width, height, index, name, value, share_pct, color } = props;
  const tileColor = color || PALETTES[index % PALETTES.length];

  if (width < 4 || height < 4) return null;

  return (
    <g>
      <rect
        x={x + 1.5}
        y={y + 1.5}
        width={Math.max(width - 3, 0)}
        height={Math.max(height - 3, 0)}
        rx={6}
        ry={6}
        fill={tileColor}
        fillOpacity={0.88}
        stroke="#0B1120"
        strokeWidth={2}
        className="transition-all duration-200 hover:fill-opacity-100 cursor-pointer"
      />
      {width > 42 && height > 24 && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#ffffff"
          fontSize={width > 70 ? 11 : 9}
          fontWeight="700"
          className="select-none pointer-events-none drop-shadow-md"
        >
          {name && name.length > Math.floor(width / 7) ? `${name.substring(0, Math.floor(width / 7))}…` : name}
        </text>
      )}
      {width > 50 && height > 44 && (
        <text
          x={x + 8}
          y={y + 34}
          fill="#cffafe"
          fontSize={10}
          fontFamily="monospace"
          fontWeight="600"
          className="select-none pointer-events-none"
        >
          {typeof value === 'number' ? (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()) : value}
        </text>
      )}
      {width > 65 && height > 60 && share_pct !== undefined && (
        <text
          x={x + 8}
          y={y + 48}
          fill="#94a3b8"
          fontSize={9}
          fontFamily="monospace"
          className="select-none pointer-events-none"
        >
          {share_pct}% share
        </text>
      )}
    </g>
  );
};

const TreemapRenderer: React.FC<{ data: Array<any>; chartId: string }> = ({ data }) => {
  // Normalize treemap data ensuring valid size/value
  const formattedData = data.map((d, i) => ({
    name: d.name || d.label || `Cohort ${i + 1}`,
    value: typeof d.value === 'number' ? d.value : (typeof d.size === 'number' ? d.size : 1),
    size: typeof d.value === 'number' ? d.value : (typeof d.size === 'number' ? d.size : 1),
    share_pct: d.share_pct,
    color: d.color || PALETTES[i % PALETTES.length],
    children: d.children
  }));

  return (
    <div className="w-full h-full p-1">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={formattedData}
          dataKey="value"
          stroke="#0B1120"
          content={<CustomTreemapTile />}
          isAnimationActive={true}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({ chart }) => {
  const data = chart.data || [];

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-900/30 rounded-xl border border-dashed border-slate-800 p-4 text-center">
        <Info className="w-5 h-5 text-slate-500 mb-1.5" />
        <span className="font-medium text-slate-300">No computed data points available for this visualization</span>
        <span className="text-[11px] text-slate-500 mt-1 max-w-xs font-mono">
          {chart.table_name ? `Table: ${chart.table_name}` : ''}
          {chart.x_field ? ` | X: ${chart.x_field}` : ''}
          {chart.y_field ? ` | Y: ${chart.y_field}` : ''}
        </span>
      </div>
    );
  }

  const chartType = chart.chart_type.toLowerCase();
  const hasForecast = data.some((d: any) => d.forecast !== undefined && d.forecast !== null);
  const hasSecondary = data.some((d: any) => d.secondary_value !== undefined && d.secondary_value !== null);

  return (
    <div className="w-full h-64 pt-2">
      {/* 1. Geographic Map Visualization */}
      {chartType === 'map' || chartType === 'geo' ? (
        <GeographicMapRenderer data={data} chartId={chart.id} />
      ) : chartType === 'heatmap' || chartType === 'heat_map' ? (
        /* 2. 2D Matrix Heatmap */
        <HeatmapRenderer data={data} chartId={chart.id} />
      ) : chartType === 'treemap' || chartType === 'tree_map' ? (
        /* 3. Hierarchical Area Treemap */
        <TreemapRenderer data={data} chartId={chart.id} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {/* 2. Temporal Line or Area Chart */}
          {chartType === 'line' || chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 14, right: 20, left: 12, bottom: 28 }}>
              <defs>
                <linearGradient id={`gradient-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={`gradient-forecast-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip content={<CustomTooltip />} />
              {hasForecast && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
              <Area
                type="monotone"
                name="Historical Actual"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#gradient-${chart.id})`}
                dot={{ fill: '#6366f1', r: 3.5, strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#818cf8', stroke: '#ffffff', strokeWidth: 2 }}
              />
              {hasForecast && (
                <Area
                  type="monotone"
                  name="Holt Trend Forecast"
                  dataKey="forecast"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  fillOpacity={1}
                  fill={`url(#gradient-forecast-${chart.id})`}
                  dot={{ fill: '#10b981', r: 3.5, strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          ) : chartType === 'horizontal_bar' ? (
            /* 3. Horizontal Bar Chart (Category on Y-Axis, Number on X-Axis) */
            <BarChart layout="vertical" data={data} margin={{ top: 8, right: 28, left: 16, bottom: 8 }}>
              <defs>
                <linearGradient id={`hbar-grad-${chart.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={6}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <YAxis
                type="category"
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                width={95}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={`url(#hbar-grad-${chart.id})`}>
                {data.map((_, index) => (
                  <Cell
                    key={`hcell-${index}`}
                    fill={PALETTES[index % PALETTES.length]}
                    opacity={0.9}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'composed' || chartType === 'combo' ? (
            /* 4. Composed Combo Chart (Bar + Line Dual Metric) */
            <ComposedChart data={data} margin={{ top: 14, right: 24, left: 12, bottom: 28 }}>
              <defs>
                <linearGradient id={`composed-bar-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                stroke="#818cf8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#4f46e5' }}
                tickMargin={8}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              {hasSecondary && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#34d399"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#059669' }}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar
                yAxisId="left"
                name={chart.y_field || 'Primary Metric'}
                dataKey="value"
                radius={[5, 5, 0, 0]}
                fill={`url(#composed-bar-${chart.id})`}
              />
              {hasSecondary && (
                <Line
                  yAxisId="right"
                  name={chart.secondary_y_field || 'Secondary Trend'}
                  type="monotone"
                  dataKey="secondary_value"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 4, strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          ) : chartType === 'radar' ? (
            /* 5. Radar / Spider Polar Chart */
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
              <defs>
                <linearGradient id={`radar-grad-${chart.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="#334155" strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="label"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
              />
              <PolarRadiusAxis
                angle={30}
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 9 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Radar
                name={chart.title || 'Profile'}
                dataKey="value"
                stroke="#a855f7"
                strokeWidth={2}
                fill={`url(#radar-grad-${chart.id})`}
                fillOpacity={0.6}
              />
            </RadarChart>
          ) : chartType === 'pie' ? (
            /* 6. Donut / Pie Chart */
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                cornerRadius={4}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PALETTES[index % PALETTES.length]}
                    stroke="#0C1222"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : chartType === 'scatter' ? (
            /* 7. Scatter Correlation Plot */
            <ScatterChart margin={{ top: 14, right: 20, left: 12, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="x" stroke="#64748b" fontSize={11} tickLine={false} tickMargin={8} />
              <YAxis dataKey="y" stroke="#64748b" fontSize={11} tickLine={false} tickMargin={8} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="#8b5cf6" />
            </ScatterChart>
          ) : chartType === 'histogram' ? (
            /* 7b. Anomaly / Dispersion Histogram */
            <BarChart data={data} margin={{ top: 14, right: 20, left: 12, bottom: 28 }}>
              <defs>
                <linearGradient id={`hist-gradient-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Frequency Count" radius={[4, 4, 0, 0]} fill={`url(#hist-gradient-${chart.id})`} />
            </BarChart>
          ) : chartType === 'table' ? (
            /* 8. Data Table */
            <div className="overflow-x-auto h-full text-xs custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-3 px-3.5">Label</th>
                    <th className="py-3 px-3.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.slice(0, 8).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3.5 text-white font-medium">{row.label}</td>
                      <td className="py-3 px-3.5 text-right text-brand-300 font-mono font-bold">
                        {typeof row.value === 'object'
                          ? JSON.stringify(row.value)
                          : typeof row.value === 'number'
                          ? row.value.toLocaleString()
                          : row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 9. Default Vertical Bar Chart with Modern Top Radius & Gradients */
            <BarChart data={data} margin={{ top: 14, right: 20, left: 12, bottom: 28 }}>
              <defs>
                <linearGradient id={`bar-gradient-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickMargin={8}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={`url(#bar-gradient-${chart.id})`}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PALETTES[index % PALETTES.length]}
                    opacity={0.9}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
};
