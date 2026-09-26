import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Lightbulb,
  Database,
  FileText,
  Settings,
  Upload,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Zap,
  TrendingUp,
  Target,
  Wand2,
  Terminal,
  BrainCircuit,
  Network,
  LogOut,
  GraduationCap,
  KeyRound,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useWorkspace, ActiveTab } from '../../store/workspaceContext';
import { useAuth } from '../../store/authContext';
import { UserProfileModal } from '../auth/UserProfileModal';

interface SidebarProps {
  onOpenUpload: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenUpload,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const {
    currentDataset,
    datasetList,
    activeTab,
    setActiveTab,
    selectDatasetById,
    isLoading
  } = useWorkspace();
  const { user, logout } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState<boolean>(false);

  // Click-to-toggle sidebar â€” no hover expand (cleaner UX, no jank)
  const [isExpanded, setIsExpanded] = React.useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) return false;
      return localStorage.getItem('sidebar-pinned') === 'true';
    } catch { return false; }
  });

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try { localStorage.setItem('sidebar-pinned', String(next)); } catch {}
  };

  // Icon color helper
  const iconColor = (tab: ActiveTab): string => {
    const map: Partial<Record<ActiveTab, string>> = {
      overview: 'text-blue-400', dashboard: 'text-cyan-400', insights: 'text-amber-400',
      forecast: 'text-emerald-400', clusters: 'text-purple-400', automl: 'text-cyan-400',
      dataprep: 'text-pink-400', model: 'text-indigo-400', sql: 'text-teal-400',
      data: 'text-indigo-400', chat: 'text-blue-400', report: 'text-slate-300', settings: 'text-slate-400',
    };
    return map[tab] || 'text-slate-400';
  };

  const navSections: Array<{
    title: string;
    items: Array<{ tab: ActiveTab; label: string; icon: React.ReactNode; badge?: string; badgeClass?: string }>;
  }> = [
    {
      title: 'Core Intelligence',
      items: [
        { tab: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4 text-blue-400" /> },
        { tab: 'dashboard', label: 'Dashboard', icon: <LineChart className="w-4 h-4 text-cyan-400" /> },
        { tab: 'insights', label: 'Insights', icon: <Lightbulb className="w-4 h-4 text-amber-400" />, badge: '3D NOVA', badgeClass: 'badge-neon-amber' },
      ]
    },
    {
      title: 'Predictive & ML',
      items: [
        { tab: 'forecast', label: 'Predictive Studio', icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, badge: 'ML', badgeClass: 'badge-neon-emerald' },
        { tab: 'clusters', label: 'ML Segments', icon: <Target className="w-4 h-4 text-purple-400" />, badge: 'AI', badgeClass: 'badge-neon-purple' },
        { tab: 'automl', label: 'AutoML Studio', icon: <BrainCircuit className="w-4 h-4 text-cyan-400" />, badge: 'NEW', badgeClass: 'badge-neon-blue' },
      ]
    },
    {
      title: 'Data Engineering',
      items: [
        { tab: 'dataprep', label: 'Data Prep', icon: <Wand2 className="w-4 h-4 text-pink-400" /> },
        { tab: 'model', label: 'Model Studio', icon: <Network className="w-4 h-4 text-indigo-400" />, badge: 'E-ER', badgeClass: 'badge-neon-purple' },
        { tab: 'sql', label: 'SQL Lab', icon: <Terminal className="w-4 h-4 text-teal-400" />, badge: 'SQL', badgeClass: 'bg-teal-500/20 text-teal-300 border border-teal-500/30' },
        { tab: 'data', label: 'Data Hub', icon: <Database className="w-4 h-4 text-indigo-400" /> },
      ]
    },
    {
      title: 'Executive Output',
      items: [
        { tab: 'report', label: 'Executive Report', icon: <FileText className="w-4 h-4 text-slate-300" /> },
      ]
    }
  ];

  const healthScore = currentDataset?.data_health_score ?? 0;
  const isHealthy = healthScore >= 80;

  const handleItemSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const renderContent = (isMobileView: boolean) => {
    const expanded = isMobileView || isExpanded;
    return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand Header */}
      <div
        className={`flex items-center border-b border-slate-800/80 relative overflow-hidden shrink-0 ${
          isMobileView
            ? 'px-4 pt-[env(safe-area-inset-top,0px)] min-h-[4.25rem] pb-2 justify-between'
            : expanded
            ? 'px-4 h-14 justify-between'
            : 'px-0 h-14 justify-center'
        }`}
        style={{ transition: 'padding 240ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

        {/* Logo */}
        <div className={`flex items-center gap-2.5 min-w-0 ${expanded ? '' : 'justify-center w-full'}`}>
          <div className="relative shrink-0 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_4px_16px_rgba(6,182,212,0.35)] border border-cyan-400/40">
              <Layers className="w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-[#070F22] shadow-[0_0_8px_#34d399]" />
          </div>
          {expanded && (
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white font-sans whitespace-nowrap">DATOVA</span>
                <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40 font-mono whitespace-nowrap">
                  QUANTUM
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide flex items-center gap-1 whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-cyan-400" />
                Autonomous Analytics 2026
              </p>
            </div>
          )}
        </div>

        {/* Pin toggle (desktop expanded) or Close (mobile) */}
        {isMobileView ? (
          <button type="button" onClick={onCloseMobile} className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white transition shrink-0 active:scale-95" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        ) : expanded ? (
          <button type="button" onClick={toggleExpand} className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800/60 transition shrink-0" title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}>
            {isExpanded ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
        ) : null}
      </div>

      {/* Dataset Pill â€” collapsed: upload icon only */}
      <div className={`border-b border-slate-800/80 shrink-0 ${expanded ? 'p-3 space-y-2' : 'py-2 flex flex-col items-center'}`}>
        {expanded ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 font-mono flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-400" />
                Active Corpus
              </span>
              <button
                onClick={() => { onOpenUpload(); if (isMobileView && onCloseMobile) onCloseMobile(); }}
                className="text-[11px] text-cyan-300 hover:text-white font-semibold flex items-center gap-1 transition px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
              >
                <Upload className="w-3 h-3 text-cyan-400" />
                <span>Ingest</span>
              </button>
            </div>
            {datasetList.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={currentDataset?.id || ''}
                  onChange={(e) => { selectDatasetById(e.target.value); if (isMobileView && onCloseMobile) onCloseMobile(); }}
                  disabled={isLoading}
                  className="w-full bg-[#0B1733] border border-blue-900/50 text-slate-100 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-cyan-500 transition truncate shadow-inner cursor-pointer"
                >
                  {datasetList.map((ds) => (
                    <option key={ds.id} value={ds.id} className="bg-[#070F22] text-slate-200">
                      {ds.name} ({ds.row_count.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
                {currentDataset && (
                  <div className="px-2 py-1.5 rounded-lg bg-[#060D1E]/90 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isHealthy ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      <div className="leading-tight">
                        <div className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                          <span>Health</span>
                          <span className={`font-mono ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>{healthScore}%</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">{isHealthy ? 'Production Grade' : 'Anomalies Detected'}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-cyan-300 border border-cyan-500/30">{currentDataset.detected_domain}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#09142B]/80 border border-blue-900/40 text-center space-y-2">
                <p className="text-xs text-slate-300 font-medium">No Active Dataset</p>
                <button onClick={() => { onOpenUpload(); if (isMobileView && onCloseMobile) onCloseMobile(); }} className="btn-3d-primary w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /><span>Ingest Dataset</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <button onClick={onOpenUpload} title="Ingest Dataset" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-800/60 text-cyan-400 transition">
            <Upload className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Sidebar Navigation">
        {navSections.map((section, idx) => (
          <div key={idx} className={expanded ? 'px-2 mb-3' : 'px-1.5 mb-1'}>
            {expanded && (
              <h3 className="px-2 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{section.title}</h3>
            )}
            {!expanded && idx > 0 && <div className="my-1 h-px bg-slate-800/60 mx-2" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.tab;
                const color = iconColor(item.tab);
                return (
                  <button
                    key={item.tab}
                    onClick={() => handleItemSelect(item.tab)}
                    title={!expanded ? item.label : undefined}
                    className={`group relative rounded-xl flex items-center ${
                      expanded ? 'w-full justify-between px-3 py-2 text-xs font-semibold gap-2.5' : 'w-9 h-9 justify-center mx-auto'
                    } ${
                      isActive ? 'btn-3d-primary text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)]' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                    style={{ transition: 'background 140ms ease, color 140ms ease, box-shadow 200ms ease, transform 160ms cubic-bezier(0.16,1,0.3,1)', willChange: 'transform' }}
                  >
                    {isActive && (
                      <span className={`nav-active-bar absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-cyan-300 shadow-[0_0_10px_#38bdf8] ${expanded ? 'w-1 h-5' : 'w-0.5 h-4'}`} />
                    )}
                    <span className={`shrink-0 group-hover:scale-110 ${isActive ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]' : color}`}>
                      {item.icon}
                    </span>
                    {expanded && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider shrink-0 ${
                            isActive ? 'bg-white/20 text-white border border-white/40' : item.badgeClass || 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>{item.badge}</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className={`border-t border-slate-800/60 bg-[#050C1B]/80 shrink-0 ${
        expanded ? 'p-2.5 space-y-2' : 'py-2 flex flex-col items-center gap-1'
      } ${isMobileView ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : ''}`}>

        {/* Settings */}
        <button
          onClick={() => handleItemSelect('settings')}
          title={!expanded ? 'Settings' : undefined}
          className={`transition flex items-center rounded-xl font-semibold text-xs ${
            expanded ? 'w-full justify-between px-3 py-2' : 'w-9 h-9 justify-center'
          } ${
            activeTab === 'settings' ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            {expanded && <span>Settings</span>}
          </div>
          {expanded && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {/* User */}
        {user && (
          expanded ? (
            <div className="p-2 rounded-xl bg-[#081224] border border-cyan-950/60 flex items-center justify-between">
              <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 min-w-0 flex-1 mr-1 cursor-pointer group hover:opacity-90 transition" title="Edit role & password">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 leading-none">
                    <span className="text-white font-bold text-xs truncate group-hover:text-cyan-300 transition">{user.full_name}</span>
                    {user.role === 'Student' && <GraduationCap className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono truncate leading-none mt-0.5">{user.role || user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => setIsProfileModalOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition" title="Edit Role & Password">
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={logout} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition" title="Sign Out">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setIsProfileModalOpen(true)} title={user.full_name} className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center hover:scale-105 transition">
              {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'}
            </button>
          )
        )}

        {/* Engine status â€” expanded only */}
        {expanded && (
          <div className="px-2 py-1.5 rounded-xl bg-[#081224] border border-blue-950/80 flex items-center justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1 text-slate-300"><Zap className="w-3 h-3 text-cyan-400" />FastAPI</span>
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>
          </div>
        )}
      </div>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </div>
  );
  };

  return (
    <>
      {/* Desktop Collapsible Icon-Rail Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen bg-surface-900/90 backdrop-blur-xl border-r border-white/5 select-none shrink-0 z-20 shadow-glass-card overflow-hidden ${
          isExpanded ? 'w-60' : 'w-14'
        }`}
      style={{ transition: 'width 240ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div onClick={onCloseMobile} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden animate-fadeIn" aria-hidden="true" />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] glass-panel-elevated border-r border-cyan-500/30 flex flex-col h-full select-none shadow-glass-panel transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(true)}
      </aside>
    </>
  );
};
