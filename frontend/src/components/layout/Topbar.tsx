import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  Sparkles,
  Database,
  FileSpreadsheet,
  Headphones,
  Sliders,
  Bot,
  LogOut,
  User,
  ChevronDown,
  GraduationCap,
  KeyRound,
  MonitorDown,
  Laptop,
  Smartphone,
  Menu,
  MoreHorizontal,
  Layers,
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { useAuth } from '../../store/authContext';
import { api } from '../../services/api';
import { AudioBriefModal } from '../analysis/AudioBriefModal';
import { ScenarioPlannerModal } from '../analysis/ScenarioPlannerModal';
import { UserProfileModal } from '../auth/UserProfileModal';
import { MobileAccessModal } from '../common/MobileAccessModal';

interface TopbarProps {
  onOpenUpload: () => void;
  onOpenTutorial: () => void;
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenUpload, onOpenTutorial, onToggleMobileMenu }) => {
  const { currentDataset, activeTab, setActiveTab } = useWorkspace();
  const { user, logout } = useAuth();
  const [isAudioBriefOpen, setIsAudioBriefOpen] = useState<boolean>(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choiceResult = await installPrompt.userChoice;
    if (choiceResult?.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickExport = () => {
    if (!currentDataset) return;
    window.open(api.getReportPdfUrl(currentDataset.id), '_blank');
  };

  const getDomainStyle = (domain?: string) => {
    const d = (domain || '').toLowerCase();
    if (d.includes('retail') || d.includes('commerce') || d.includes('sales')) {
      return {
        pill: 'bg-blue-500/10 text-blue-300 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
        dot: 'bg-blue-400'
      };
    }
    if (d.includes('hr') || d.includes('people') || d.includes('employee')) {
      return {
        pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        dot: 'bg-emerald-400'
      };
    }
    if (d.includes('bank') || d.includes('finance') || d.includes('money')) {
      return {
        pill: 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
        dot: 'bg-amber-400'
      };
    }
    if (d.includes('health') || d.includes('medical') || d.includes('pharma')) {
      return {
        pill: 'bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
        dot: 'bg-rose-400'
      };
    }
    if (d.includes('edu')) {
      return {
        pill: 'bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
        dot: 'bg-purple-400'
      };
    }
    return {
      pill: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]',
      dot: 'bg-cyan-400'
    };
  };

  const domainStyle = getDomainStyle(currentDataset?.detected_domain);

  return (
    <>
      <header className="h-14 pt-[env(safe-area-inset-top,0px)] border-b border-white/[0.08] bg-[#070F22]/90 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between z-30 select-none shadow-[0_4px_24px_rgba(0,0,0,0.35)] relative shrink-0">
        {/* Subtle Top Glowing Cyber Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent blur-[1px] pointer-events-none" />

        {/* Left: Dataset info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          {/* Mobile hamburger */}
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-cyan-300 hover:text-white md:hidden shrink-0 active:scale-95 transition-transform"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {currentDataset ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-indigo-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-[#070F22] shadow-[0_0_6px_#34d399]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1
                    className="font-bold text-xs sm:text-sm text-white tracking-tight truncate max-w-[120px] sm:max-w-[220px] md:max-w-[320px] xl:max-w-[420px]"
                    title={currentDataset.name}
                  >
                    {currentDataset.name}
                  </h1>
                  {currentDataset.detected_domain && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border font-mono whitespace-nowrap shrink-0 hidden sm:inline-flex items-center gap-1 ${domainStyle.pill}`}>
                      <span className={`w-1 h-1 rounded-full ${domainStyle.dot}`} />
                      {currentDataset.detected_domain}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono whitespace-nowrap leading-none mt-0.5">
                  <div className="flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">
                    <Database className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-100 font-semibold">{currentDataset.row_count.toLocaleString()}</span>
                    <span className="text-slate-500">rows</span>
                  </div>
                  <span className="text-slate-600">&bull;</span>
                  <div className="flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">
                    <span className="text-slate-100 font-semibold">{currentDataset.column_count}</span>
                    <span className="text-slate-500">cols</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 md:hidden">
                <span className="font-extrabold text-xs text-white tracking-tight">DATOVA</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 leading-none">
                  QUANTUM
                </span>
              </div>
              <span className="truncate hidden md:inline text-slate-300 text-xs">
                Select or ingest a dataset to start autonomous intelligence profiling
              </span>
            </div>
          )}
        </div>

        {/* Right: Primary actions + More dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Ingest */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-cyan-500/10 text-slate-200 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 text-xs font-semibold transition-all duration-150 shadow-sm active:scale-95 group cursor-pointer"
            title="Ingest CSV or Excel dataset"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Ingest</span>
          </button>

          {currentDataset && (
            <button
              onClick={handleQuickExport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_22px_rgba(6,182,212,0.6)] border border-cyan-400/40 transition-all duration-150 active:scale-95 group cursor-pointer"
              title="Export executive PDF dossier"
            >
              <Download className="w-3.5 h-3.5 text-white group-hover:translate-y-0.5 transition-transform" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* ··· More dropdown (secondary actions) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-slate-800/80 active:scale-95 transition-all duration-150 cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#070F22]/95 border border-cyan-500/20 backdrop-blur-xl p-2 z-50 animate-fadeIn space-y-1 shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
                {currentDataset && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); setIsAudioBriefOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/15 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Headphones className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Audio Brief</span>
                      <span className="ml-auto text-[9px] font-mono text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/30">AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); setIsScenarioOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 hover:text-white hover:bg-cyan-500/15 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>What-If Scenario</span>
                      <span className="ml-auto text-[9px] font-mono text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">SIM</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); onOpenTutorial(); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-white hover:bg-slate-800/80 transition flex items-center gap-2 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>3D Guided Tour</span>
                  <span className="ml-auto text-[9px] font-mono text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">NOVA</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); setIsMobileModalOpen(true); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Phone & Tablet</span>
                  <span className="ml-auto text-[9px] font-mono text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">WI-FI</span>
                </button>

                {installPrompt && (
                  <button
                    type="button"
                    onClick={() => { setIsMoreMenuOpen(false); handleInstallApp(); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-emerald-300 hover:text-white hover:bg-emerald-500/15 transition flex items-center gap-2 cursor-pointer"
                  >
                    <MonitorDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Install Desktop App</span>
                  </button>
                )}

                {isStandalone && (
                  <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-cyan-400 font-mono">
                    <Laptop className="w-3.5 h-3.5" />
                    <span>App Mode Active</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Account Chip */}
          {user && (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-2.5 sm:py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-400/60 hover:bg-slate-800/80 transition-all duration-150 text-xs font-medium shadow-sm active:scale-95 cursor-pointer"
                title="Account and Session details"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.35)]">
                  {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <span className="text-white font-bold text-xs max-w-[110px] truncate">{user.full_name}</span>
                  <span className="text-[10px] text-cyan-400 font-mono max-w-[110px] truncate">{user.email}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#070F22]/95 border border-cyan-500/20 backdrop-blur-xl p-3 z-50 animate-fadeIn shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
                  <div className="p-3 rounded-xl bg-[#050B17] border border-slate-800/80 mb-2.5 space-y-1.5">
                    <div className="text-xs font-bold text-white truncate">{user.full_name}</div>
                    <div className="text-[11px] text-cyan-300 font-mono truncate flex items-center gap-1">
                      <span className="text-slate-400">User:</span>
                      <span>{user.email}</span>
                    </div>
                    <div className="pt-1 flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        user.role === 'Student'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {user.role === 'Student' && <GraduationCap className="w-3 h-3 text-emerald-400" />}
                        <span>{user.role || 'Data Analyst'}</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => { setIsProfileMenuOpen(false); setIsProfileModalOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:text-white hover:bg-cyan-500/15 border border-cyan-500/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit Role & Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsProfileMenuOpen(false); setActiveTab('settings'); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>System & AI Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsProfileMenuOpen(false); logout(); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Modals outside header */}
      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <MobileAccessModal isOpen={isMobileModalOpen} onClose={() => setIsMobileModalOpen(false)} />
      {currentDataset && (
        <>
          <AudioBriefModal datasetId={currentDataset.id} datasetName={currentDataset.name} isOpen={isAudioBriefOpen} onClose={() => setIsAudioBriefOpen(false)} />
          <ScenarioPlannerModal datasetId={currentDataset.id} datasetName={currentDataset.name} isOpen={isScenarioOpen} onClose={() => setIsScenarioOpen(false)} />
        </>
      )}
    </>
  );
};
