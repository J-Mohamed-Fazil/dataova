import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Info,
  TrendingUp,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  BarChart2,
  Database,
  Copy,
  Check,
  GitPullRequest,
  RefreshCw,
  Calculator,
  Brain
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { AnalysisOverview, KpiMetric } from '../../types';
import { DriverTreeModal } from '../analysis/DriverTreeModal';
import { Card3D } from '../common/Card3D';
import { HealthGauge3D } from '../common/HealthGauge3D';

export const OverviewView: React.FC = () => {
  const { currentDataset, setActiveTab } = useWorkspace();
  const [overview, setOverview] = useState<AnalysisOverview | null>(null);
  const [selectedKpiForExplanation, setSelectedKpiForExplanation] = useState<KpiMetric | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedFormula, setCopiedFormula] = useState<boolean>(false);
  const [isDriverTreeOpen, setIsDriverTreeOpen] = useState<boolean>(false);
  const [selectedDriverMetric, setSelectedDriverMetric] = useState<string>('');
  const [selectedKpiForDriverTree, setSelectedKpiForDriverTree] = useState<KpiMetric | null>(null);
  const [isRegeneratingKpis, setIsRegeneratingKpis] = useState<boolean>(false);

  const handleRegenerateKpis = async () => {
    if (!currentDataset) return;
    try {
      setIsRegeneratingKpis(true);
      const updatedKpis = await api.regenerateKpis(currentDataset.id);
      if (overview) {
        setOverview({ ...overview, kpis: updatedKpis });
      }
    } catch (err) {
      console.error('Failed to regenerate KPIs:', err);
    } finally {
      setIsRegeneratingKpis(false);
    }
  };

  useEffect(() => {
    if (!currentDataset) return;
    setLoading(true);
    api.getAnalysisOverview(currentDataset.id)
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentDataset]);

  if (!currentDataset || loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto shadow-[0_0_25px_rgba(6,182,212,0.5)]" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Synthesizing 3D Analytical Intelligence...</p>
            <p className="text-xs text-slate-400">Discovering KPIs, profiling schemas, and evaluating multi-tier health integrity</p>
          </div>
        </div>
      </div>
    );
  }

  const healthScore = currentDataset.data_health_score;

  const handleCopyFormula = (formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-6 sm:space-y-8 bg-transparent perspective-1000 max-w-7xl mx-auto w-full">
      {/* Top Banner: Domain Classification & 3D Health Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Domain Classification Card with 3D Depth */}
        <Card3D
          data-tour="overview-domain"
          maxTilt={7}
          perspective={1100}
          scale={1.01}
          className="lg:col-span-2 p-4 sm:p-6 pt-5 sm:pt-7 rounded-2xl glass-3d-card space-y-5 flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />
          
          <div className="pt-2 space-y-3.5">
            <div className="flex items-center justify-between translate-z-20">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
                <span>Universal Domain Intelligence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">Model Confidence</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full badge-neon-blue font-mono shadow-sm">
                  {Math.round(currentDataset.domain_confidence * 100)}%
                </span>
              </div>
            </div>

            <div className="translate-z-25">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {currentDataset.detected_domain}
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-lg badge-neon-emerald font-semibold shadow-sm">
                  Active Profile
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 mt-3.5 text-xs text-slate-300 leading-relaxed font-sans shadow-inner translate-z-15">
                <span className="text-cyan-300 font-semibold mr-1.5">Inference Rationale:</span>
                {currentDataset.domain_reasoning ||
                  'Classified through multi-column semantic token matching, statistical distribution shape, and foreign key entity clustering.'}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5 text-xs text-slate-400 font-mono translate-z-15">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 flex items-center gap-1.5 shadow-sm">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              {currentDataset.row_count.toLocaleString()} Observations
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 flex items-center gap-1.5 shadow-sm">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              {currentDataset.column_count} Discovered Features
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 flex items-center gap-1.5 shadow-sm">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              {currentDataset.tables?.length || 1} Primary Table(s)
            </span>
          </div>
        </Card3D>

        {/* Multi-Layer 3D Cybernetic Health Score Gauge */}
        <div data-tour="overview-health" className="h-full">
          <HealthGauge3D
            score={healthScore}
            onInspectSchema={() => setActiveTab('data')}
          />
        </div>
      </div>

      {/* Dynamic Discovered KPIs in Interactive 3D */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Discovered Key Performance Indicators</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Mathematically derived metric aggregates discovered for {currentDataset.detected_domain} with AI statistical insights.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerateKpis}
              disabled={isRegeneratingKpis}
              className="btn-3d-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 disabled:opacity-50 shadow-sm transition"
              title="Recalculate exact Statistical Quintet (Min, Max, Sum, Count, Average) & AI Insights"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingKpis ? 'animate-spin' : ''}`} />
              <span>{isRegeneratingKpis ? 'Calculating...' : 'Recalculate Statistics'}</span>
            </button>
            <span className="text-xs text-slate-400 hidden lg:inline font-mono">
              Hover to tilt • Click card to inspect
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {overview?.kpis.map((kpi, idx) => (
            <Card3D
              key={kpi.id}
              data-tour={`kpi-card-${idx}`}
              maxTilt={14}
              scale={1.03}
              perspective={900}
              onClick={() => setSelectedKpiForExplanation(kpi)}
              className="p-4 sm:p-6 pt-5 sm:pt-7 rounded-2xl glass-3d-card cursor-pointer transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shadow-xl hover:shadow-[0_12px_36px_rgba(6,182,212,0.25)] border border-slate-700/80 hover:border-cyan-400/60"
            >
              {/* Vibrant top indicator gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 shadow-sm" />

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between gap-2 translate-z-15">
                  <span className="text-xs font-semibold text-slate-300 truncate group-hover:text-white transition" title={kpi.display_name}>
                    {kpi.display_name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md badge-quantum-cyan uppercase font-bold shrink-0 shadow-sm">
                    {kpi.calculation_type}
                  </span>
                </div>

                <div className="text-2xl lg:text-3xl font-black text-white group-hover:text-cyan-300 transition-colors duration-200 tracking-tight translate-z-30 drop-shadow-md font-telemetry mb-1 flex items-baseline justify-between">
                  <span>{kpi.formatted_value}</span>
                  {/* Futuristic micro sparkline indicator */}
                  <div className="flex items-end gap-1 h-5 px-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    <div className="w-1 rounded-full bg-cyan-400/40 group-hover:bg-cyan-400 transition-all h-2" />
                    <div className="w-1 rounded-full bg-cyan-400/60 group-hover:bg-cyan-400 transition-all h-3.5" />
                    <div className="w-1 rounded-full bg-cyan-400/80 group-hover:bg-cyan-400 transition-all h-2.5" />
                    <div className="w-1 rounded-full bg-cyan-400 group-hover:bg-cyan-300 transition-all h-4.5" />
                  </div>
                </div>

                {/* Statistical Quintet Min/Max/Avg/Count Mini-Ribbon */}
                {(kpi.formatted_min || kpi.formatted_max || kpi.formatted_avg || kpi.formatted_count) && (
                  <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                    <div className="bg-slate-900/80 rounded px-1.5 py-0.5 border border-slate-800/80" title={`Min Value: ${kpi.formatted_min || 'N/A'}`}>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Min</span>
                      <span className="text-emerald-400 font-bold truncate block">{kpi.formatted_min || '-'}</span>
                    </div>
                    <div className="bg-slate-900/80 rounded px-1.5 py-0.5 border border-slate-800/80" title={`Max Value: ${kpi.formatted_max || 'N/A'}`}>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Max</span>
                      <span className="text-rose-400 font-bold truncate block">{kpi.formatted_max || '-'}</span>
                    </div>
                    <div className="bg-slate-900/80 rounded px-1.5 py-0.5 border border-slate-800/80" title={`Average: ${kpi.formatted_avg || 'N/A'}`}>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Avg</span>
                      <span className="text-cyan-300 font-bold truncate block">{kpi.formatted_avg || '-'}</span>
                    </div>
                    <div className="bg-slate-900/80 rounded px-1.5 py-0.5 border border-slate-800/80" title={`Sample Count: ${kpi.formatted_count || 'N/A'}`}>
                      <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Count</span>
                      <span className="text-purple-300 font-bold truncate block">{kpi.formatted_count || '-'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3.5 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono translate-z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKpiForDriverTree(kpi);
                    setSelectedDriverMetric(kpi.source_column || kpi.column_name || kpi.name);
                    setIsDriverTreeOpen(true);
                  }}
                  className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition duration-150 shadow-sm"
                  title="Decompose variance across cascading driver tree"
                >
                  <GitPullRequest className="w-3 h-3 text-emerald-400" />
                  <span>Driver Tree</span>
                </button>
                <button
                  data-tour={`kpi-explain-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKpiForExplanation(kpi);
                  }}
                  className="flex items-center gap-1 text-cyan-400 font-semibold group-hover:text-cyan-300 transition hover:underline"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Explain</span>
                </button>
              </div>
            </Card3D>
          ))}
        </div>
      </div>

      {/* Strategic Insights Preview in 3D Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Strategic Insights & Evidence</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified analytical conclusions structured by FACT, CALCULATION, and INFERENCE.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('insights')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition group"
          >
            <span>View All Insights ({overview?.insights.length || 0})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview?.insights.slice(0, 4).map((ins) => (
            <Card3D
              key={ins.id}
              maxTilt={8}
              scale={1.015}
              className="p-5 rounded-2xl glass-3d-card border border-slate-800/80 space-y-3.5 shadow-lg"
            >
              <div className="flex items-center justify-between translate-z-15">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm ${
                    ins.statement_type === 'fact'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : ins.statement_type === 'calculation'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : ins.statement_type === 'inference'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {ins.statement_type}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {ins.category}
                </span>
              </div>

              <h4 className="font-bold text-sm text-white leading-snug translate-z-20">{ins.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed translate-z-10">{ins.description}</p>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 space-y-1 translate-z-15">
                <span className="text-slate-200 font-bold block">Why it matters:</span>
                <p className="text-slate-300">{ins.why_it_matters}</p>
              </div>
            </Card3D>
          ))}
        </div>
      </div>

      {/* KPI Provenance Explanation Modal */}
      {selectedKpiForExplanation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fadeIn">
          <div className="glass-3d-card border border-slate-700/80 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(6,182,212,0.2)] p-4 sm:p-6 space-y-4 sm:space-y-5 relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-500/15 text-brand-400 flex items-center justify-center border border-brand-500/30 shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">KPI Calculation & Provenance</h3>
              </div>
              <button
                onClick={() => setSelectedKpiForExplanation(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition active:translate-y-0.5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
                <div>
                  <span className="text-slate-400 font-medium block">Metric Name:</span>
                  <p className="font-bold text-sm text-white mt-0.5">{selectedKpiForExplanation.display_name}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Primary Computed Value:</span>
                  <p className="font-bold text-lg text-cyan-300 mt-0.5 font-mono">
                    {selectedKpiForExplanation.formatted_value}
                  </p>
                </div>
              </div>

              {/* Statistical Quintet Display Grid */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Statistical Quintet (Verified Baseline Metrics)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">N = {selectedKpiForExplanation.formatted_count || selectedKpiForExplanation.count_value || 'Direct'}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Count (N)</span>
                    <span className="text-purple-300 font-bold text-xs mt-0.5 block truncate">
                      {selectedKpiForExplanation.formatted_count || selectedKpiForExplanation.count_value || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Sum (Total)</span>
                    <span className="text-blue-300 font-bold text-xs mt-0.5 block truncate">
                      {selectedKpiForExplanation.formatted_sum || selectedKpiForExplanation.sum_value || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Average (μ)</span>
                    <span className="text-cyan-300 font-bold text-xs mt-0.5 block truncate">
                      {selectedKpiForExplanation.formatted_avg || selectedKpiForExplanation.avg_value || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Min (Floor)</span>
                    <span className="text-emerald-400 font-bold text-xs mt-0.5 block truncate">
                      {selectedKpiForExplanation.formatted_min || selectedKpiForExplanation.min_value || '-'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800/80 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block font-sans">Max (Peak)</span>
                    <span className="text-rose-400 font-bold text-xs mt-0.5 block truncate">
                      {selectedKpiForExplanation.formatted_max || selectedKpiForExplanation.max_value || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Statistical Distribution Insight */}
              {selectedKpiForExplanation.ai_insight && (
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-900/80 border border-indigo-500/30 space-y-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span>AI Statistical & Distribution Insight</span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed font-sans">
                    {selectedKpiForExplanation.ai_insight}
                  </p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Mathematical Formula:</span>
                  <button
                    onClick={() => handleCopyFormula(selectedKpiForExplanation.formula_explanation)}
                    className="text-slate-400 hover:text-brand-300 text-[11px] flex items-center gap-1 transition"
                  >
                    {copiedFormula ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <code className="block p-2 rounded-lg bg-black/40 text-cyan-300 font-mono text-[11px] border border-slate-800 overflow-x-auto">
                  {selectedKpiForExplanation.formula_explanation}
                </code>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 shadow-inner">
                <span className="text-slate-400 font-semibold block">Business & Operational Impact:</span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {selectedKpiForExplanation.impact_summary ||
                    'Provides baseline operational visibility for this domain measure, computed deterministically from raw dataset records.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                data-tour="kpi-modal-close"
                onClick={() => setSelectedKpiForExplanation(null)}
                className="btn-3d-secondary px-4 py-2 text-white rounded-xl text-xs font-semibold"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hierarchical Driver Tree Modal */}
      {currentDataset && (
        <DriverTreeModal
          datasetId={currentDataset.id}
          datasetName={currentDataset.name}
          selectedKpi={selectedKpiForDriverTree}
          initialMetric={selectedDriverMetric}
          isOpen={isDriverTreeOpen}
          onClose={() => {
            setIsDriverTreeOpen(false);
            setSelectedKpiForDriverTree(null);
          }}
        />
      )}
    </div>
  );
};
