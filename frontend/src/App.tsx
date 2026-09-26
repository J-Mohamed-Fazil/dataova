import React, { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './store/authContext';
import { WorkspaceProvider, useWorkspace } from './store/workspaceContext';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { LandingPage } from './components/landing/LandingPage';
import { UploadModal } from './components/upload/UploadModal';
import { TutorialGuide } from './components/tutorial/TutorialGuide';
import { NovaFloatingInsightWidget } from './components/common/NovaFloatingInsightWidget';
import { MobileNavBar } from './components/layout/MobileNavBar';
import { Layers } from 'lucide-react';

const OverviewView     = lazy(() => import('./components/overview/OverviewView').then(m => ({ default: m.OverviewView })));
const DashboardView    = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const ForecastView     = lazy(() => import('./components/forecast/ForecastView').then(m => ({ default: m.ForecastView })));
const ClustersView     = lazy(() => import('./components/clusters/ClustersView').then(m => ({ default: m.ClustersView })));
const AutoMLStudioView = lazy(() => import('./components/automl/AutoMLStudioView').then(m => ({ default: m.AutoMLStudioView })));
const DataPrepView     = lazy(() => import('./components/dataprep/DataPrepView').then(m => ({ default: m.DataPrepView })));
const EerModelStudioView = lazy(() => import('./components/model/EerModelStudioView').then(m => ({ default: m.EerModelStudioView })));
const SqlSandboxView   = lazy(() => import('./components/sql/SqlSandboxView').then(m => ({ default: m.SqlSandboxView })));
const InsightsView     = lazy(() => import('./components/insights/InsightsView').then(m => ({ default: m.InsightsView })));
const DataView         = lazy(() => import('./components/data/DataView').then(m => ({ default: m.DataView })));
const AskDatovaView    = lazy(() => import('./components/chat/AskDatovaView').then(m => ({ default: m.AskDatovaView })));
const ReportView       = lazy(() => import('./components/report/ReportView').then(m => ({ default: m.ReportView })));
const SettingsView     = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));

const ViewLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[420px] p-8 space-y-5">
    <div className="relative">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/15 via-blue-500/15 to-indigo-500/15 border border-cyan-500/30 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.7s' }} />
      </div>
      <div className="absolute -inset-2 border border-cyan-400/20 rounded-3xl pointer-events-none" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
    </div>
    <div className="w-56 space-y-2.5">
      <div className="skeleton h-2.5 w-3/4 mx-auto rounded-full" />
      <div className="skeleton h-2 w-1/2 mx-auto rounded-full" />
    </div>
    <div className="text-[11px] text-cyan-400/60 font-mono tracking-widest uppercase">Loading module...</div>
  </div>
);

const MainLayout: React.FC = () => {
  const { currentDataset, activeTab } = useWorkspace();
  const [isUploadOpen, setIsUploadOpen]         = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen]     = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  if (!currentDataset) {
    return (
      <div className="flex h-[100dvh] bg-[#090D16] overflow-hidden relative">
        <Sidebar onOpenUpload={() => setIsUploadOpen(true)} isOpenMobile={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden min-w-0">
          <Topbar onOpenUpload={() => setIsUploadOpen(true)} onOpenTutorial={() => setIsTutorialOpen(true)} onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
          <main className="flex-1 overflow-y-auto flex flex-col pb-6">
            <LandingPage onOpenUpload={() => setIsUploadOpen(true)} onOpenTutorial={() => setIsTutorialOpen(true)} />
          </main>
        </div>
        <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
        <TutorialGuide isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} onOpenUpload={() => setIsUploadOpen(true)} />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#090D16] overflow-hidden relative">
      <Sidebar onOpenUpload={() => setIsUploadOpen(true)} isOpenMobile={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden min-w-0">
        <Topbar onOpenUpload={() => setIsUploadOpen(true)} onOpenTutorial={() => setIsTutorialOpen(true)} onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto flex flex-col pb-20 md:pb-0">
          <Suspense fallback={<ViewLoadingFallback />}>
            <div key={activeTab} className="view-enter flex-1 flex flex-col min-h-0" style={{ willChange: 'transform, opacity' }}>
              {activeTab === 'overview'  && <OverviewView />}
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'forecast'  && <ForecastView />}
              {activeTab === 'clusters'  && <ClustersView />}
              {activeTab === 'automl'    && <AutoMLStudioView />}
              {activeTab === 'dataprep'  && <DataPrepView />}
              {activeTab === 'model'     && <EerModelStudioView />}
              {activeTab === 'sql'       && <SqlSandboxView />}
              {activeTab === 'insights'  && <InsightsView />}
              {activeTab === 'data'      && <DataView />}
              {activeTab === 'chat'      && <AskDatovaView />}
              {activeTab === 'report'    && <ReportView />}
              {activeTab === 'settings'  && <SettingsView />}
            </div>
          </Suspense>
        </main>
      </div>
      <MobileNavBar isMobileMenuOpen={isMobileMenuOpen} onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <TutorialGuide isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} onOpenUpload={() => setIsUploadOpen(true)} />
      <NovaFloatingInsightWidget onOpenUpload={() => setIsUploadOpen(true)} />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#050B17] flex flex-col items-center justify-center space-y-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.45)] border border-cyan-400/50">
            <Layers className="w-8 h-8 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
          </div>
          <div className="absolute -inset-2.5 border border-cyan-400/25 rounded-3xl pointer-events-none" style={{ animation: 'pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite' }} />
        </div>
        <div className="text-center space-y-1.5 view-enter">
          <div className="text-white font-bold tracking-wider text-sm font-sans">DATOVA QUANTUM</div>
          <div className="text-[11px] text-cyan-400/70 font-mono tracking-wide">Restoring encrypted session...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  return (
    <WorkspaceProvider>
      <MainLayout />
    </WorkspaceProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
