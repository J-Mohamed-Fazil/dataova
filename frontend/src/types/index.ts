export interface ColumnMetadata {
  id: string;
  column_name: string;
  data_type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'identifier';
  original_type: string;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  cardinality_ratio: number;
  is_identifier: boolean;
  is_potential_kpi: boolean;
  statistics: Record<string, any>;
  sample_values: any[];
}

export interface TableMetadata {
  id: string;
  table_name: string;
  row_count: number;
  column_count: number;
  sample_data: Record<string, any>[];
  columns: ColumnMetadata[];
}

export interface TableRelationship {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence: number;
  relationship_type: 'one_to_one' | 'one_to_many' | 'many_to_one';
  status: 'detected' | 'accepted' | 'rejected';
  reasoning?: string;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  row_count: number;
  column_count: number;
  data_health_score: number;
  detected_domain: string;
  domain_confidence: number;
  domain_reasoning?: string;
  created_at: string;
  updated_at: string;
  tables: TableMetadata[];
  relationships: TableRelationship[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  status: string;
  row_count: number;
  column_count: number;
  data_health_score: number;
  detected_domain: string;
  created_at: string;
}

export interface KpiMetric {
  id: string;
  name: string;
  display_name: string;
  value: number;
  formatted_value: string;
  unit: string;
  calculation_type: string;
  source_table: string;
  source_column?: string;
  column_name?: string;
  status?: string;
  formula_explanation: string;
  impact_summary?: string;
  confidence: number;
  order_index: number;
  // Proper Statistical Quintet (Min, Max, Sum, Count, Average) & AI Insights
  min_value?: number | null;
  max_value?: number | null;
  sum_value?: number | null;
  avg_value?: number | null;
  count_value?: number | null;
  formatted_min?: string | null;
  formatted_max?: string | null;
  formatted_sum?: string | null;
  formatted_avg?: string | null;
  formatted_count?: string | null;
  ai_insight?: string | null;
  statistical_summary?: {
    median?: number;
    std_dev?: number;
    skewness?: number;
    range?: number;
    peak_share?: number;
    is_monetary?: boolean;
    is_rate?: boolean;
  } | null;
}

export interface Insight {
  id: string;
  title: string;
  category: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'performance' | 'data_quality' | 'comparison';
  statement_type: 'fact' | 'calculation' | 'inference' | 'recommendation';
  description: string;
  calculation_details: Record<string, any>;
  why_it_matters: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  source_table?: string;
  source_columns: string[];
  created_at: string;
}

export interface AnomalyRecord {
  id: string;
  table_name: string;
  column_name: string;
  method: string;
  anomaly_count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  explanation: string;
}

export interface AnalysisOverview {
  dataset_id: string;
  dataset_name: string;
  data_health_score: number;
  detected_domain: string;
  domain_confidence: number;
  domain_reasoning?: string;
  row_count: number;
  column_count: number;
  kpis: KpiMetric[];
  insights: Insight[];
  anomalies: AnomalyRecord[];
}

export interface DashboardChart {
  id: string;
  sheet_id: string;
  title: string;
  description?: string;
  chart_type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'histogram' | 'table' | 'stacked_bar' | 'horizontal_bar' | 'map' | 'geo' | 'radar' | 'composed' | 'combo' | 'heatmap' | 'treemap';
  table_name: string;
  join_table?: string;
  primary_key?: string;
  join_key?: string;
  x_field?: string;
  y_field?: string;
  secondary_y_field?: string;
  aggregation: string;
  group_by?: string;
  filters: Array<{ field: string; operator: string; value: any }>;
  config: Record<string, any>;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  order_index: number;
  data?: Array<{ label: string; value: any; x?: number; y?: number }>;
}

export interface BusinessQuestionInsight {
  id: string;
  question: string;
  answer: string;
  metric?: string;
  badge?: string;
  recommendation?: string;
  confidence?: number;
  icon?: string;
  chart_target?: string;
  impact_level?: 'High Impact' | 'Strategic' | 'Tactical' | 'Risk Alert' | string;
  category?: 'Executive' | 'Revenue & Margins' | 'Cohorts & Demographics' | 'Risk & Anomalies' | 'Velocity & Momentum' | 'Profitability' | string;
}

export interface CognitiveThoughtStep {
  step: number;
  title: string;
  icon: string;
  badge: string;
  confidence: number;
  detail: string;
}

export interface MindSpark {
  id: string;
  title: string;
  description: string;
  suggested_prompt: string;
}

export interface DeepDiagnosticAnomaly {
  cohort: string;
  value: number;
  z_score: number;
  deviation_pct: number;
}

export interface DeepDiagnosticResult {
  top_driver?: {
    label: string;
    value: number;
    share_pct: number;
  };
  anomalies?: DeepDiagnosticAnomaly[];
  sensitivity?: {
    scenario_label: string;
    projected_top_value: number;
    projected_portfolio_total: number;
    net_gain: number;
    portfolio_share_change: string;
  };
  playbook?: Array<{
    phase: string;
    action: string;
  }>;
  total_portfolio?: number;
  mean_baseline?: number;
  diagnostic?: string;
}

export interface WhatIfSimulationResult {
  delta_pct_applied: number;
  original_total: number;
  projected_total: number;
  net_delta: number;
  overall_pct_change: number;
  projected_points: Array<{
    label: string;
    value: number;
    original_value?: number;
    delta?: number;
    [key: string]: any;
  }>;
}

export interface StudioPreviewResult {
  chart_data: Array<{ label: string; value: any; x?: number; y?: number; [key: string]: any }>;
  summary: {
    total_points: number;
    sum: number;
    mean: number;
    max: number;
    min: number;
    peak_label?: string;
    peak_val?: number;
    peak_share_pct?: number;
  };
  ai_insight: string;
  strategic_directive?: string;
  thought_process?: CognitiveThoughtStep[];
  mind_sparks?: MindSpark[];
  total_rows?: number;
  total_columns?: number;
  columns?: string[];
  sample_data?: any[];
}

export interface AIChartBlueprint {
  id: string;
  title: string;
  description: string;
  chart_type: DashboardChart['chart_type'];
  table_name: string;
  join_table?: string;
  x_field: string;
  y_field: string;
  secondary_y_field?: string;
  aggregation: string;
  palette: string;
  badge: string;
  ai_rationale: string;
}

export interface AIDynamicArchetype {
  id: string;
  category: string;
  title: string;
  name?: string;
  badge: string;
  badge_class: string;
  desc: string;
  suggested_prompt: string;
  charts_planned: string[];
  charts?: any[];
  recommended: boolean;
  target_table: string;
  x_field?: string;
  y_field?: string;
  secondary_y_field?: string;
  date_field?: string;
  icon_type?: string;
  metrics_spotlight?: string[];
  dimensions_spotlight?: string[];
}

export interface AIDiscoveredArchetypesResponse {
  dataset_id: string;
  dataset_name: string;
  domain: string;
  domain_confidence: number;
  summary: string;
  recommended_archetype_id: string;
  archetypes: AIDynamicArchetype[];
  data_profile?: {
    primary_table?: string;
    primary_metrics?: string[];
    efficiency_metrics?: string[];
    dimensions?: string[];
    dates?: string[];
    domain_key?: string;
    domain_badge?: string;
    domain_icon?: string;
  };
}

export interface DashboardSheet {
  id: string;
  dataset_id: string;
  title: string;
  sheet_type: string;
  order_index: number;
  is_default: boolean;
  business_questions?: BusinessQuestionInsight[];
  charts: DashboardChart[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  action_type?: string;
  action_payload: Record<string, any>;
  citations: Array<{ table: string; columns: string[] }>;
  calculation_steps: Array<{ step: string }>;
  created_at: string;
}

export interface ReportTable {
  title?: string;
  subtitle?: string;
  headers?: string[];
  rows?: any[][];
  alignments?: Array<'left' | 'right' | 'center' | string>;
  column_types?: string[];
  data?: any[][];
}

export interface ReportChartInsight {
  headline: string;
  description: string;
  impact?: string;
  severity?: 'low' | 'medium' | 'high' | 'positive';
  metric_highlight?: string;
}

export interface ReportChartItem {
  id: string;
  title: string;
  subtitle?: string;
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'stacked_bar' | 'heatmap' | 'treemap' | string;
  table_name?: string;
  x_field?: string;
  y_field?: string;
  data: Array<{ label: string; value: any; x?: number | string; y?: number | string; name?: string; intensity?: number; share_pct?: number }>;
  insight?: ReportChartInsight;
  metric_highlight?: string;
}

export interface ReportSection {
  id: string;
  report_id: string;
  section_type: string;
  title: string;
  content: string;
  order_index: number;
  charts_included: ReportChartItem[];
  tables_included: ReportTable[];
  created_at: string;
  updated_at: string;
}

export interface ReportDocument {
  id: string;
  dataset_id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  created_at: string;
  updated_at: string;
  sections: ReportSection[];
}

export interface SampleDatasetMeta {
  key: string;
  name: string;
  domain: string;
  filename: string;
  description: string;
  icon: string;
  rows: number;
  cols: number;
  already_loaded?: boolean;
  dataset_id?: string;
}

// Advanced v2.0 Enterprise Types
export interface ForecastPoint {
  period: string;
  step: number;
  forecast: number;
  upper_bound?: number;
  lower_bound?: number;
  uncertainty_growth?: number;
  upper_95: number;
  lower_95: number;
  upper_80: number;
  lower_80: number;
  bull_scenario: number;
  bear_scenario: number;
}

export interface ForecastHistoricalPoint {
  period: string;
  actual: number;
  trend: number;
}

export interface ForecastResult {
  metric: string;
  metric_display: string;
  date_col: string;
  frequency: string;
  horizon: number;
  confidence_level?: number;
  historical_count: number;
  historical: ForecastHistoricalPoint[];
  forecast: ForecastPoint[];
  summary: {
    last_actual: number;
    next_forecast: number;
    horizon_target: number;
    projected_change_pct: number;
    trajectory: string;
    status_color: string;
    confidence_score: number;
    r_squared: number;
    volatility_cv: number;
  };
  recommendations: string[];
  table_name: string;
  available_tables?: Array<{
    table_name: string;
    row_count: number;
    columns: string[];
    numeric_columns: string[];
  }>;
}

export interface CohortProfile {
  cluster_id: number;
  name: string;
  description: string;
  priority: string;
  record_count: number;
  record_percentage: number;
  color: string;
  raw_means: Record<string, number>;
  normalized_scores: Record<string, number>;
  dominant_strength: string;
  operational_drag: string;
  recommendation: string;
}

export interface ClusterResult {
  total_records: number;
  k: number;
  features_used: string[];
  radar_indicators: Array<{ key: string; name: string }>;
  radar_series: Array<{ name: string; color: string; data: Record<string, number> }>;
  cohorts: CohortProfile[];
  sample_records: Record<string, any>[];
  metrics: {
    inertia: number;
    variance_explained_pct: number;
  };
  table_name: string;
  available_tables?: Array<{
    table_name: string;
    row_count: number;
    columns: string[];
    numeric_columns: string[];
  }>;
}

export interface CleanseAuditDefect {
  type: string;
  severity: string;
  count: number;
  message: string;
  remedy: string;
}

export interface ColumnQualityStat {
  name: string;
  dtype: 'numeric' | 'string' | 'datetime' | 'boolean';
  null_count: number;
  null_percentage: number;
  unique_count: number;
  has_whitespace: boolean;
  outlier_count: number;
}

export interface CleanseAuditResult {
  total_rows: number;
  total_columns: number;
  total_cells: number;
  total_nulls: number;
  null_percentage: number;
  duplicate_rows: number;
  whitespace_columns: string[];
  outlier_columns: Record<string, number>;
  null_counts?: Record<string, number>;
  column_stats?: Record<string, ColumnQualityStat>;
  current_health_score: number;
  defects: CleanseAuditDefect[];
  table_name: string;
}

export interface CleanseDiffSummary {
  imputed_numeric?: number;
  imputed_categorical?: number;
  imputed_cells?: number;
  dropped_duplicates?: number;
  clipped_outliers?: number;
  trimmed_columns?: number;
  rows_delta?: number;
}

export interface CleansePreviewResult {
  initial_health_score: number;
  cleaned_health_score: number;
  score_improvement: number;
  initial_rows: number;
  cleaned_rows: number;
  columns: string[];
  transformation_log: string[];
  diff_summary?: CleanseDiffSummary;
  sample_preview: Record<string, any>[];
  table_name: string;
}

export interface CleansePipelineStep {
  action: 'strip_whitespace' | 'drop_duplicates' | 'impute' | 'clip_outliers' | 'drop_column' | 'create_column';
  field?: string;
  strategy?: 'median' | 'mean' | 'zero' | 'mode' | 'drop_rows';
  iqr_multiplier?: number;
  new_col?: string;
  col_a?: string;
  col_b?: string;
  operation?: 'multiply' | 'divide' | 'add' | 'subtract';
}

export interface CleansePipelineRequest {
  table_name?: string;
  steps: CleansePipelineStep[];
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  total_returned: number;
  execution_time_ms: number;
  chart_suggestion?: {
    x_col: string;
    y_col: string;
    type: string;
  };
  sql_query: string;
  error?: string;
  summary?: string;
}

export interface SqlTranslateResult {
  sql_query: string;
  pandas_code: string;
  detected_dimension?: string;
  detected_metric?: string;
  explanation?: string;
}

// -------------------------------------------------------------
// Creative Feature 1: Executive Audio Briefing
// -------------------------------------------------------------
export interface AudioDialogueTurn {
  id: number;
  speaker: 'Alex' | 'Morgan';
  role: string;
  text: string;
  emphasis: 'normal' | 'highlight' | 'caution';
}

export interface AudioBriefResponse {
  title: string;
  dataset_name: string;
  domain: string;
  duration_est_seconds: number;
  total_words: number;
  dialogue: AudioDialogueTurn[];
  key_takeaways: string[];
  full_script: string;
}

// -------------------------------------------------------------
// Creative Feature 2: Interactive What-If Scenario Planner
// -------------------------------------------------------------
export interface ScenarioDriverConfig {
  column: string;
  correlation: number;
  default_shift: number;
}

export interface ScenarioConfig {
  target_metric: string;
  all_numeric_columns: string[];
  all_dimension_columns: string[];
  default_dimension?: string;
  recommended_drivers: ScenarioDriverConfig[];
  table_name?: string;
}

export interface ScenarioDriverDelta {
  column: string;
  shift_pct: number;
  estimated_impact_pct: number;
  dollar_delta: number;
}

export interface ScenarioSegmentBreakdown {
  segment: string;
  baseline: number;
  projected: number;
  delta: number;
  variance_pct: number;
}

export interface ScenarioConfidenceIntervals {
  p10: number;
  p50: number;
  p90: number;
}

export interface ScenarioSensitivityCell {
  x_shift: number;
  y_shift: number;
  projected: number;
  variance_pct: number;
}

export interface ScenarioSensitivityMatrix {
  lever_x: string;
  lever_y: string;
  x_shifts: number[];
  y_shifts: number[];
  grid: ScenarioSensitivityCell[][];
}

export interface ScenarioAISummary {
  headline: string;
  tone: 'growth' | 'downside' | 'neutral';
  key_driver: string;
  key_driver_delta: number;
  strategic_implications: string[];
  risk_assessment: string;
}

export interface SavedScenarioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  target_metric: string;
  dimension_col?: string;
  levers: Array<{ column: string; shift_pct: number }>;
  projected_total: number;
  net_delta: number;
  variance_pct: number;
}

export interface ScenarioSimulationResult {
  target_metric: string;
  baseline_total: number;
  projected_total: number;
  net_delta: number;
  variance_pct: number;
  risk_index: string;
  drivers_applied: ScenarioDriverDelta[];
  comparison_chart: Array<{ label: string; value: number; fill?: string }>;
  waterfall_steps: Array<{ step: string; value: number; type: 'base' | 'positive' | 'negative' | 'total' }>;
  segment_breakdown: ScenarioSegmentBreakdown[];
  confidence_intervals?: ScenarioConfidenceIntervals;
  sensitivity_matrix?: ScenarioSensitivityMatrix;
  ai_summary?: ScenarioAISummary;
}

// -------------------------------------------------------------
// Creative Feature 3: Hierarchical Metric Driver Tree
// -------------------------------------------------------------
export interface DriverTreeNode {
  id: string;
  dimension: string;
  label: string;
  value: number;
  share_of_parent_pct: number;
  share_of_total_pct: number;
  status: 'growth_leader' | 'primary_drag' | 'neutral';
  children?: DriverTreeNode[];
}

export interface DriverTreeCandidateMetric {
  id: string;
  label: string;
  column?: string;
  calculation_type?: string;
  unit?: string;
  is_monetary?: boolean;
}

export interface DriverTreeConfigResponse {
  default_metric: string;
  all_numeric_columns: string[];
  all_dimension_columns: string[];
  default_dimensions: string[];
  available_metrics?: DriverTreeCandidateMetric[];
  table_name?: string;
  all_tables?: { table_name: string; row_count: number; column_count: number }[];
}

export interface DriverTreeResponse {
  metric_col: string;
  metric_name?: string;
  calculation_type?: string;
  is_monetary?: boolean;
  unit?: string;
  dimensions_used: string[];
  total_value: number;
  formatted_total?: string;
  table_name?: string;
  tree: DriverTreeNode;
  growth_leader: {
    dimension: string;
    segment: string;
    value: number;
    share_pct: number;
  };
  primary_drag: {
    dimension: string;
    segment: string;
    value: number;
    share_pct: number;
    recommendation?: string;
  };
}

// -------------------------------------------------------------
// Enterprise Automated Machine Learning (AutoML Studio) Types
// -------------------------------------------------------------
export interface AutoMLTargetCandidate {
  column_name: string;
  task_type: 'classification' | 'regression';
  unique_values_count: number;
  sample_values: string[];
  is_recommended: boolean;
}

export interface AutoMLLeaderboardEntry {
  rank: number;
  model_name: string;
  algorithm_family: string;
  is_champion: boolean;
  latency_ms: number;
  accuracy?: number;
  f1_score?: number;
  r_squared?: number;
  rmse?: number;
  mae?: number;
}

export interface AutoMLFeatureImportance {
  feature: string;
  importance_pct: number;
}

export interface AutoMLConfusionMatrixRow {
  actual: string;
  counts: number[];
}

export interface AutoMLResult {
  model_id: string;
  target_column: string;
  task_type: 'classification' | 'regression';
  dataset_rows: number;
  features_used: string[];
  champion_model: string;
  primary_metric_name: string;
  primary_metric_value: string;
  leaderboard: AutoMLLeaderboardEntry[];
  feature_importance: AutoMLFeatureImportance[];
  confusion_matrix?: AutoMLConfusionMatrixRow[];
  classes?: string[];
  table_name?: string;
}

export interface AutoMLPrediction {
  model_id: string;
  task_type: 'classification' | 'regression';
  target_column: string;
  predicted_label?: string;
  confidence_pct?: number;
  predicted_value?: number;
  range_lower?: number;
  range_upper?: number;
  error?: string;
}

export interface ParetoItem {
  rank: number;
  label: string;
  value: number;
  share_pct: number;
  cumulative_pct: number;
  is_vital_few: boolean;
}

export interface ParetoResult {
  dimension_col: string;
  metric_col: string;
  total_entities: number;
  total_value: number;
  vital_few_count: number;
  vital_few_entity_pct: number;
  vital_few_volume_pct: number;
  gini_coefficient: number;
  executive_takeaway: string;
  items: ParetoItem[];
  table_name?: string;
}

export interface RegressionCoefficient {
  feature: string;
  coefficient: number;
  standard_error: number;
  t_statistic: number;
  p_value: number;
  is_statistically_significant: boolean;
  impact_direction: 'positive' | 'negative';
}

export interface RegressionResult {
  target_column: string;
  features_analyzed: string[];
  sample_size: number;
  intercept: number;
  r_squared: number;
  adjusted_r_squared: number;
  residual_std_error: number;
  formula_equation: string;
  model_fit_quality: string;
  coefficients: RegressionCoefficient[];
  table_name?: string;
}

export interface FusionColumnInfo {
  column_name: string;
  data_type: string;
  is_identifier: boolean;
  unique_count: number;
  missing_count: number;
  sample_values: any[];
}

export interface FusionCandidateTable {
  table_key: string;
  dataset_id: string;
  dataset_name: string;
  table_name: string;
  row_count: number;
  column_count: number;
  detected_domain: string;
  columns: FusionColumnInfo[];
  storage_path: string;
}

export interface FusionEvaluationResult {
  key1: string;
  key2: string;
  join_type: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  match_rate_pct: number;
  reverse_match_rate_pct: number;
  overlap_count: number;
  total_distinct_keys: number;
  table1_orphan_keys: number;
  table2_orphan_keys: number;
  table1_nulls: number;
  table2_nulls: number;
  cartesian_risk: boolean;
  projected_rows: number;
  join_health_score: number;
  recommended_strategy: 'inner' | 'left' | 'right' | 'full';
  strategy_reason: string;
}

export interface FusionColumnProvenance {
  source_table: string;
  original_name: string;
}

export interface FusionPreviewColumnMeta {
  column_name: string;
  source_table: string;
  original_name: string;
  data_type: 'numeric' | 'string';
  missing_count: number;
  missing_pct: number;
}

export interface FusionPreviewResult {
  total_rows: number;
  total_columns: number;
  columns: FusionPreviewColumnMeta[];
  sample_rows: Record<string, any>[];
  provenance: Record<string, FusionColumnProvenance>;
}

export interface CrossCorrelationSynergy {
  feature_a: string;
  feature_b: string;
  correlation: number;
  abs_correlation: number;
  strength: string;
  sample_count: number;
}

export interface CrossCorrelationScatterPoint {
  x: number;
  y: number;
}

export interface CrossCorrelationTrendline {
  slope: number;
  intercept: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface CrossCorrelationScatterPair {
  feature_a: string;
  feature_b: string;
  correlation: number;
  strength: string;
  points: CrossCorrelationScatterPoint[];
  trendline?: CrossCorrelationTrendline | null;
}

export interface CrossCorrelationRow {
  feature_a: string;
  correlations: Record<string, number>;
}

export interface CrossCorrelationResult {
  matrix: CrossCorrelationRow[];
  t1_columns: string[];
  t2_columns: string[];
  top_synergies: CrossCorrelationSynergy[];
  scatter_pairs: CrossCorrelationScatterPair[];
}

export interface FusionMaterializeRequest {
  dataset_id_1: string;
  table_name_1: string;
  key_1: string;
  dataset_id_2: string;
  table_name_2: string;
  key_2: string;
  join_type: string;
  name: string;
}

export interface FusionMaterializeResponse {
  success: boolean;
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  column_count: number;
  detected_domain: string;
  data_health_score: number;
  status: string;
}

// -------------------------------------------------------------
// E-ER Diagram & Relational Model Studio
// -------------------------------------------------------------
export interface EerColumnNode {
  id: string;
  column_name: string;
  data_type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'identifier';
  original_type: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_identifier: boolean;
  missing_count: number;
  unique_count: number;
  sample_values: any[];
}

export interface EerTableNode {
  id: string;
  table_name: string;
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  column_count: number;
  detected_domain: string;
  columns: EerColumnNode[];
}

export interface EerRelationshipEdge {
  id: string;
  dataset_id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relationship_type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  cardinality_label: '1:1' | '1:M' | 'M:1' | 'M:M';
  confidence: number;
  status: 'detected' | 'accepted' | 'rejected' | 'user_defined';
  reasoning: string;
}

export interface EerSchemaGraph {
  tables: EerTableNode[];
  relationships: EerRelationshipEdge[];
  total_tables: number;
  total_relationships: number;
}

export interface EerSimulationSummary {
  source_table: string;
  target_table: string;
  source_column: string;
  target_column: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  cardinality_name: string;
  empirical_cardinality: string;
  empirical_badge: string;
  join_strategy: string;
  source_rows: number;
  target_rows: number;
  unified_rows: number;
  unified_columns: number;
  row_multiplication_factor: number;
  match_rate_pct: number;
  orphan_source_count: number;
  orphan_target_count: number;
  cardinality_meaning: string;
  what_happens: string;
  business_example: string;
}

export interface EerColumnLineage {
  column_name: string;
  original_name: string;
  source_table: string;
  data_type: 'numeric' | 'string';
  is_key: boolean;
}

export interface EerSimulationResult {
  summary: EerSimulationSummary;
  columns: EerColumnLineage[];
  sample_rows: Record<string, any>[];
}

export interface EerSimulateRequest {
  source_dataset_id: string;
  source_table: string;
  source_column: string;
  target_dataset_id: string;
  target_table: string;
  target_column: string;
  relationship_type: string;
  join_strategy?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_color?: string;
  created_at?: string;
  last_login?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface ExecutiveKpiCard {
  id: string;
  title: string;
  value: string;
  delta: string;
  is_positive: boolean;
  icon: string;
}

export interface ExecutiveGrowthBar {
  id: string;
  day: string;
  value: number;
  display_val: string;
  is_highlighted: boolean;
  fill_type: 'gradient' | 'muted';
  is_peak?: boolean;
}

export interface ExecutiveGrowthChart {
  title: string;
  subtitle: string;
  active_timeframe: string;
  timeframe_options: string[];
  floating_tooltip: {
    label: string;
    value: string;
  };
  y_axis_labels: string[];
  bars: ExecutiveGrowthBar[];
  plain_title?: string;
  plain_subtitle?: string;
}

export interface ExecutiveDriverCard {
  id: string;
  title: string;
  plain_title?: string;
  value: string;
  delta: string;
  is_positive: boolean;
  icon: string;
  explanation?: string;
}

export interface ExecutiveCategoryBreakdown {
  name: string;
  value: string;
  percentage: number;
  note?: string;
}

export interface ExecutiveActionStep {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
}

export interface ExecutiveNarrativePages {
  page_1_big_picture: {
    page_number: number;
    title: string;
    subtitle: string;
    human_story: string;
    dominant_chart_subtitle: string;
  };
  page_2_why_and_where: {
    page_number: number;
    title: string;
    subtitle: string;
    horizontal_breakdowns: ExecutiveCategoryBreakdown[];
    driver_cards: ExecutiveDriverCard[];
    breakdown_subtitle: string;
  };
  page_3_action_and_impact: {
    page_number: number;
    title: string;
    subtitle: string;
    action_steps: ExecutiveActionStep[];
    milestones: ExecutiveMilestoneCard[];
    summary_callout: string;
  };
}

export interface ExecutiveTableRow {
  id: string;
  category: string;
  owner: string;
  role: string;
  date: string;
  status: string;
}

export interface ExecutiveMilestoneCard {
  id: string;
  title: string;
  plain_title?: string;
  value: string;
  action_url?: string;
  description?: string;
}

export interface ExecutiveAnalyticsBar {
  date: string;
  value: number;
  height_pct: number;
}

export interface ExecutiveCalendarDay {
  day_name: string;
  day_num: number;
  is_active: boolean;
  highlight?: string;
}

export interface ExecutiveAuditCard {
  title: string;
  plain_title?: string;
  date_range: string;
  radial_percentage: number;
  radial_label: string;
  linear_percentage: number;
  linear_label: string;
}

export interface ExecutiveBusinessInsight {
  tag: string;
  plain_tag?: string;
  title: string;
  plain_title?: string;
  detail: string;
  plain_detail?: string;
  impact: string;
  plain_impact?: string;
  is_positive: boolean;
}

export interface ExecutiveKpiCard {
  id: string;
  title: string;
  plain_title?: string;
  value: string;
  delta: string;
  is_positive: boolean;
  icon: string;
  subtitle?: string;
}

export interface ExecutiveDashboardReportData {
  dataset_id: string;
  dataset_name: string;
  user_profile: {
    name: string;
    role: string;
    avatar_url?: string | null;
  };
  header: {
    search_placeholder: string;
    title: string;
    subtitle: string;
  };
  human_story_summary?: string;
  executive_summary?: string;
  plain_summary?: string;
  business_insights?: ExecutiveBusinessInsight[];
  top_kpis: ExecutiveKpiCard[];
  growth_chart: ExecutiveGrowthChart;
  driver_cards: ExecutiveDriverCard[];
  horizontal_breakdowns?: ExecutiveCategoryBreakdown[];
  action_steps?: ExecutiveActionStep[];
  narrative_pages?: ExecutiveNarrativePages;
  table_data: ExecutiveTableRow[];
  milestone_cards: ExecutiveMilestoneCard[];
  analytics_card: {
    title: string;
    plain_title?: string;
    subtitle?: string;
    bars: ExecutiveAnalyticsBar[];
  };
  calendar_strip: {
    active_day: number;
    days: ExecutiveCalendarDay[];
  };
  audit_card: ExecutiveAuditCard;
  custom_prompt?: string;
}


