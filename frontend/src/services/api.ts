import {
  Dataset,
  DatasetSummary,
  AnalysisOverview,
  KpiMetric,
  Insight,
  AnomalyRecord,
  DashboardSheet,
  DashboardChart,
  AIDynamicArchetype,
  AIDiscoveredArchetypesResponse,
  StudioPreviewResult,
  AIChartBlueprint,
  CognitiveThoughtStep,
  MindSpark,
  DeepDiagnosticResult,
  WhatIfSimulationResult,
  ChatMessage,
  ReportDocument,
  ReportSection,
  ExecutiveDashboardReportData,
  SampleDatasetMeta,
  ForecastResult,
  ClusterResult,
  CleanseAuditResult,
  CleansePreviewResult,
  CleansePipelineRequest,
  SqlQueryResult,
  SqlTranslateResult,
  AudioBriefResponse,
  ScenarioConfig,
  ScenarioSimulationResult,
  DriverTreeResponse,
  DriverTreeConfigResponse,
  AutoMLTargetCandidate,
  AutoMLResult,
  AutoMLPrediction,
  ParetoResult,
  RegressionResult,
  FusionCandidateTable,
  FusionEvaluationResult,
  FusionPreviewResult,
  CrossCorrelationResult,
  FusionMaterializeRequest,
  FusionMaterializeResponse,
  EerSchemaGraph,
  EerSimulationResult,
  EerSimulateRequest,
  AuthUser,
  AuthResponse
} from '../types';

const API_BASE = '/api';

