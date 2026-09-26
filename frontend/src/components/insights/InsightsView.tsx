import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Award,
  ShieldCheck,
  ArrowUpRight,
  Filter,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
  Check
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { Insight } from '../../types';

import { Card3D } from '../common/Card3D';

export const InsightsView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [explainingInsight, setExplainingInsight] = useState<Insight | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentDataset) return;
    api.getAnalysisOverview(currentDataset.id)
      .then((res) => setInsights(res.insights || []))
      .catch(console.error);
  }, [currentDataset]);

  if (!currentDataset) return null;

  const filteredInsights = insights.filter((ins) => {
    const matchesCategory = selectedCategory === 'all' || ins.category === selectedCategory;
    const matchesType = selectedType === 'all' || ins.statement_type === selectedType;
    return matchesCategory && matchesType;
  });

  const handleAddToReport = async (ins: Insight) => {
    try {
      await api.createReportSection(
        currentDataset.id,
        `Insight: ${ins.title}`,
        `${ins.description}\n\nStrategic Context: ${ins.why_it_matters}\n\nRecommendation: ${ins.recommendation || 'Maintain monitoring.'}`
      );
      setAddedIds((prev) => new Set([...prev, ins.id]));
    } catch (err) {
      console.error('Failed to add insight to report:', err);
    }
  };

  const categories = ['all', 'performance', 'trend', 'anomaly', 'opportunity', 'data_quality'];
  const types = ['all', 'fact', 'calculation', 'inference', 'recommendation'];

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 bg-transparent perspective-1000 max-w-7xl mx-auto w-full">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span>Discovered Strategic Insights</span>
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              Nova 3D Synthesized
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified findings categorized by mathematical fact, deterministic calculation, and strategic inference.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3D Category Filter Rail */}
          <div className="tabs-3d-rail flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`tab-3d-item capitalize ${
                  selectedCategory === cat ? 'tab-3d-item-active' : ''
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Statement Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 uppercase font-semibold cursor-pointer shadow-inner"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Insights 3D Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredInsights.map((ins) => {
          const isAdded = addedIds.has(ins.id);
          const isCritical = ins.severity === 'critical' || ins.severity === 'high';

          return (
            <Card3D
              key={ins.id}
              maxTilt={8}
              scale={1.015}
              perspective={950}
              className="p-4 sm:p-6 pt-5 sm:pt-7 rounded-2xl glass-3d-card flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden transition-all duration-300 group border border-slate-800/90"
            >
              {/* Top severity accent bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isCritical
                    ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400'
                    : 'bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500'
                }`}
              />

              <div className="pt-2 space-y-3.5">
                {/* Header Tag Bar with 3D Depth */}
                <div className="flex items-center justify-between translate-z-15">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full font-mono shadow-sm ${
                        ins.statement_type === 'fact'
                          ? 'badge-neon-blue'
                          : ins.statement_type === 'calculation'
                          ? 'badge-neon-emerald'
                          : ins.statement_type === 'inference'
                          ? 'badge-neon-purple'
                          : 'badge-neon-amber'
                      }`}
                    >
                      {ins.statement_type}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {ins.category}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                      ins.severity === 'critical' || ins.severity === 'high'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : ins.severity === 'medium'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {ins.severity} priority
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-white leading-snug tracking-tight translate-z-20 drop-shadow-sm">
                  {ins.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed translate-z-10">{ins.description}</p>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2.5 text-xs shadow-inner translate-z-15">
                  <div className="text-slate-300 leading-relaxed">
                    <strong className="text-cyan-300 block mb-1 font-semibold">Strategic Provenance & Context:</strong>
                    {ins.why_it_matters}
                  </div>
                  {ins.recommendation && (
                    <div className="text-slate-300 pt-3 mt-2 border-t border-slate-800/80 leading-relaxed">
                      <strong className="text-emerald-400 block mb-1 font-semibold">Recommended Action:</strong>
                      {ins.recommendation}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions with 3D Tactile Buttons */}
              <div className="pt-3.5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs translate-z-20">
                <button
                  onClick={() => setExplainingInsight(ins)}
                  className="text-slate-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Inspect Proof</span>
                </button>

                <button
                  onClick={() => handleAddToReport(ins)}
                  disabled={isAdded}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    isAdded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'btn-3d-secondary text-slate-200 hover:text-white'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Added to Briefing</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Add to Report</span>
                    </>
                  )}
                </button>
              </div>
            </Card3D>
          );
        })}

        {filteredInsights.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <Lightbulb className="w-8 h-8 text-amber-400/50 mx-auto" />
            <h4 className="text-base font-bold text-white">No matching strategic insights</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No findings matched the selected category and statement type. Reset the filter to review all insights discovered by Nova.
            </p>
            <button
              onClick={() => { setSelectedCategory('all'); setSelectedType('all'); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-cyan-300 hover:bg-slate-700 transition"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Provenance Explanation Modal */}
      {explainingInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0C1222] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Insight Provenance & Verification</h3>
              </div>
              <button
                onClick={() => setExplainingInsight(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Verified Conclusion:</span>
                <p className="font-bold text-white text-sm mt-0.5">{explainingInsight.title}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 font-medium block mb-1">Deterministic Math / Proof:</span>
                <pre className="text-brand-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap p-2 rounded bg-black/40 border border-slate-800">
                  {JSON.stringify(explainingInsight.calculation_details, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <span className="text-slate-400 font-medium block">Source Table:</span>
                  <p className="font-mono text-slate-200 mt-0.5">{explainingInsight.source_table}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Statistical Confidence:</span>
                  <p className="text-emerald-400 font-bold mt-0.5 font-mono">
                    {(explainingInsight.confidence * 100).toFixed(0)}% Certainty
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setExplainingInsight(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
