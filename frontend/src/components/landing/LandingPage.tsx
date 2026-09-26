import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  ArrowRight,
  Database,
  BarChart3,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Zap,
  ShoppingCart,
  Users,
  Landmark,
  GraduationCap,
  Loader2,
  FileUp,
  Cpu,
  TrendingUp,
  Check,
  Bot,
  Search,
  Clock,
  Activity,
  Trash2,
  FolderOpen,
  Filter,
  X
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { useAuth } from '../../store/authContext';
import { api } from '../../services/api';
import { SampleDatasetMeta } from '../../types';
import { Card3D } from '../common/Card3D';
import { DataGalaxy3D } from '../common/DataGalaxy3D';
import { NovaHero3D } from './NovaHero3D';

interface LandingPageProps {
  onOpenUpload: () => void;
  onOpenTutorial?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenUpload, onOpenTutorial }) => {
  const { user } = useAuth();
  const { selectDatasetById, refreshDatasetList, datasetList } = useWorkspace();
  const [samples, setSamples] = useState<SampleDatasetMeta[]>([]);
  const [loadingSampleKey, setLoadingSampleKey] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isDroppingUpload, setIsDroppingUpload] = useState<boolean>(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null);
  const [openingDatasetId, setOpeningDatasetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User-isolated search history storage key based on user's Gmail/email
  const userSearchHistoryKey = user?.email
    ? `datanova_search_queries_${user.email.trim().toLowerCase()}`
    : 'datanova_search_queries_guest';

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(userSearchHistoryKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reload search queries if account changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(userSearchHistoryKey);
      setRecentSearches(saved ? JSON.parse(saved) : []);
    } catch {
      setRecentSearches([]);
    }
  }, [userSearchHistoryKey]);

  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(userSearchHistoryKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent search query:', e);
      }
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, termToRemove: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.toLowerCase() !== termToRemove.toLowerCase());
      try {
        localStorage.setItem(userSearchHistoryKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update recent searches:', e);
      }
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(userSearchHistoryKey);
    } catch (e) {
      console.warn('Failed to clear recent searches:', e);
    }
  };

  useEffect(() => {
    api.listSamples().then(setSamples).catch(console.error);
  }, []);

  const handleLoadSample = async (key: string) => {
    try {
      setLoadingSampleKey(key);
      const sampleMeta = samples.find((s) => s.key === key);
      const existing = sampleMeta?.dataset_id
        ? datasetList.find((d) => d.id === sampleMeta.dataset_id)
        : datasetList.find((d) => sampleMeta && d.name.startsWith(sampleMeta.name));
      if (existing) {
        await selectDatasetById(existing.id);
        return;
      }
      const newDataset = await api.loadSample(key);
      await refreshDatasetList();
      await selectDatasetById(newDataset.id);
    } catch (err) {
      console.error('Failed to load sample:', err);
    } finally {
      setLoadingSampleKey(null);
    }
  };

  const handleDropFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    try {
      setIsDroppingUpload(true);
      setDropError(null);
      const newDataset = await api.uploadFiles(fileArray);
      await refreshDatasetList();
      await selectDatasetById(newDataset.id);
    } catch (err: any) {
      setDropError(err.message || 'Upload failed. Please try again.');
      setIsDroppingUpload(false);
    }
  };

  const onDragOverHandler = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeaveHandler = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  };

  const handleOpenDataset = async (id: string) => {
    try {
      setOpeningDatasetId(id);
      await selectDatasetById(id);
    } catch (err) {
      console.error('Failed to open dataset:', err);
    } finally {
      setOpeningDatasetId(null);
    }
  };

  const handleDeleteDataset = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove "${name}" from your dataset history?`)) return;
    try {
      setDeletingDatasetId(id);
      await api.deleteDataset(id);
      await refreshDatasetList();
    } catch (err) {
      console.error('Failed to delete dataset:', err);
    } finally {
      setDeletingDatasetId(null);
    }
  };

  const uniqueDomains = Array.from(
    new Set(datasetList.map((d) => d.detected_domain).filter(Boolean))
  );

  const filteredHistory = datasetList.filter((d) => {
    const query = historySearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.detected_domain && d.detected_domain.toLowerCase().includes(query));
    const matchesDomain =
      selectedDomainFilter === 'all' || d.detected_domain === selectedDomainFilter;
    return matchesSearch && matchesDomain;
  });

  const getSampleIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShoppingCart':
        return (
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/35 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition shadow-lg shadow-indigo-500/20 translate-z-20">
            <ShoppingCart className="w-5 h-5" />
          </div>
        );
      case 'Users':
        return (
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition shadow-lg shadow-emerald-500/20 translate-z-20">
            <Users className="w-5 h-5" />
          </div>
        );
      case 'Landmark':
        return (
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 group-hover:scale-110 transition shadow-lg shadow-amber-500/20 translate-z-20">
            <Landmark className="w-5 h-5" />
          </div>
        );
      case 'GraduationCap':
        return (
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-500/35 flex items-center justify-center text-sky-400 group-hover:scale-110 transition shadow-lg shadow-sky-500/20 translate-z-20">
            <GraduationCap className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-brand-500/20 border border-brand-500/35 flex items-center justify-center text-brand-400 group-hover:scale-110 transition shadow-lg shadow-brand-500/20 translate-z-20">
            <Database className="w-5 h-5" />
          </div>
        );
    }
  };

  const getDomainColor = (domain: string) => {
    const d = domain.toLowerCase();
    if (d.includes('retail') || d.includes('commerce')) return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    if (d.includes('hr') || d.includes('people')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (d.includes('bank') || d.includes('finance')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (d.includes('edu')) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    return 'bg-brand-500/15 text-brand-300 border-brand-500/30';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent text-slate-100 p-3 sm:p-6 md:p-10 lg:p-14 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-28 relative perspective-1000">
      {/* 3D WebGL Neural Particle Constellation Background */}
      <DataGalaxy3D className="opacity-40" particleCount={160} />

      {/* Hidden File Input for Direct Dropzone Click */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".csv,.xlsx,.xls,.tsv,.zip"
        className="hidden"
        onChange={(e) => e.target.files && handleDropFiles(e.target.files)}
      />

      <div className="max-w-5xl mx-auto space-y-8 sm:space-y-16 relative z-10">
        {/* Ambient Top Spatial Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-b from-blue-600/15 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Hero Section */}
        <div className="text-center space-y-4 sm:space-y-6 pt-1 sm:pt-4">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-slate-900/80 border border-blue-500/30 text-[11px] sm:text-xs font-semibold text-cyan-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] backdrop-blur-xl hover:scale-105 transition-transform max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
            <span className="tracking-wide truncate">Autonomous AI Intelligence Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono shrink-0">v3.0</span>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15] drop-shadow-2xl px-2">
            Your data has a story.{' '}
            <br className="hidden sm:inline" />
            <span className="gradient-text">Let AI discover it.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-300 text-xs sm:text-base lg:text-lg leading-relaxed font-normal px-2">
            Upload any raw CSV or Excel file. Instantly uncover statistical anomalies,
            compute domain-tailored KPIs, build multi-sheet dashboards, and explore multi-dimensional 3D cluster galaxies.
          </p>

          {/* Interactive 3D Nova AI Hero Guide */}
          <NovaHero3D />

          {/* Interactive 3D Hero Dropzone */}
          <div className="max-w-xl mx-auto pt-2">
            <Card3D
              maxTilt={8}
              perspective={1200}
              scale={1.01}
              glareMaxOpacity={0.3}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOverHandler}
              onDragLeave={onDragLeaveHandler}
              onDrop={onDropHandler}
              className={`p-4 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 backdrop-blur-2xl glass-3d-card ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_40px_rgba(14,165,233,0.4)] scale-[1.02]'
                  : 'border-slate-700/80 hover:border-cyan-500/60 shadow-2xl'
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

              {isDroppingUpload ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-3 translate-z-20">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">Ingesting & Profiling Dataset...</p>
                    <p className="text-xs text-slate-400 mt-1">Executing deterministic schema discovery & 3D health audit</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3.5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/30 via-indigo-500/25 to-cyan-400/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_8px_25px_rgba(6,182,212,0.3)] translate-z-30 group-hover:scale-110 transition duration-300">
                    <FileUp className="w-8 h-8" />
                  </div>
                  
                  <div className="text-center space-y-1 translate-z-20">
                    <p className="text-base font-bold text-white group-hover:text-cyan-300 transition tracking-tight">
                      Drag & Drop CSV, Excel, or Zip Here
                    </p>
                    <p className="text-xs text-slate-400">
                      or click to browse from your computer • Instant 3D Schema Synthesis
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 translate-z-15">
                    {['.CSV', '.XLSX', '.TSV', '.ZIP'].map((ext) => (
                      <span
                        key={ext}
                        className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-700/80 shadow-sm"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {dropError && (
                <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center translate-z-15">
                  {dropError}
                </div>
              )}
            </Card3D>

            {/* Quick Action Link */}
            <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
              <button
                onClick={onOpenUpload}
                className="text-xs text-slate-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition"
              >
                <span>Advanced Upload Options</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-slate-700">•</span>
              <a
                href="#history"
                className="text-xs text-slate-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search History</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                  {datasetList.length} Datasets
                </span>
              </a>
              <span className="text-slate-700">•</span>
              <a
                href="#samples"
                className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1.5 transition"
              >
                <span>Explore Demo Datasets</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">4 Samples</span>
              </a>
              {onOpenTutorial && (
                <>
                  <span className="text-slate-700">•</span>
                  <button
                    onClick={onOpenTutorial}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 transition group px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 hover:border-cyan-400/50 shadow-sm shadow-cyan-500/10"
                  >
                    <Bot className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition animate-pulse" />
                    <span>Meet Nova: 3D Robot Tour</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3D Enterprise Proof Points Strip */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <Card3D maxTilt={10} scale={1.03} className="p-3.5 rounded-2xl glass-3d-card text-center border border-slate-700/70">
              <div className="text-sm font-extrabold text-white translate-z-15">100% Deterministic</div>
              <div className="text-[11px] text-slate-400 mt-0.5 translate-z-10">Zero Fabricated Numbers</div>
            </Card3D>

            <Card3D maxTilt={10} scale={1.03} className="p-3.5 rounded-2xl glass-3d-card text-center border border-slate-700/70">
              <div className="text-sm font-extrabold text-cyan-300 translate-z-15">7+ Domains</div>
              <div className="text-[11px] text-slate-400 mt-0.5 translate-z-10">Universal Schema Inference</div>
            </Card3D>

            <Card3D maxTilt={10} scale={1.03} className="p-3.5 rounded-2xl glass-3d-card text-center border border-slate-700/70">
              <div className="text-sm font-extrabold text-emerald-400 translate-z-15">IQR & Z-Score</div>
              <div className="text-[11px] text-slate-400 mt-0.5 translate-z-10">Statistical Anomaly Engine</div>
            </Card3D>

            <Card3D maxTilt={10} scale={1.03} className="p-3.5 rounded-2xl glass-3d-card text-center border border-slate-700/70">
              <div className="text-sm font-extrabold text-purple-400 translate-z-15">Spatial 3D</div>
              <div className="text-[11px] text-slate-400 mt-0.5 translate-z-10">Interactive Cluster Galaxy</div>
            </Card3D>
          </div>
        </div>

        {/* 3D Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card3D
            maxTilt={12}
            className="p-6 rounded-2xl glass-3d-card space-y-3.5 shadow-xl border border-slate-700/70 group"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent pointer-events-none" />
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/35 flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-500/20 translate-z-25 group-hover:scale-110 transition">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-indigo-200 transition translate-z-15">
              Universal & Domain-Agnostic
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed translate-z-10">
              Dynamically discovers context whether your files are from Retail, HR, Banking, Education, Logistics, or Healthcare.
            </p>
          </Card3D>

          <Card3D
            maxTilt={12}
            className="p-6 rounded-2xl glass-3d-card space-y-3.5 shadow-xl border border-slate-700/70 group"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent pointer-events-none" />
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/20 translate-z-25 group-hover:scale-110 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-emerald-200 transition translate-z-15">
              100% Deterministic Engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed translate-z-10">
              Zero fabricated metrics. Calculations are performed server-side with Pandas and NumPy, then explained with full mathematical provenance.
            </p>
          </Card3D>

          <Card3D
            maxTilt={12}
            className="p-6 rounded-2xl glass-3d-card space-y-3.5 shadow-xl border border-slate-700/70 group"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent pointer-events-none" />
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/20 translate-z-25 group-hover:scale-110 transition">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-cyan-200 transition translate-z-15">
              Interactive & Editable
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed translate-z-10">
              Never get locked into static images. Edit chart types, axes, aggregations, cross-table joins, and export custom executive PDFs.
            </p>
          </Card3D>
        </div>

        {/* User Dataset Search History Section */}
        <div id="history" className="space-y-6 pt-6 scroll-mt-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Workspace Memory & History</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px] font-mono">
                    {datasetList.length} Datasets
                  </span>
                </div>
                {user?.email && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/25 text-[11px] text-cyan-300 font-mono shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Gmail: {user.email}</span>
                  </div>
                )}
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Your Datasets & Search History</span>
              </h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Personalized for <span className="text-cyan-300 font-semibold">{user?.email || 'your account'}</span>. Your dataset history and searches are private and isolated—never mingled with other users.
              </p>
            </div>

            {/* Search Input & Isolated Recent Searches */}
            <div className="flex flex-col gap-2 min-w-[260px] sm:min-w-[340px]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveRecentSearch(historySearchQuery);
                    }
                  }}
                  onBlur={() => {
                    if (historySearchQuery.trim().length >= 2) {
                      saveRecentSearch(historySearchQuery);
                    }
                  }}
                  placeholder="Search history by name or domain..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#070F1E] border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* User-Isolated Search History Tags */}
              {recentSearches.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    Recent:
                  </span>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setHistorySearchQuery(term)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] transition group ${
                        historySearchQuery.toLowerCase() === term.toLowerCase()
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300'
                      }`}
                      title={`Filter by "${term}"`}
                    >
                      <span>{term}</span>
                      <span
                        onClick={(e) => removeRecentSearch(e, term)}
                        className="opacity-50 hover:opacity-100 hover:text-rose-400 p-0.5"
                        title="Remove from search history"
                      >
                        <X className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearAllRecentSearches}
                    className="text-slate-500 hover:text-slate-300 text-[10px] ml-1 underline transition"
                    title="Clear recent searches for this account"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Domain Filter Pills (if multiple domains exist) */}
          {uniqueDomains.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] text-slate-500 uppercase font-mono tracking-wider shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDomainFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                  selectedDomainFilter === 'all'
                    ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All ({datasetList.length})
              </button>
              {uniqueDomains.map((dom) => {
                const count = datasetList.filter((d) => d.detected_domain === dom).length;
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => setSelectedDomainFilter(dom)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                      selectedDomainFilter === dom
                        ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {dom} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Dataset Grid or Empty State */}
          {datasetList.length === 0 ? (
            <Card3D maxTilt={6} className="p-8 rounded-2xl glass-3d-card border border-slate-800/90 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400 mx-auto shadow-inner">
                <FolderOpen className="w-6 h-6 opacity-80" />
              </div>
              <h4 className="font-bold text-sm text-white">No Previous Datasets In Your Account</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No datasets are associated with <span className="text-cyan-300 font-mono">{user?.email || 'your account'}</span> yet. Drag and drop your files into the upload zone above, or click a demo sample below to get started.
              </p>
            </Card3D>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No saved datasets matched your search for &quot;<span className="text-cyan-300 font-semibold">{historySearchQuery}</span>&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setHistorySearchQuery('');
                  setSelectedDomainFilter('all');
                }}
                className="text-xs text-cyan-400 hover:underline font-semibold"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHistory.map((ds) => {
                const isOpening = openingDatasetId === ds.id;
                const isDeleting = deletingDatasetId === ds.id;
                return (
                  <Card3D
                    key={ds.id}
                    maxTilt={10}
                    scale={1.02}
                    className="glass-3d-card p-4 rounded-2xl border border-slate-700/80 flex flex-col justify-between group shadow-lg hover:border-cyan-500/50 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 translate-z-15 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition shrink-0">
                            <Database className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <h4 className="font-bold text-xs text-white group-hover:text-cyan-300 transition truncate" title={ds.name}>
                              {ds.name}
                            </h4>
                            <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${getDomainColor(ds.detected_domain || 'General')}`}>
                              {ds.detected_domain || 'General'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteDataset(e, ds.id, ds.name)}
                          disabled={isDeleting || isOpening}
                          title="Delete dataset"
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition shrink-0"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                        <div>
                          <span className="text-slate-500 block text-[10px]">RECORDS</span>
                          <span className="text-slate-200 font-semibold">{ds.row_count?.toLocaleString() || 0} rows</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">HEALTH</span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {ds.data_health_score || 95}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {ds.created_at ? new Date(ds.created_at).toLocaleDateString() : 'Active'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenDataset(ds.id)}
                        disabled={isOpening || isDeleting}
                        className="btn-3d-primary px-3 py-1.5 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 group/btn disabled:opacity-50"
                      >
                        {isOpening ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <span>Open Project</span>
                            <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition" />
                          </>
                        )}
                      </button>
                    </div>
                  </Card3D>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive 3D Sample Datasets Section */}
        <div id="samples" className="space-y-6 pt-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 shadow-sm">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Instant Verification</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Test DATOVA AI with Real Multi-Domain Datasets
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Click any dataset below to launch instant automated profiling, 3D health scoring, KPI discovery, and dashboard generation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {samples.map((sample) => {
              const isLoadingThis = loadingSampleKey === sample.key;
              const isLoaded = sample.already_loaded || datasetList.some((d) => d.name.startsWith(sample.name));
              return (
                <Card3D
                  key={sample.key}
                  maxTilt={12}
                  perspective={1000}
                  scale={1.02}
                  className="glass-3d-card p-5 rounded-2xl border border-slate-700/80 flex flex-col justify-between group shadow-xl hover:border-cyan-500/50"
                >
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent pointer-events-none" />
                  
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 translate-z-20">
                        {getSampleIcon(sample.icon)}
                        <div>
                          <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition">
                            {sample.name}
                          </h4>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getDomainColor(
                              sample.domain
                            )}`}
                          >
                            {sample.domain}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-700/80 translate-z-15 shadow-sm">
                        {sample.rows} rows • {sample.cols} cols
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed translate-z-10">
                      {sample.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between translate-z-15">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{sample.filename}</span>
                      </span>
                      {isLoaded && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>In Workspace</span>
                        </span>
                      )}
                    </div>
                    <button
                      data-tour={sample.key === 'retail' ? 'load-sample-retail' : `load-sample-${sample.key}`}
                      onClick={() => handleLoadSample(sample.key)}
                      disabled={loadingSampleKey !== null || isDroppingUpload}
                      className="btn-3d-primary px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing Dataset...</span>
                        </>
                      ) : isLoaded ? (
                        <>
                          <span>Resume Sample</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </>
                      ) : (
                        <>
                          <span>Load Sample</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </>
                      )}
                    </button>
                  </div>
                </Card3D>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