export const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = localStorage.getItem('datanova_auth_token');
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && !String(input).includes('/auth/login')) {
    localStorage.removeItem('datanova_auth_token');
    localStorage.removeItem('datanova_user');
  }
  return res;
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('datanova_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // Datasets
  listDatasets: async (search?: string): Promise<DatasetSummary[]> => {
    const q = new URLSearchParams();
    if (search?.trim()) q.append('search', search.trim());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await authFetch(`${API_BASE}/datasets${queryStr}`);
    if (!res.ok) throw new Error('Failed to fetch datasets');
    return res.json();
  },

  getDataset: async (id: string): Promise<Dataset> => {
    const res = await authFetch(`${API_BASE}/datasets/${id}`);
    if (!res.ok) throw new Error('Failed to fetch dataset');
    return res.json();
  },

  deleteDataset: async (id: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete dataset');
  },

  uploadFiles: async (files: File[], name?: string): Promise<Dataset> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (name) formData.append('dataset_name', name);

    const res = await authFetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  updateRelationship: async (datasetId: string, relId: string, status: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/relationships/${relId}?status=${status}`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('Failed to update relationship');
  },

  getTableRows: async (
    datasetId: string,
    tableName: string,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    }
  ): Promise<{
    table_name: string;
    total_rows: number;
    page: number;
    page_size: number;
    total_pages: number;
    columns: string[];
    rows: Record<string, any>[];
  }> => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.pageSize) q.append('page_size', String(params.pageSize));
    if (params?.search) q.append('search', params.search);
    if (params?.sortBy) q.append('sort_by', params.sortBy);
    if (params?.sortDir) q.append('sort_dir', params.sortDir);

    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/tables/${encodeURIComponent(tableName)}/rows?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch table rows');
    return res.json();
  },

  getTableExportCsvUrl: (
    datasetId: string,
    tableName: string,
    params?: { search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }
  ): string => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.sortBy) q.append('sort_by', params.sortBy);
    if (params?.sortDir) q.append('sort_dir', params.sortDir);
    return `${API_BASE}/datasets/${datasetId}/tables/${encodeURIComponent(tableName)}/export-csv?${q.toString()}`;
  },

  // Analysis
  getAnalysisOverview: async (datasetId: string): Promise<AnalysisOverview> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/overview`);
    if (!res.ok) throw new Error('Failed to fetch analysis overview');
    return res.json();
  },

  getCorrelations: async (datasetId: string): Promise<{ table_name: string; correlations: any[] }> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/correlations`);
    if (!res.ok) throw new Error('Failed to fetch correlations');
    return res.json();
  },

  // Dashboard
  getSheets: async (datasetId: string): Promise<DashboardSheet[]> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/sheets`);
    if (!res.ok) throw new Error('Failed to fetch dashboard sheets');
    return res.json();
  },

  createSheet: async (datasetId: string, title: string): Promise<DashboardSheet> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, sheet_type: 'custom' })
    });
    if (!res.ok) throw new Error('Failed to create sheet');
    return res.json();
  },

  updateSheet: async (datasetId: string, sheetId: string, title: string): Promise<DashboardSheet> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/sheets/${sheetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Failed to update sheet');
    return res.json();
  },

  deleteSheet: async (datasetId: string, sheetId: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/sheets/${sheetId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete sheet');
  },

  generateAllDashboards: async (datasetId: string): Promise<DashboardSheet[]> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/generate-all`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate all dashboards');
    return res.json();
  },

  aiGenerateDashboard: async (
    datasetId: string,
    payload: {
      prompt?: string;
      preset?: string;
      palette?: string;
      mode?: 'add_sheet' | 'replace_all';
    }
  ): Promise<DashboardSheet[]> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/ai-generate-dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let detail = 'Failed to generate AI dashboard';
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    return res.json();
  },

  getAIDiscoveredArchetypes: async (datasetId: string): Promise<AIDiscoveredArchetypesResponse> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/ai-discovered-archetypes`);
    if (!res.ok) {
      let detail = 'Failed to discover AI archetypes';
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    return res.json();
  },

  aiAgentGenerateDashboard: async (
    datasetId: string,
    payload?: {
      prompt?: string;
      preset?: string;
      palette?: string;
      mode?: 'add_sheet' | 'replace_all';
    }
  ): Promise<DashboardSheet[]> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/ai-agent-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) {
      let detail = 'Failed to generate AI Agent dashboard';
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    return res.json();
  },

  generateSheetInsights: async (
    datasetId: string,
    sheetId: string,
    payload?: { prompt?: string; preset?: string }
  ): Promise<{ sheet_id: string; business_questions: any[] }> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/sheets/${sheetId}/generate-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) throw new Error('Failed to generate sheet insights');
    return res.json();
  },

  getCorrespondingTables: async (datasetId: string): Promise<any> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/corresponding-tables`);
    if (!res.ok) throw new Error('Failed to fetch corresponding tables');
    return res.json();
  },

  getJoinedPreview: async (
    datasetId: string,
    payload: { primary_table: string; join_table?: string; primary_key?: string; join_key?: string; additional_joins?: any[] }
  ): Promise<{ total_rows: number; total_columns: number; columns: string[]; sample_data: any[] }> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/joined-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to preview joined tables');
    return res.json();
  },

  aiSynthesizeChart: async (
    datasetId: string,
    payload: { prompt: string; target_table?: string; preferred_chart_type?: string }
  ): Promise<{
    title: string;
    description: string;
    chart_type: any;
    table_name: string;
    join_table?: string;
    x_field: string;
    y_field: string;
    secondary_y_field?: string;
    aggregation: string;
    palette: string;
    ai_insight: string;
    strategic_directive?: string;
    thought_process?: CognitiveThoughtStep[];
    mind_sparks?: MindSpark[];
    chart_data: any[];
    summary: any;
    columns: string[];
    total_rows: number;
  }> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/studio/ai-synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to synthesize chart with AI');
    return res.json();
  },

  previewStudioChart: async (
    datasetId: string,
    payload: {
      table_name: string;
      join_table?: string;
      primary_key?: string;
      join_key?: string;
      joins?: any[];
      x_field: string;
      y_field: string;
      secondary_y_field?: string;
      aggregation?: string;
      chart_type: string;
      palette?: string;
      filters?: any[];
    }
  ): Promise<StudioPreviewResult> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/studio/preview-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to preview studio chart');
    return res.json();
  },

  getStudioBlueprints: async (
    datasetId: string
  ): Promise<{ dataset_id: string; blueprints: AIChartBlueprint[] }> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/studio/blueprints`);
    if (!res.ok) throw new Error('Failed to fetch studio blueprints');
    return res.json();
  },

  deepenStudioThinking: async (
    datasetId: string,
    payload: {
      table_name: string;
      x_field: string;
      y_field: string;
      chart_type?: string;
      aggregation?: string;
    }
  ): Promise<DeepDiagnosticResult> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/studio/deepen-thinking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to deepen studio thinking');
    return res.json();
  },

  simulateStudioWhatIf: async (
    datasetId: string,
    payload: {
      points: any[];
      delta_pct: number;
      target_cohort?: string;
    }
  ): Promise<WhatIfSimulationResult> => {
    const res = await authFetch(`${API_BASE}/dashboard/${datasetId}/studio/what-if-simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to simulate what-if scenario');
    return res.json();
  },

  createChart: async (chartData: Partial<DashboardChart>): Promise<DashboardChart> => {
    const res = await authFetch(`${API_BASE}/dashboard/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartData)
    });
    if (!res.ok) throw new Error('Failed to create chart');
    return res.json();
  },

  updateChart: async (chartId: string, chartData: Partial<DashboardChart>): Promise<DashboardChart> => {
    const res = await authFetch(`${API_BASE}/dashboard/charts/${chartId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartData)
    });
    if (!res.ok) throw new Error('Failed to update chart');
    return res.json();
  },

  deleteChart: async (chartId: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/dashboard/charts/${chartId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete chart');
  },

  // Chat (Ask DATOVA)
  getChatHistory: async (datasetId: string): Promise<ChatMessage[]> => {
    const res = await authFetch(`${API_BASE}/chat/${datasetId}/history`);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },

  sendChatQuery: async (datasetId: string, query: string, activeSheetId?: string, dashboardContext?: any): Promise<ChatMessage> => {
    const res = await authFetch(`${API_BASE}/chat/${datasetId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        active_sheet_id: activeSheetId,
        dashboard_context: dashboardContext
      })
    });
    if (!res.ok) throw new Error('Failed to process question');
    return res.json();
  },

  clearChatHistory: async (datasetId: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/chat/${datasetId}/history`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear chat history');
  },

  pinChartToDashboard: async (datasetId: string, chart: any, sheetId?: string): Promise<{ status: string; chart_id: string; sheet_id: string; title: string }> => {
    const res = await authFetch(`${API_BASE}/chat/${datasetId}/pin-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart, sheet_id: sheetId })
    });
    if (!res.ok) throw new Error('Failed to pin chart to dashboard');
    return res.json();
  },

  // Reports
  getReport: async (datasetId: string): Promise<ReportDocument> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}`);
    if (!res.ok) throw new Error('Failed to fetch report');
    return res.json();
  },

  regenerateReport: async (datasetId: string): Promise<ReportDocument> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}/regenerate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to regenerate report');
    return res.json();
  },

  aiDeepenReport: async (datasetId: string): Promise<ReportDocument> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}/ai-deepen`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to deepen report with AI');
    return res.json();
  },

  updateReport: async (datasetId: string, title?: string, subtitle?: string): Promise<ReportDocument> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle })
    });
    if (!res.ok) throw new Error('Failed to update report metadata');
    return res.json();
  },

  updateReportSection: async (sectionId: string, payload: Partial<ReportSection>): Promise<ReportSection> => {
    const res = await authFetch(`${API_BASE}/reports/sections/${sectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update report section');
    return res.json();
  },

  createReportSection: async (datasetId: string, title: string, content: string): Promise<ReportSection> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, section_type: 'custom' })
    });
    if (!res.ok) throw new Error('Failed to add report section');
    return res.json();
  },

  deleteReportSection: async (sectionId: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/reports/sections/${sectionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete report section');
  },

  getReportPdfUrl: (datasetId: string) => `${API_BASE}/reports/${datasetId}/export/pdf`,
  getReportExcelUrl: (datasetId: string) => `${API_BASE}/reports/${datasetId}/export/excel`,

  getExecutiveReportTemplate: async (datasetId: string): Promise<ExecutiveDashboardReportData> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}/executive-template`);
    if (!res.ok) throw new Error('Failed to fetch executive dashboard report template');
    return res.json();
  },

  generateExecutiveReport: async (
    datasetId: string,
    payload?: { prompt?: string; user_name?: string; user_role?: string }
  ): Promise<ExecutiveDashboardReportData> => {
    const res = await authFetch(`${API_BASE}/reports/${datasetId}/executive-template/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) throw new Error('Failed to generate customized executive report');
    return res.json();
  },

  // Samples
  listSamples: async (): Promise<SampleDatasetMeta[]> => {
    const res = await authFetch(`${API_BASE}/samples`);
    if (!res.ok) throw new Error('Failed to fetch samples');
    return res.json();
  },

  loadSample: async (sampleKey: string): Promise<Dataset> => {
    const res = await authFetch(`${API_BASE}/samples/${sampleKey}/load`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to load sample dataset');
    return res.json();
  },

  // Settings & Engine Configuration
  getSettings: async (): Promise<{
    provider: string;
    openai_configured: boolean;
    gemini_configured: boolean;
    openai_masked: string;
    gemini_masked: string;
    openai_from_env?: boolean;
    gemini_from_env?: boolean;
    openai_model?: string;
    gemini_model?: string;
    environment: string;
  }> => {
    const res = await authFetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (payload: {
    openai_key?: string;
    gemini_key?: string;
    provider?: string;
    openai_model?: string;
    gemini_model?: string;
  }): Promise<any> => {
    const res = await authFetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  testLLMConnection: async (payload: {
    provider: string;
    api_key?: string;
    model?: string;
  }): Promise<{
    status: 'success' | 'error';
    provider: string;
    model?: string;
    latency_ms?: number;
    sample?: string;
    message: string;
  }> => {
    const res = await authFetch(`${API_BASE}/settings/test-llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to test LLM connection');
    return res.json();
  },

  // -------------------------------------------------------------
  // Advanced v2.0 Enterprise Intelligence Endpoints
  // -------------------------------------------------------------

  // Predictive Forecasting
  getForecast: async (
    datasetId: string,
    params?: { metric?: string; date_col?: string; horizon?: number; table_name?: string; confidence_level?: number }
  ): Promise<ForecastResult> => {
    const q = new URLSearchParams();
    if (params?.metric) q.append('metric', params.metric);
    if (params?.date_col) q.append('date_col', params.date_col);
    if (params?.horizon) q.append('horizon', String(params.horizon));
    if (params?.table_name) q.append('table_name', params.table_name);
    if (params?.confidence_level) q.append('confidence_level', String(params.confidence_level));

    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/forecast?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate forecast' }));
      throw new Error(err.detail || 'Failed to generate forecast');
    }
    return res.json();
  },

  // ML Cohort Clustering
  getClusters: async (
    datasetId: string,
    params?: { k?: number; table_name?: string }
  ): Promise<ClusterResult> => {
    const q = new URLSearchParams();
    if (params?.k) q.append('k', String(params.k));
    if (params?.table_name) q.append('table_name', params.table_name);

    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/clusters?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to discover clusters' }));
      throw new Error(err.detail || 'Failed to discover clusters');
    }
    return res.json();
  },

  // Data Cleanse Studio
  getCleanseAudit: async (datasetId: string, tableName?: string): Promise<CleanseAuditResult> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);

    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/cleanse/audit?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to audit dataset cleanliness');
    return res.json();
  },

  previewAutoCleanse: async (datasetId: string, tableName?: string): Promise<CleansePreviewResult> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);

    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/cleanse/auto-preview?${q.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate cleanse preview');
    return res.json();
  },

  applyAutoCleanse: async (datasetId: string, tableName?: string): Promise<CleansePreviewResult> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);

    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/cleanse/auto-apply?${q.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to apply data cleanse');
    return res.json();
  },

  getExportCleanedCsvUrl: (datasetId: string, tableName?: string): string => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);
    return `${API_BASE}/datasets/${datasetId}/cleanse/export-cleaned?${q.toString()}`;
  },

  previewCleansePipeline: async (datasetId: string, payload: CleansePipelineRequest): Promise<CleansePreviewResult> => {
    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/cleanse/pipeline-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to preview custom cleanse pipeline');
    return res.json();
  },

  applyCleansePipeline: async (datasetId: string, payload: CleansePipelineRequest): Promise<CleansePreviewResult> => {
    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/cleanse/pipeline-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to apply custom cleanse pipeline');
    return res.json();
  },

  // SQL Sandbox & NL-to-SQL
  executeSql: async (
    datasetId: string,
    query: string,
    tableName?: string,
    maxRows?: number,
    question?: string
  ): Promise<SqlQueryResult> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        table_name: tableName,
        max_rows: maxRows || 200,
        question
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'SQL Execution failed' }));
      throw new Error(err.detail || 'SQL Execution failed');
    }
    return res.json();
  },

  translateNlToSql: async (
    datasetId: string,
    prompt: string,
    tableName?: string
  ): Promise<SqlTranslateResult> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/sql/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        table_name: tableName
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to translate natural language to SQL' }));
      throw new Error(err.detail || 'Failed to translate natural language to SQL');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Creative Flagship Features
  // -------------------------------------------------------------

  // 1. Executive Audio Briefing
  getAudioBrief: async (datasetId: string): Promise<AudioBriefResponse> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/audio-brief`);
    if (!res.ok) throw new Error('Failed to generate audio briefing');
    return res.json();
  },

  // 2. What-If Scenario Planner
  getScenarioConfig: async (datasetId: string, tableName?: string): Promise<ScenarioConfig> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/scenario-config?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch scenario config');
    return res.json();
  },

  simulateScenario: async (
    datasetId: string,
    payload: {
      target_metric?: string;
      drivers: Array<{ column: string; shift_pct: number }>;
      dimension_col?: string;
      table_name?: string;
    }
  ): Promise<ScenarioSimulationResult> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/scenario-simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Simulation failed' }));
      throw new Error(err.detail || 'Simulation failed');
    }
    return res.json();
  },

  // 3. Hierarchical Metric Driver Tree
  getDriverTreeConfig: async (datasetId: string, tableName?: string): Promise<DriverTreeConfigResponse> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/driver-tree-config?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch driver tree config');
    return res.json();
  },

  getDriverTree: async (
    datasetId: string,
    payload: {
      metric_col?: string;
      dimension_cols?: string[];
      table_name?: string;
      calculation_type?: string;
      kpi_name?: string;
      unit?: string;
      display_name?: string;
    }
  ): Promise<DriverTreeResponse> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/driver-tree`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to build driver tree' }));
      throw new Error(err.detail || 'Failed to build driver tree');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // 4. Enterprise Automated Machine Learning (AutoML Studio)
  // -------------------------------------------------------------
  getAutoMLCandidates: async (datasetId: string, tableName?: string): Promise<{ table_name: string; total_rows: number; candidates: AutoMLTargetCandidate[] }> => {
    const q = new URLSearchParams();
    if (tableName) q.append('table_name', tableName);
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/automl/candidates?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch AutoML candidate targets');
    return res.json();
  },

  trainAutoML: async (
    datasetId: string,
    payload: {
      target_column: string;
      feature_columns?: string[];
      task_type?: string;
      table_name?: string;
    }
  ): Promise<AutoMLResult> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/automl/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'AutoML training failed' }));
      throw new Error(err.detail || 'AutoML training failed');
    }
    return res.json();
  },

  predictAutoML: async (
    datasetId: string,
    payload: {
      model_id: string;
      feature_inputs: Record<string, any>;
    }
  ): Promise<AutoMLPrediction> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/automl/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Prediction failed' }));
      throw new Error(err.detail || 'Prediction failed');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // 5. Pareto (80/20) & Multivariate Regression
  // -------------------------------------------------------------
  getParetoAnalysis: async (
    datasetId: string,
    dimensionCol: string,
    metricCol: string,
    topN: number = 30,
    tableName?: string
  ): Promise<ParetoResult> => {
    const q = new URLSearchParams({
      dimension_col: dimensionCol,
      metric_col: metricCol,
      top_n: topN.toString()
    });
    if (tableName) q.append('table_name', tableName);
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/pareto?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Pareto analysis failed' }));
      throw new Error(err.detail || 'Pareto analysis failed');
    }
    return res.json();
  },

  getMultivariateRegression: async (
    datasetId: string,
    targetCol: string,
    features?: string[],
    tableName?: string
  ): Promise<RegressionResult> => {
    const q = new URLSearchParams({ target_col: targetCol });
    if (features && features.length > 0) q.append('features', features.join(','));
    if (tableName) q.append('table_name', tableName);
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/regression?${q.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Regression analysis failed' }));
      throw new Error(err.detail || 'Regression analysis failed');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Multi-Dataset Fusion Studio
  // -------------------------------------------------------------
  getFusionCandidates: async (): Promise<{ candidates: FusionCandidateTable[]; total_tables: number }> => {
    const res = await authFetch(`${API_BASE}/fusion/candidates`);
    if (!res.ok) throw new Error('Failed to fetch fusion candidates');
    return res.json();
  },

  evaluateFusion: async (payload: {
    dataset_id_1: string;
    table_name_1: string;
    key_1: string;
    dataset_id_2: string;
    table_name_2: string;
    key_2: string;
    join_type?: string;
  }): Promise<FusionEvaluationResult> => {
    const res = await authFetch(`${API_BASE}/fusion/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Evaluation failed' }));
      throw new Error(err.detail || 'Evaluation failed');
    }
    return res.json();
  },

  getFusionPreview: async (payload: {
    dataset_id_1: string;
    table_name_1: string;
    key_1: string;
    dataset_id_2: string;
    table_name_2: string;
    key_2: string;
    join_type?: string;
    max_rows?: number;
  }): Promise<FusionPreviewResult> => {
    const res = await authFetch(`${API_BASE}/fusion/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Preview generation failed' }));
      throw new Error(err.detail || 'Preview generation failed');
    }
    return res.json();
  },

  getCrossCorrelations: async (payload: {
    dataset_id_1: string;
    table_name_1: string;
    key_1: string;
    dataset_id_2: string;
    table_name_2: string;
    key_2: string;
    join_type?: string;
  }): Promise<CrossCorrelationResult> => {
    const res = await authFetch(`${API_BASE}/fusion/correlations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Correlation computation failed' }));
      throw new Error(err.detail || 'Correlation computation failed');
    }
    return res.json();
  },

  materializeFusion: async (payload: FusionMaterializeRequest): Promise<FusionMaterializeResponse> => {
    const res = await authFetch(`${API_BASE}/fusion/materialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Materialization failed' }));
      throw new Error(err.detail || 'Materialization failed');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // E-ER Diagram & Relational Model Studio
  // -------------------------------------------------------------
  getModelSchemaGraph: async (datasetId?: string): Promise<EerSchemaGraph> => {
    const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await authFetch(`${API_BASE}/model/schema-graph${q}`);
    if (!res.ok) throw new Error('Failed to fetch E-ER schema graph');
    return res.json();
  },

  simulateRelationship: async (payload: EerSimulateRequest): Promise<EerSimulationResult> => {
    const res = await authFetch(`${API_BASE}/model/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Relationship simulation failed' }));
      throw new Error(err.detail || 'Relationship simulation failed');
    }
    return res.json();
  },

  createRelationship: async (payload: {
    dataset_id: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    relationship_type: string;
    confidence?: number;
    reasoning?: string;
  }): Promise<{ success: boolean; relationship_id: string }> => {
    const res = await authFetch(`${API_BASE}/model/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create relationship' }));
      throw new Error(err.detail || 'Failed to create relationship');
    }
    return res.json();
  },

  deleteRelationship: async (relationshipId: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/model/relationships/${relationshipId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to delete relationship');
    return res.json();
  },

  // Authentication
  login: async (email: string, password: string): Promise<AuthResponse> => {
    let res: Response;
    try {
      res = await authFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
    } catch (networkErr: any) {
      throw new Error('Backend server is offline or unreachable (Port 8000). Please start the backend service.');
    }

    if (!res.ok) {
      if (res.status === 401) {
        const err = await res.json().catch(() => ({ detail: 'Incorrect password.' }));
        throw new Error(err.detail || 'Incorrect password. Please check your password and try again.');
      } else if (res.status === 404) {
        const err = await res.json().catch(() => ({ detail: 'Account not found.' }));
        throw new Error(err.detail || 'No account found with this email address. Please create a new account.');
      } else if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('Backend server is offline or unreachable (Port 8000). Please start backend with start_backend.bat.');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Authentication failed.' }));
        throw new Error(err.detail || `Authentication failed (Status ${res.status}). Please try again.`);
      }
    }
    return res.json();
  },

  register: async (payload: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
  }): Promise<AuthResponse> => {
    const res = await authFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed. Please try again.');
    }
    return res.json();
  },

  getMe: async (): Promise<AuthUser> => {
    const res = await authFetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      throw new Error('Session invalid or expired');
    }
    return res.json();
  },

  logout: async (): Promise<void> => {
    try {
      await authFetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });
    } catch {
      // Ignored on local signout
    }
  },

  forgotPassword: async (email: string): Promise<{ status: string; message: string; email: string; verification_code?: string }> => {
    let res: Response;
    try {
      res = await authFetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
    } catch (networkErr: any) {
      throw new Error('Backend server is offline or unreachable (Port 8000). Please ensure Datanova backend is running.');
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`No account found for "${email.trim()}". Please check your spelling or register.`);
      } else if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('Backend server is offline or unreachable (Port 8000). Please start backend with start_backend.bat.');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to request password reset.' }));
        throw new Error(err.detail || 'Failed to request password reset. Check email.');
      }
    }
    return res.json();
  },

  resetPassword: async (payload: { email: string; code: string; new_password: string }): Promise<{ status: string; message: string }> => {
    let res: Response;
    try {
      res = await authFetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          code: payload.code.trim(),
          new_password: payload.new_password
        })
      });
    } catch (networkErr: any) {
      throw new Error('Backend server is offline or unreachable (Port 8000). Please ensure Datanova backend is running.');
    }

    if (!res.ok) {
      if (res.status === 400) {
        const err = await res.json().catch(() => ({ detail: 'Invalid or expired verification code.' }));
        throw new Error(err.detail || 'Invalid or expired verification code. Please check your 6-digit code.');
      } else if (res.status === 404) {
        throw new Error('User account not found.');
      } else if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('Backend server is offline or unreachable (Port 8000). Please start backend with start_backend.bat.');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to reset password.' }));
        throw new Error(err.detail || 'Failed to reset password. Please check your verification code.');
      }
    }
    return res.json();
  },

  updateProfile: async (payload: {
    full_name?: string;
    role?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<{ status: string; message: string; user: AuthUser }> => {
    const res = await authFetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update profile' }));
      throw new Error(err.detail || 'Failed to update profile. Please check your inputs.');
    }
    return res.json();
  },

  getNetworkInfo: async (): Promise<{ local_ip: string; port: number; mobile_url: string; hostname: string }> => {
    const res = await authFetch(`${API_BASE}/settings/network-info`);
    if (!res.ok) throw new Error('Failed to fetch network information');
    return res.json();
  },

  checkHealth: async (): Promise<{ online: boolean; detail?: any }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await authFetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { online: true, detail: data };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  },

  getTableKpis: async (datasetId: string, tableName: string): Promise<{ dataset_id: string; table_name: string; total_rows: number; total_columns: number; kpis: KpiMetric[] }> => {
    const res = await authFetch(`${API_BASE}/datasets/${datasetId}/tables/${encodeURIComponent(tableName)}/kpis`);
    if (!res.ok) throw new Error('Failed to fetch table KPIs');
    return res.json();
  },

  getComprehensiveKpis: async (datasetId: string): Promise<any> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/kpis/comprehensive`);
    if (!res.ok) throw new Error('Failed to fetch comprehensive KPIs');
    return res.json();
  },

  regenerateKpis: async (datasetId: string): Promise<KpiMetric[]> => {
    const res = await authFetch(`${API_BASE}/analysis/${datasetId}/kpis/regenerate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to regenerate KPIs');
    return res.json();
  }
};




