import React, { createContext, useContext, useState, useEffect } from 'react';
import { Dataset, DatasetSummary } from '../types';
import { api } from '../services/api';
import { useAuth } from './authContext';

export type ActiveTab = 
  | 'overview' 
  | 'dashboard' 
  | 'forecast' 
  | 'clusters' 
  | 'automl'
  | 'dataprep' 
  | 'model'
  | 'sql' 
  | 'insights' 
  | 'data' 
  | 'chat' 
  | 'report' 
  | 'settings';

interface WorkspaceContextType {
  currentDataset: Dataset | null;
  datasetList: DatasetSummary[];
  activeTab: ActiveTab;
  activeSheetId: string | null;
  isLoading: boolean;
  error: string | null;
  scanningStep: string | null;
  isNovaOpen: boolean;
  selectedVisualContext: any;
  dashboardFilterContext: any;
  pendingNovaPrompt: string | null;
  setIsNovaOpen: (open: boolean) => void;
  toggleNova: () => void;
  setSelectedVisualContext: (vis: any) => void;
  setDashboardFilterContext: (filter: any) => void;
  setPendingNovaPrompt: (prompt: string | null) => void;
  openNovaWithPrompt: (prompt: string, visualContext?: any) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveSheetId: (sheetId: string | null) => void;
  setCurrentDataset: (dataset: Dataset | null) => void;
  selectDatasetById: (id: string) => Promise<void>;
  refreshCurrentDataset: () => Promise<void>;
  refreshDatasetList: (search?: string) => Promise<DatasetSummary[]>;
  setScanningStep: (step: string | null) => void;
  clearError: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentDataset, setCurrentDatasetState] = useState<Dataset | null>(null);
  const [datasetList, setDatasetList] = useState<DatasetSummary[]>([]);
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    return (localStorage.getItem('datova_active_tab') as ActiveTab) || 'overview';
  });
  const [activeSheetId, setActiveSheetIdState] = useState<string | null>(() => {
    return localStorage.getItem('datova_active_sheet_id');
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningStep, setScanningStep] = useState<string | null>(null);

  // Nova 3D AI Analyst State
  const [isNovaOpen, setIsNovaOpen] = useState<boolean>(false);
  const [selectedVisualContext, setSelectedVisualContext] = useState<any>(null);
  const [dashboardFilterContext, setDashboardFilterContext] = useState<any>(null);
  const [pendingNovaPrompt, setPendingNovaPrompt] = useState<string | null>(null);

  const toggleNova = () => {
    setIsNovaOpen((prev) => !prev);
  };

  const openNovaWithPrompt = (prompt: string, visualContext?: any) => {
    if (visualContext) {
      setSelectedVisualContext(visualContext);
    }
    setPendingNovaPrompt(prompt);
    setIsNovaOpen(true);
  };

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    localStorage.setItem('datova_active_tab', tab);
  };

  const setActiveSheetId = (sheetId: string | null) => {
    setActiveSheetIdState(sheetId);
    if (sheetId) {
      localStorage.setItem('datova_active_sheet_id', sheetId);
    } else {
      localStorage.removeItem('datova_active_sheet_id');
    }
  };

  const setCurrentDataset = (dataset: Dataset | null) => {
    setCurrentDatasetState(dataset);
    if (dataset) {
      localStorage.setItem('datova_active_dataset_id', dataset.id);
    } else {
      localStorage.removeItem('datova_active_dataset_id');
      localStorage.removeItem('datova_active_tab');
      localStorage.removeItem('datova_active_sheet_id');
    }
  };

  const refreshDatasetList = async (search?: string): Promise<DatasetSummary[]> => {
    try {
      const list = await api.listDatasets(search);
      setDatasetList(list);
      return list;
    } catch (err: any) {
      console.error('Failed to list datasets:', err);
      return [];
    }
  };

  const selectDatasetById = async (id: string, preserveTab: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const ds = await api.getDataset(id);
      setCurrentDataset(ds);
      if (!preserveTab) {
        setActiveTab('overview');
      }
      await refreshDatasetList();
    } catch (err: any) {
      setError(err.message || 'Failed to select dataset');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCurrentDataset = async () => {
    if (!currentDataset) return;
    try {
      const ds = await api.getDataset(currentDataset.id);
      setCurrentDataset(ds);
    } catch (err: any) {
      console.error('Failed to refresh dataset:', err);
    }
  };

  // Start clean on initial load per requirement: never open with already working data
  // Also cleanly resets and reloads user datasets when account changes
  useEffect(() => {
    const initWorkspace = async () => {
      localStorage.removeItem('datova_active_dataset_id');
      setCurrentDatasetState(null);
      await refreshDatasetList();
    };

    initWorkspace();
  }, [user?.id]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentDataset,
        datasetList,
        activeTab,
        activeSheetId,
        isLoading,
        error,
        scanningStep,
        isNovaOpen,
        selectedVisualContext,
        dashboardFilterContext,
        pendingNovaPrompt,
        setIsNovaOpen,
        toggleNova,
        setSelectedVisualContext,
        setDashboardFilterContext,
        setPendingNovaPrompt,
        openNovaWithPrompt,
        setActiveTab,
        setActiveSheetId,
        setCurrentDataset,
        selectDatasetById,
        refreshCurrentDataset,
        refreshDatasetList,
        setScanningStep,
        clearError: () => setError(null),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
