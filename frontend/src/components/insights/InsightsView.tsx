import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
  Check,
  Search,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Copy,
  Download,
  Sparkles,
  Database,
  Layers,
  Zap,
  Target,
  Scale,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  FileText,
  Clock,
  Activity,
  BarChart2,
  Info
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { Insight } from '../../types';
import { Card3D } from '../common/Card3D';

export const InsightsView: React.FC = () => {
  const { currentDataset, openNovaWithPrompt, setActiveTab } = useWorkspace();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'confidence' | 'title' | 'category'>('severity');
  const [explainingInsight, setExplainingInsight] = useState<Insight | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio Speech Synthesis state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isAudioPaused, setIsAudioPaused] = useState<boolean>(false);
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState<number>(-1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!currentDataset) return;
    setIsLoading(true);
    api.getAnalysisOverview(currentDataset.id)
      .then((res) => {
        setInsights(res.insights || []);
      })
      .catch((err) => {
        console.error('Failed to load insights:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [currentDataset]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // ── Audio Narration Functions ──
  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
    setCurrentSpeechIndex(-1);
  };

  const playSpeechForList = (list: Insight[]) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || list.length === 0) return;

    window.speechSynthesis.cancel();

    const fullScript = list.map((ins, idx) => {
      return `Insight number ${idx + 1}: ${ins.title}. ${ins.description}. Strategic context: ${ins.why_it_matters}. Recommendation: ${ins.recommendation || 'Continuous monitoring is advised.'}`;
    }).join('. ');

    const intro = `Executive summary briefing for ${currentDataset?.detected_domain || 'dataset'}. Analyzing ${list.length} strategic insights. `;
    const utterance = new SpeechSynthesisUtterance(intro + fullScript);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      setIsAudioPaused(false);
    };

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
      setCurrentSpeechIndex(-1);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const toggleAudio = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Audio synthesis not supported in this browser.');
      return;
    }

    if (isPlayingAudio) {
      if (isAudioPaused) {
        window.speechSynthesis.resume();
        setIsAudioPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsAudioPaused(true);
      }
    } else {
      playSpeechForList(filteredInsights.length > 0 ? filteredInsights : insights);
    }
  };

  // ── Add to Report / Export Actions ──
  const handleAddToReport = async (ins: Insight) => {
    if (!currentDataset) return;
    try {
      await api.createReportSection(
        currentDataset.id,
        `Insight: ${ins.title}`,
        `${ins.description}\n\nStrategic Context: ${ins.why_it_matters}\n\nRecommendation: ${ins.recommendation || 'Maintain monitoring.'}`
      );
      setAddedIds((prev) => new Set([...prev, ins.id]));
      showToast(`Added "${ins.title.substring(0, 30)}..." to Executive Report`);
    } catch (err) {
      console.error('Failed to add insight to report:', err);
      showToast('Failed to add section to report');
    }
  };

  const handleAddAllToReport = async () => {
    if (!currentDataset || filteredInsights.length === 0) return;
    try {
      const itemsToAdd = filteredInsights.filter((ins) => !addedIds.has(ins.id));
      for (const ins of itemsToAdd) {
        await api.createReportSection(
          currentDataset.id,
          `Insight: ${ins.title}`,
          `${ins.description}\n\nStrategic Context: ${ins.why_it_matters}\n\nRecommendation: ${ins.recommendation || 'Maintain monitoring.'}`
        );
      }
      setAddedIds(new Set([...addedIds, ...filteredInsights.map(i => i.id)]));
      showToast(`Successfully added ${itemsToAdd.length} insights to Executive Report!`);
    } catch (err) {
      console.error('Failed batch add to report:', err);
      showToast('Error adding batch insights');
    }
  };

  const handleCopyInsight = (ins: Insight) => {
    const md = `### 💡 ${ins.title}
**Category**: ${ins.category.toUpperCase()} | **Type**: ${ins.statement_type.toUpperCase()} | **Severity**: ${ins.severity.toUpperCase()} | **Confidence**: ${(ins.confidence * 100).toFixed(0)}%
**Finding**: ${ins.description}
**Strategic Context**: ${ins.why_it_matters}
${ins.recommendation ? `**Recommended Action**: ${ins.recommendation}` : ''}
${ins.source_table ? `**Source**: Table \`${ins.source_table}\` (${ins.source_columns.join(', ')})` : ''}
`;
    navigator.clipboard.writeText(md);
    setCopiedId(ins.id);
    showToast('Insight copied to clipboard (Markdown)');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyExecutiveSummary = () => {
    if (insights.length === 0) return;
    const summaryHeader = `# 📊 Executive Strategic Briefing - ${currentDataset?.detected_domain || 'Intelligence'}\n\n`;
    const summaryBody = insights.map((ins, i) => `${i + 1}. **[${ins.severity.toUpperCase()}] ${ins.title}**\n   ${ins.description}\n   *Action*: ${ins.recommendation || 'Monitor continuously.'}`).join('\n\n');
    navigator.clipboard.writeText(summaryHeader + summaryBody);
    showToast('Executive briefing copied to clipboard!');
  };

  const handleAskNova = (ins: Insight) => {
    const prompt = `Can you analyze this strategic insight in depth: "${ins.title}"? Finding: "${ins.description}". Context: "${ins.why_it_matters}". What are the root causes and actionable next steps?`;
    openNovaWithPrompt(prompt, {
      insightId: ins.id,
      title: ins.title,
      category: ins.category,
      source_table: ins.source_table
    });
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(insights, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `datanova_insights_${currentDataset?.id || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported insights JSON');
  };

  // ── Filtered & Sorted Insights ──
  const filteredInsights = useMemo(() => {
    return insights
      .filter((ins) => {
        const matchesCategory = selectedCategory === 'all' || ins.category === selectedCategory;
        const matchesType = selectedType === 'all' || ins.statement_type === selectedType;
        const matchesSeverity = selectedSeverity === 'all' || ins.severity === selectedSeverity;
        const matchesQuery = !searchQuery.trim() || 
          ins.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ins.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ins.why_it_matters.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (ins.recommendation && ins.recommendation.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (ins.source_table && ins.source_table.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesType && matchesSeverity && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityWeight[b.severity] - severityWeight[a.severity];
        }
        if (sortBy === 'confidence') {
          return b.confidence - a.confidence;
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'category') {
          return a.category.localeCompare(b.category);
        }
        return 0;
      });
  }, [insights, selectedCategory, selectedType, selectedSeverity, searchQuery, sortBy]);

  // ── Metrics Telemetry Calculations ──
  const criticalCount = useMemo(() => insights.filter((i) => i.severity === 'critical' || i.severity === 'high').length, [insights]);
  const avgConfidence = useMemo(() => {
    if (insights.length === 0) return 100;
    const total = insights.reduce((acc, curr) => acc + (curr.confidence || 0.9), 0);
    return Math.round((total / insights.length) * 100);
  }, [insights]);
  const factCount = useMemo(() => insights.filter((i) => i.statement_type === 'fact' || i.statement_type === 'calculation').length, [insights]);
  const inferenceCount = useMemo(() => insights.filter((i) => i.statement_type === 'inference' || i.statement_type === 'recommendation').length, [insights]);

  const categories = [
    { key: 'all', label: 'All Categories', icon: Lightbulb },
    { key: 'performance', label: 'Performance', icon: Zap },
    { key: 'trend', label: 'Trends', icon: TrendingUp },
    { key: 'anomaly', label: 'Anomalies', icon: AlertTriangle },
    { key: 'opportunity', label: 'Opportunities', icon: Target },
    { key: 'risk', label: 'Risks', icon: ShieldAlert },
    { key: 'data_quality', label: 'Data Quality', icon: ShieldCheck }
  ];

  const severities = [
    { key: 'all', label: 'All Severities' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' }
  ];

  const types = ['all', 'fact', 'calculation', 'inference', 'recommendation'];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'trend': return <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />;
      case 'anomaly': return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'performance': return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'opportunity': return <Target className="w-3.5 h-3.5 text-emerald-400" />;
      case 'risk': return <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />;
      case 'data_quality': return <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />;
      default: return <Lightbulb className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  if (!currentDataset) return null;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 space-y-5 sm:space-y-6 bg-transparent perspective-1000 max-w-7xl mx-auto w-full">
      
      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0E1A33]/95 text-white border border-cyan-500/50 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-fadeIn">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          <span className="text-xs font-semibold text-slate-100">{toastMessage}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="view-header">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="dept-section-icon dept-section-icon-amber mt-0.5 shrink-0" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.875rem' }}>
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="view-header-title text-xl sm:text-2xl font-black text-white tracking-tight">
                  Strategic Insights Lab
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md badge-neon-amber shadow-[0_0_14px_rgba(245,158,11,0.25)]">
                  <span className="status-dot-live" style={{ background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                  Nova AI Intelligence
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/60 font-mono">
                  {filteredInsights.length} / {insights.length} Discovered
                </span>
              </div>
              <p className="view-header-subtitle max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed mt-1">
                Deterministic mathematical facts, econometric inferences, and high-impact strategic directives generated for <strong className="text-white font-semibold">{currentDataset.name}</strong>.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Audio Speech Narration Button */}
            <button
              onClick={toggleAudio}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isPlayingAudio
                  ? isAudioPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse'
                  : 'btn-3d-secondary text-slate-200 hover:text-white'
              }`}
              title={isPlayingAudio ? (isAudioPaused ? 'Resume AI speech' : 'Pause AI speech') : 'Listen to executive briefing audio'}
            >
              {isPlayingAudio ? (
                isAudioPaused ? <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <Pause className="w-3.5 h-3.5 text-cyan-200 fill-cyan-200" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isPlayingAudio ? (isAudioPaused ? 'Resume Briefing' : 'Playing...') : 'Listen Briefing'}</span>
            </button>

            {/* Batch Add All to Report */}
            <button
              onClick={handleAddAllToReport}
              disabled={filteredInsights.length === 0}
              className="btn-3d-secondary px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5"
              title="Add all currently filtered insights to the Executive Report"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Add All to Report</span>
            </button>

            {/* Copy Executive Summary */}
            <button
              onClick={handleCopyExecutiveSummary}
              className="btn-3d-secondary px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5"
              title="Copy markdown briefing summary to clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Copy Briefing</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={handleExportJson}
              className="btn-3d-secondary p-2 rounded-xl text-slate-300 hover:text-white transition"
              title="Export all insights as JSON file"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Telemetry Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card3D maxTilt={6} className="bg-[#0A1428]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Insights</span>
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{insights.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Across {currentDataset.tables?.length || 1} table{currentDataset.tables?.length === 1 ? '' : 's'}</p>
        </Card3D>

        <Card3D maxTilt={6} className="bg-[#0A1428]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">High / Critical</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-300 font-mono">{criticalCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Requiring priority attention</p>
        </Card3D>

        <Card3D maxTilt={6} className="bg-[#0A1428]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statistical Certainty</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300 font-mono">{avgConfidence}%</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Mean confidence score</p>
        </Card3D>

        <Card3D maxTilt={6} className="bg-[#0A1428]/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facts vs Inferences</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-300 font-mono">
            {factCount} <span className="text-xs text-slate-500 font-normal">/ {inferenceCount}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Verified mathematical ratio</p>
        </Card3D>
      </div>

      {/* ── Search & Filter Controls Rail ── */}
      <div className="glass-3d-card rounded-2xl p-4 sm:p-5 border border-slate-800/80 space-y-3.5 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings, keywords, tables, recommendations..."
              className="w-full bg-[#060D1E]/95 border border-slate-700/80 text-xs text-slate-200 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-amber-400 transition placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Severity Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {severities.map((sev) => (
              <button
                key={sev.key}
                onClick={() => setSelectedSeverity(sev.key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  selectedSeverity === sev.key
                    ? sev.key === 'critical'
                      ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-sm'
                      : sev.key === 'high'
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm'
                      : sev.key === 'medium'
                      ? 'bg-yellow-500/25 text-yellow-300 border-yellow-500/40 shadow-sm'
                      : 'bg-cyan-500/25 text-cyan-200 border-cyan-400/40 shadow-sm'
                    : 'bg-[#060D1E]/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>

          {/* Statement Type & Sort Dropdowns */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#060D1E]/95 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 uppercase font-semibold cursor-pointer shadow-inner"
            >
              {types.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#060D1E]/95 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 font-semibold cursor-pointer shadow-inner"
            >
              <option value="severity">Sort: Priority</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="title">Sort: Title</option>
              <option value="category">Sort: Category</option>
            </select>
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none border-t border-slate-800/60">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider mr-1 hidden sm:inline">Category:</span>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const count = cat.key === 'all' ? insights.length : insights.filter(i => i.category === cat.key).length;
            if (count === 0 && cat.key !== 'all') return null;

            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 border ${
                  selectedCategory === cat.key
                    ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/15 text-amber-200 border-amber-400/50 shadow-sm'
                    : 'bg-[#060D1E]/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/40 text-slate-400 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Insights Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredInsights.map((ins) => {
          const isAdded = addedIds.has(ins.id);
          const isCopied = copiedId === ins.id;
          const isCritical = ins.severity === 'critical' || ins.severity === 'high';

          const topAccentGradient = ins.severity === 'critical'
            ? 'from-rose-500 via-orange-500 to-rose-400'
            : ins.severity === 'high'
            ? 'from-amber-500 via-orange-400 to-amber-500'
            : ins.severity === 'medium'
            ? 'from-yellow-500 via-cyan-400 to-blue-500'
            : 'from-blue-600 via-cyan-400 to-indigo-500';

          const cardAccent = isCritical ? 'card-accent-rose' : 'card-accent-cyan';

          return (
            <Card3D
              key={ins.id}
              maxTilt={6}
              scale={1.01}
              perspective={1000}
              className={`p-0 rounded-2xl glass-3d-card flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-300 group border border-slate-800/80 ${cardAccent}`}
            >
              {/* Top severity accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${topAccentGradient} opacity-90`} />

              <div className="p-4 sm:p-5 pt-5 sm:pt-6 space-y-3.5 flex-1">
                {/* Header: badges + severity */}
                <div className="flex items-start justify-between gap-2 translate-z-15">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono ${
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
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800 flex items-center gap-1 font-mono">
                      {getCategoryIcon(ins.category)}
                      <span>{ins.category.replace('_', ' ')}</span>
                    </span>
                    {ins.source_table && (
                      <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-800/40">
                        {ins.source_table}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Confidence Meter Badge */}
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" title="Mathematical Certainty">
                      {(ins.confidence * 100).toFixed(0)}% Certain
                    </span>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 border ${
                        ins.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                          : ins.severity === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : ins.severity === 'medium'
                          ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                      }`}
                    >
                      {ins.severity}
                    </span>
                  </div>
                </div>

                {/* Title & description */}
                <h3 className="font-extrabold text-sm sm:text-base text-white leading-snug tracking-tight translate-z-20">
                  {ins.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed translate-z-10">{ins.description}</p>

                {/* Strategic Context & Action directive */}
                <div className="p-3.5 rounded-xl bg-[#060D1E]/95 border border-slate-800/80 space-y-2.5 text-xs shadow-inner translate-z-15">
                  <div className="text-slate-300 leading-relaxed">
                    <strong className="text-cyan-300 block mb-1 font-semibold text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                      <Target className="w-3 h-3 text-cyan-400" />
                      Strategic Context
                    </strong>
                    {ins.why_it_matters}
                  </div>
                  {ins.recommendation && (
                    <div className="text-slate-300 pt-2.5 mt-2 border-t border-slate-800/80 leading-relaxed">
                      <strong className="text-emerald-400 block mb-1 font-semibold text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Recommended Directive
                      </strong>
                      {ins.recommendation}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Action Footer */}
              <div className="px-4 sm:px-5 py-3 border-t border-slate-800/70 bg-[#060D1E]/60 flex items-center justify-between text-xs translate-z-20 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {/* Inspect Proof */}
                  <button
                    onClick={() => setExplainingInsight(ins)}
                    className="text-slate-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition group/btn text-[11px]"
                    title="View mathematical calculation payload"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-400/80 group-hover/btn:text-cyan-300 transition" />
                    <span>Inspect Proof</span>
                  </button>

                  <span className="text-slate-700">•</span>

                  {/* Ask Nova */}
                  <button
                    onClick={() => handleAskNova(ins)}
                    className="text-slate-400 hover:text-purple-300 font-semibold flex items-center gap-1 transition text-[11px]"
                    title="Open Nova AI Assistant with this insight"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Ask Nova</span>
                  </button>

                  <span className="text-slate-700">•</span>

                  {/* Copy */}
                  <button
                    onClick={() => handleCopyInsight(ins)}
                    className="text-slate-400 hover:text-slate-200 transition text-[11px] flex items-center gap-1"
                    title="Copy Markdown"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Add to Briefing Button */}
                <button
                  onClick={() => handleAddToReport(ins)}
                  disabled={isAdded}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isAdded
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                      : 'btn-3d-secondary text-slate-200 hover:text-white'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>In Report</span>
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
          <div className="col-span-full empty-state-premium">
            <div className="empty-state-icon-wrap" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(251,191,36,0.25)' }}>
              <Lightbulb className="w-6 h-6 text-amber-400/70" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">No Matching Strategic Findings</h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              No insights match the active filters or search terms. Reset criteria to inspect all discovered intelligence.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedType('all');
                setSelectedSeverity('all');
                setSearchQuery('');
              }}
              className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Provenance & Mathematical Proof Modal ── */}
      {explainingInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="glass-3d-elevated border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-fadeIn bg-[#081125]/98">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="dept-section-icon dept-section-icon-cyan" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem' }}>
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Insight Provenance & Verification</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Deterministic mathematical proof chain</p>
                </div>
              </div>
              <button
                onClick={() => setExplainingInsight(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 rounded-xl bg-[#060D1D]/95 border border-slate-800/90">
                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider block mb-1">Verified Conclusion</span>
                <p className="font-bold text-white text-sm">{explainingInsight.title}</p>
                <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{explainingInsight.description}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#060D1D]/95 border border-slate-800/90">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Calculation Details & Telemetry</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">RAW PAYLOAD</span>
                </div>
                <pre className="text-cyan-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap p-3 rounded-lg bg-black/60 border border-slate-800/80 leading-relaxed max-h-48">
                  {JSON.stringify(explainingInsight.calculation_details || {}, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#060D1D]/95 border border-slate-800/90">
                  <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider block mb-1">Source Table</span>
                  <p className="font-mono text-cyan-300 text-xs font-bold">{explainingInsight.source_table || 'Primary Dataset'}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono truncate" title={explainingInsight.source_columns?.join(', ')}>
                    Cols: {explainingInsight.source_columns?.join(', ') || 'N/A'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#060D1D]/95 border border-slate-800/90">
                  <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider block mb-1">Statistical Certainty</span>
                  <p className="text-emerald-400 font-bold font-mono text-sm">
                    {(explainingInsight.confidence * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Verified deterministic confidence</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#060D1D]/80 flex items-center justify-between">
              <button
                onClick={() => {
                  handleAskNova(explainingInsight);
                  setExplainingInsight(null);
                }}
                className="btn-3d-secondary px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-300 flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Discuss with Nova AI</span>
              </button>

              <button
                onClick={() => setExplainingInsight(null)}
                className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-semibold text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
