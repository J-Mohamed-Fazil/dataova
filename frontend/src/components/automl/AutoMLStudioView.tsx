import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BrainCircuit,
  Sparkles,
  Trophy,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Percent,
  GitFork,
  Database,
  Search,
  Copy,
  Check,
  Filter,
  ArrowUpRight,
  Download,
  Code2,
  Hash,
  Tag,
  Gauge,
  Info,
  SlidersHorizontal,
  RefreshCw,
  Cpu,
  Target,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  Legend
} from 'recharts';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import {
  AutoMLTargetCandidate,
  AutoMLResult,
  AutoMLPrediction,
  ParetoResult,
  RegressionResult
} from '../../types';

export const AutoMLStudioView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const [activeSubTab, setActiveSubTab] = useState<'automl' | 'pareto' | 'regression'>('automl');

  // Available tables in active dataset
  const availableTables = useMemo(() => {
    return currentDataset?.tables || [];
  }, [currentDataset]);

  const [selectedTable, setSelectedTable] = useState<string>('');

  // Active table metadata
  const activeTable = useMemo(() => {
    return availableTables.find((t) => t.table_name === selectedTable) || availableTables[0];
  }, [availableTables, selectedTable]);

  // All columns in currently active table
  const allColumns = useMemo(() => {
    return activeTable?.columns.map((c) => c.column_name) || [];
  }, [activeTable]);

  // AutoML State
  const [candidates, setCandidates] = useState<AutoMLTargetCandidate[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<string>('auto');
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingStep, setTrainingStep] = useState<number>(0);
  const [automlResult, setAutomlResult] = useState<AutoMLResult | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Feature filter state
  const [featureSearch, setFeatureSearch] = useState<string>('');
  const [featureTypeFilter, setFeatureTypeFilter] = useState<'all' | 'numeric' | 'categorical'>('all');

  // What-If Prediction Simulator State
  const [simInputs, setSimInputs] = useState<Record<string, any>>({});
  const [predictionResult, setPredictionResult] = useState<AutoMLPrediction | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [autoSimulate, setAutoSimulate] = useState<boolean>(true);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Leaderboard sorting
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'rank' | 'metric' | 'latency'>('rank');
  const [leaderboardSortDir, setLeaderboardSortDir] = useState<'asc' | 'desc'>('asc');

  // Pareto State
  const [paretoDimension, setParetoDimension] = useState<string>('');
  const [paretoMetric, setParetoMetric] = useState<string>('');
  const [paretoResult, setParetoResult] = useState<ParetoResult | null>(null);
  const [isParetoLoading, setIsParetoLoading] = useState<boolean>(false);
  const [paretoSearch, setParetoSearch] = useState<string>('');
  const [paretoFilter, setParetoFilter] = useState<'all' | 'vital' | 'tail'>('all');

  // Regression State
  const [regressionTarget, setRegressionTarget] = useState<string>('');
  const [regressionResult, setRegressionResult] = useState<RegressionResult | null>(null);
  const [isRegressionLoading, setIsRegressionLoading] = useState<boolean>(false);
  const [copiedEquation, setCopiedEquation] = useState<boolean>(false);

  // Timer reference for simulation debouncing
  const simDebounceRef = useRef<any>(null);

  // Load candidate targets for a specific table
  const loadCandidatesForTable = async (tableName: string) => {
    if (!currentDataset) return;
    try {
      const targetTable = currentDataset.tables.find((t) => t.table_name === tableName) || currentDataset.tables[0];
      const data = await api.getAutoMLCandidates(currentDataset.id, tableName);
      const loadedCandidates = data.candidates || [];
      setCandidates(loadedCandidates);

      const allCols = targetTable?.columns || [];
      const nonIdCols = allCols.filter(
        (c) => !c.column_name.toLowerCase().endsWith('id') && !c.column_name.toLowerCase().endsWith('key')
      );

      // Determine default target
      let defaultTarget = '';
      if (loadedCandidates.length > 0) {
        defaultTarget = loadedCandidates[0].column_name;
        if (loadedCandidates[0].task_type) {
          setTaskType(loadedCandidates[0].task_type);
        }
      } else {
        const numCol = nonIdCols.find((c) => c.data_type === 'numeric' && !c.is_identifier);
        defaultTarget = numCol ? numCol.column_name : (allCols[0]?.column_name || '');
        if (numCol) setTaskType('regression');
      }

      setSelectedTarget(defaultTarget);
      setRegressionTarget(defaultTarget);

      // Feature columns: all other non-id columns
      const defaultFeats = (nonIdCols.length > 1 ? nonIdCols : allCols)
        .map((c) => c.column_name)
        .filter((c) => c !== defaultTarget);
      setSelectedFeatures(defaultFeats);

      // Pareto defaults
      const catCol = allCols.find(
        (c) => (c.data_type === 'categorical' || c.data_type === 'text') && !c.is_identifier
      );
      const numMetricCol = allCols.find((c) => c.data_type === 'numeric' && !c.is_identifier);
      if (catCol) setParetoDimension(catCol.column_name);
      else if (allCols[0]) setParetoDimension(allCols[0].column_name);

      if (numMetricCol) setParetoMetric(numMetricCol.column_name);
      else if (allCols[1]) setParetoMetric(allCols[1].column_name);
    } catch (err) {
      console.error('Failed to load AutoML candidates for table', tableName, err);
      // Resilient fallback from frontend metadata
      const targetTable = currentDataset.tables.find((t) => t.table_name === tableName) || currentDataset.tables[0];
      const allCols = targetTable?.columns || [];
      if (allCols.length > 0) {
        const fallbackTarget = allCols.find((c) => c.data_type === 'numeric')?.column_name || allCols[0].column_name;
        setSelectedTarget(fallbackTarget);
        setRegressionTarget(fallbackTarget);
        setSelectedFeatures(allCols.map((c) => c.column_name).filter((c) => c !== fallbackTarget));
      }
    }
  };

  // Initial table selection on mount or dataset change: pick best table
  useEffect(() => {
    if (!currentDataset || availableTables.length === 0) return;

    const sorted = [...availableTables].sort((a, b) => {
      const aScore = (a.row_count >= 8 ? 10000 : 0) + (a.row_count || 0);
      const bScore = (b.row_count >= 8 ? 10000 : 0) + (b.row_count || 0);
      return bScore - aScore;
    });

    const initialTable = sorted[0]?.table_name || availableTables[0].table_name;
    setSelectedTable(initialTable);
    loadCandidatesForTable(initialTable);
  }, [currentDataset?.id]);

  // Handle Table Selection Change
  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    setAutomlResult(null);
    setPredictionResult(null);
    setParetoResult(null);
    setRegressionResult(null);
    setTrainingError(null);
    loadCandidatesForTable(tableName);
  };

  // Handle Target Selection Change
  const handleTargetChange = (target: string) => {
    setSelectedTarget(target);
    const cand = candidates.find((c) => c.column_name === target);
    if (cand) {
      setTaskType(cand.task_type);
    } else {
      const colMeta = activeTable?.columns.find((c) => c.column_name === target);
      if (colMeta?.data_type === 'numeric') {
        setTaskType('regression');
      } else {
        setTaskType('classification');
      }
    }

    // Remove newly selected target from features if it was there
    setSelectedFeatures((prev) => prev.filter((f) => f !== target));
  };

  // Toggle Feature Selection
  const toggleFeature = (col: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(col) ? prev.filter((f) => f !== col) : [...prev, col]
    );
  };

  // Filtered features list based on search and type
  const filteredAvailableFeatures = useMemo(() => {
    return allColumns
      .filter((c) => c !== selectedTarget)
      .filter((colName) => {
        const matchesSearch = colName.toLowerCase().includes(featureSearch.toLowerCase());
        if (!matchesSearch) return false;

        const colMeta = activeTable?.columns.find((c) => c.column_name === colName);
        if (featureTypeFilter === 'numeric') {
          return colMeta?.data_type === 'numeric';
        }
        if (featureTypeFilter === 'categorical') {
          return colMeta?.data_type === 'categorical' || colMeta?.data_type === 'text';
        }
        return true;
      });
  }, [allColumns, selectedTarget, featureSearch, featureTypeFilter, activeTable]);

  // Run AutoML Training with stepped animation
  const handleTrainAutoML = async () => {
    if (!currentDataset || !selectedTarget) return;
    setIsTraining(true);
    setTrainingStep(1);
    setTrainingError(null);
    setAutomlResult(null);
    setPredictionResult(null);

    const stepInterval = setInterval(() => {
      setTrainingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 600);

    try {
      const res = await api.trainAutoML(currentDataset.id, {
        target_column: selectedTarget,
        feature_columns: selectedFeatures.length > 0 ? selectedFeatures : undefined,
        task_type: taskType,
        table_name: selectedTable || activeTable?.table_name
      });
      clearInterval(stepInterval);
      setTrainingStep(4);
      setAutomlResult(res);

      // Initialize What-If inputs with midpoints / default values
      const initialInputs: Record<string, any> = {};
      if (activeTable) {
        res.features_used.forEach((feat) => {
          const colMeta = activeTable.columns.find((c) => c.column_name === feat);
          if (colMeta?.data_type === 'numeric') {
            initialInputs[feat] = colMeta.statistics?.mean ? Math.round(colMeta.statistics.mean) : 50;
          } else if (colMeta?.sample_values?.length) {
            initialInputs[feat] = String(colMeta.sample_values[0]);
          } else {
            initialInputs[feat] = 0;
          }
        });
      }
      setSimInputs(initialInputs);

      // Auto-trigger first prediction
      setTimeout(() => {
        runPrediction(res.model_id, initialInputs);
      }, 200);
    } catch (err: any) {
      clearInterval(stepInterval);
      setTrainingError(err.message || 'AutoML training failed');
    } finally {
      setIsTraining(false);
    }
  };

  // Run What-If Prediction logic
  const runPrediction = async (modelId: string, inputs: Record<string, any>) => {
    if (!currentDataset) return;
    setIsPredicting(true);
    try {
      const pred = await api.predictAutoML(currentDataset.id, {
        model_id: modelId,
        feature_inputs: inputs
      });
      setPredictionResult(pred);
    } catch (err) {
      console.error('What-If simulation failed', err);
    } finally {
      setIsPredicting(false);
    }
  };

  // Trigger prediction on user interaction
  const handleSimulateWhatIf = () => {
    if (!automlResult) return;
    runPrediction(automlResult.model_id, simInputs);
  };

  // Handle slider or input change with debounce for auto-simulation
  const handleInputChange = (feat: string, val: any) => {
    const updated = { ...simInputs, [feat]: val };
    setSimInputs(updated);

    if (autoSimulate && automlResult) {
      if (simDebounceRef.current) clearTimeout(simDebounceRef.current);
      simDebounceRef.current = setTimeout(() => {
        runPrediction(automlResult.model_id, updated);
      }, 250);
    }
  };

  // Quick Preset Handlers
  const handleApplyPreset = (preset: 'mean' | 'min' | 'max') => {
    if (!activeTable || !automlResult) return;
    const newInputs: Record<string, any> = {};

    automlResult.features_used.forEach((feat) => {
      const colMeta = activeTable.columns.find((c) => c.column_name === feat);
      if (colMeta?.data_type === 'numeric') {
        const stats = colMeta.statistics;
        if (preset === 'mean') {
          newInputs[feat] = stats?.mean !== undefined ? Math.round(stats.mean * 10) / 10 : 50;
        } else if (preset === 'min') {
          newInputs[feat] = stats?.min !== undefined ? stats.min : 0;
        } else if (preset === 'max') {
          newInputs[feat] = stats?.max !== undefined ? stats.max : 100;
        }
      } else if (colMeta?.sample_values?.length) {
        newInputs[feat] = String(colMeta.sample_values[0]);
      } else {
        newInputs[feat] = 0;
      }
    });

    setSimInputs(newInputs);
    runPrediction(automlResult.model_id, newInputs);
  };

  // Copy Python Snippet
  const handleCopyPythonSnippet = () => {
    if (!automlResult) return;
    const snippet = `# DATOVA AutoML Champion Inference
import pickle

# 1. Load exported model weights
with open("${automlResult.champion_model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_champion.pkl", "rb") as f:
    model = pickle.load(f)

# 2. Features payload: ${JSON.stringify(automlResult.features_used)}
sample_input = ${JSON.stringify(simInputs, null, 2)}

# 3. Real-time inference
prediction = model.predict([list(sample_input.values())])
print("Champion Prediction (${automlResult.target_column}):", prediction[0])
`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Run Pareto Analysis
  const handleRunPareto = async () => {
    if (!currentDataset || !paretoDimension || !paretoMetric) return;
    setIsParetoLoading(true);
    try {
      const res = await api.getParetoAnalysis(
        currentDataset.id,
        paretoDimension,
        paretoMetric,
        35,
        selectedTable || activeTable?.table_name
      );
      setParetoResult(res);
    } catch (err) {
      console.error('Pareto analysis failed', err);
    } finally {
      setIsParetoLoading(false);
    }
  };

  // Run Multivariate Regression
  const handleRunRegression = async () => {
    if (!currentDataset || !regressionTarget) return;
    setIsRegressionLoading(true);
    try {
      const res = await api.getMultivariateRegression(
        currentDataset.id,
        regressionTarget,
        undefined,
        selectedTable || activeTable?.table_name
      );
      setRegressionResult(res);
    } catch (err) {
      console.error('Regression analysis failed', err);
    } finally {
      setIsRegressionLoading(false);
    }
  };

  // Sorted leaderboard entries
  const sortedLeaderboard = useMemo(() => {
    if (!automlResult?.leaderboard) return [];
    return [...automlResult.leaderboard].sort((a, b) => {
      let comparison = 0;
      if (leaderboardSortBy === 'rank') {
        comparison = a.rank - b.rank;
      } else if (leaderboardSortBy === 'latency') {
        comparison = a.latency_ms - b.latency_ms;
      } else if (leaderboardSortBy === 'metric') {
        const valA = automlResult.task_type === 'classification' ? (a.accuracy || 0) : (a.r_squared || 0);
        const valB = automlResult.task_type === 'classification' ? (b.accuracy || 0) : (b.r_squared || 0);
        comparison = valB - valA;
      }
      return leaderboardSortDir === 'asc' ? comparison : -comparison;
    });
  }, [automlResult, leaderboardSortBy, leaderboardSortDir]);

  // Filtered Pareto items
  const filteredParetoItems = useMemo(() => {
    if (!paretoResult?.items) return [];
    return paretoResult.items.filter((item) => {
      const matchesSearch = item.label.toLowerCase().includes(paretoSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (paretoFilter === 'vital') return item.is_vital_few;
      if (paretoFilter === 'tail') return !item.is_vital_few;
      return true;
    });
  }, [paretoResult, paretoSearch, paretoFilter]);

  // Pareto Chart Data (Top 18 items + cumulative line)
  const paretoChartData = useMemo(() => {
    if (!paretoResult?.items) return [];
    return paretoResult.items.slice(0, 18).map((it) => ({
      name: it.label.length > 14 ? it.label.substring(0, 12) + '...' : it.label,
      fullName: it.label,
      value: it.value,
      cumulative: it.cumulative_pct,
      isVital: it.is_vital_few
    }));
  }, [paretoResult]);

  // Regression Tornado Chart Data
  const regressionChartData = useMemo(() => {
    if (!regressionResult?.coefficients) return [];
    return regressionResult.coefficients
      .slice(0, 12)
      .map((c) => ({
        feature: c.feature.length > 15 ? c.feature.substring(0, 13) + '..' : c.feature,
        fullFeature: c.feature,
        coefficient: c.coefficient,
        isSignificant: c.is_statistically_significant,
        color: c.coefficient >= 0 ? '#10B981' : '#F43F5E'
      }))
      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }, [regressionResult]);

  return (
    <div className="p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-28 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn text-slate-100 w-full overflow-y-auto">
      {/* ========================================================= */}
      {/* STUDIO HERO HEADER                                        */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#07132B] via-[#0B1A38] to-[#0A2244] border border-cyan-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-xl shadow-cyan-600/30 border border-cyan-400/30">
              <BrainCircuit className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                  AutoML & Econometric Studio
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                  Autonomous ML v3.4
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Benchmark
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Autonomous algorithm tournament, Permutation Feature Importance, Real-Time 'What-If' Simulation, Pareto 80/20 concentration, and OLS regression.
              </p>
            </div>
          </div>

          {/* Table Selector & Sub-Tab Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {availableTables.length > 1 && (
              <div className="flex items-center gap-2 bg-[#060F22]/90 border border-cyan-500/30 rounded-2xl px-3.5 py-2 text-xs shadow-inner">
                <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-400 font-medium">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => handleTableChange(e.target.value)}
                  className="select-dark bg-[#070F22] text-white font-bold focus:outline-none cursor-pointer text-xs rounded-lg px-2 py-1 border border-blue-900/60"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  {availableTables.map((t) => (
                    <option key={t.table_name} value={t.table_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                      {t.table_name} ({t.row_count.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="tabs-3d-rail flex p-1 bg-[#060F22]/90 border border-blue-900/60 rounded-2xl shadow-inner">
              <button
                onClick={() => setActiveSubTab('automl')}
                className={`tab-3d-item flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === 'automl'
                    ? 'tab-3d-item-active bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>AutoML Benchmark</span>
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('pareto');
                  if (!paretoResult) handleRunPareto();
                }}
                className={`tab-3d-item flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === 'pareto'
                    ? 'tab-3d-item-active bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Pareto 80/20</span>
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('regression');
                  if (!regressionResult) handleRunRegression();
                }}
                className={`tab-3d-item flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === 'regression'
                    ? 'tab-3d-item-active bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>OLS Regression</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: AUTOML BENCHMARK & SIMULATION                      */}
      {/* ========================================================= */}
      {activeSubTab === 'automl' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Small Table Warning Notice */}
          {activeTable && activeTable.row_count < 8 && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Table <strong className="text-white">{selectedTable}</strong> has only {activeTable.row_count} rows. Machine learning models require at least 8 rows for validation splits.
                </span>
              </div>
              {availableTables.some((t) => t.row_count >= 8) && (
                <button
                  onClick={() => handleTableChange(availableTables.find((t) => t.row_count >= 8)!.table_name)}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl font-bold text-amber-200 text-xs shrink-0 cursor-pointer transition"
                >
                  Switch to {availableTables.find((t) => t.row_count >= 8)!.table_name} ({availableTables.find((t) => t.row_count >= 8)!.row_count.toLocaleString()} rows)
                </button>
              )}
            </div>
          )}

          {/* Configuration & Target Space Control Center */}
          <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-900/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Step 1: Configure Predictive Space
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Define the target column to predict and choose which features the model should train on.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-400">
                <span className="px-2.5 py-1 rounded-lg bg-[#070D1E] border border-blue-900/60 font-mono text-cyan-300">
                  {activeTable?.row_count?.toLocaleString()} Records
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#070D1E] border border-blue-900/60 font-mono text-cyan-300">
                  {allColumns.length} Total Columns
                </span>
              </div>
            </div>

            {/* Target & Task Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Target Variable Dropdown */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Target Variable to Predict</span>
                  <span className="text-[10px] text-cyan-400 font-normal">AI Recommended</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedTarget}
                    onChange={(e) => handleTargetChange(e.target.value)}
                    className="select-dark w-full bg-[#070F22] border border-blue-900/80 text-white text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-cyan-400 transition cursor-pointer font-semibold shadow-inner"
                    style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                  >
                    {candidates.length > 0 ? (
                      <>
                        <optgroup label="AI Recommended Targets" style={{ backgroundColor: '#070F22', color: '#38BDF8' }}>
                          {candidates.map((cand) => (
                            <option key={cand.column_name} value={cand.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                              {cand.column_name} ({cand.task_type.toUpperCase()}) {cand.is_recommended ? '★ Recommended' : ''}
                            </option>
                          ))}
                        </optgroup>
                        {activeTable?.columns
                          .filter((c) => !candidates.some((cand) => cand.column_name === c.column_name))
                          .length > 0 && (
                          <optgroup label="Other Columns in Table" style={{ backgroundColor: '#070F22', color: '#94A3B8' }}>
                            {activeTable.columns
                              .filter((c) => !candidates.some((cand) => cand.column_name === c.column_name))
                              .map((c) => (
                                <option key={c.column_name} value={c.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                                  {c.column_name} ({c.data_type.toUpperCase()})
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      activeTable?.columns.map((c) => (
                        <option key={c.column_name} value={c.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                          {c.column_name} ({c.data_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400">
                  The model will discover non-linear patterns that predict this variable.
                </p>
              </div>

              {/* Task Type Override */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Optimization Objective
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="select-dark w-full bg-[#070F22] border border-blue-900/80 text-white text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-cyan-400 transition cursor-pointer font-semibold shadow-inner"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  <option value="auto" style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>Auto-Detect Objective (Recommended)</option>
                  <option value="classification" style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>Classification (Categories / Discrete)</option>
                  <option value="regression" style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>Regression (Continuous Numeric)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  {taskType === 'regression' || (taskType === 'auto' && candidates.find(c => c.column_name === selectedTarget)?.task_type === 'regression')
                    ? 'Optimizes R² Score and Root Mean Squared Error (RMSE).'
                    : 'Optimizes Classification Accuracy and Weighted F1-Score.'}
                </p>
              </div>

              {/* Launch Action */}
              <div className="flex flex-col justify-end space-y-2">
                <button
                  onClick={handleTrainAutoML}
                  disabled={isTraining || !selectedTarget || (activeTable?.row_count !== undefined && activeTable.row_count < 8)}
                  className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isTraining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Benchmarking Models...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Launch AutoML Tournament</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>Holdout: 80% Train / 20% Test</span>
                  <span className="text-cyan-400">4 Candidate Algos</span>
                </div>
              </div>
            </div>

            {/* Feature Space Selector with Search and Smart Filters */}
            <div className="space-y-3 pt-2 border-t border-blue-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Input Predictor Features ({selectedFeatures.length} of {allColumns.filter(c => c !== selectedTarget).length} selected)
                  </span>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter features..."
                      value={featureSearch}
                      onChange={(e) => setFeatureSearch(e.target.value)}
                      className="input-dark bg-[#070F22] border border-blue-900/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                      style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                    />
                  </div>

                  <div className="flex items-center bg-[#060F22] border border-blue-900/60 rounded-xl p-0.5 text-[11px]">
                    <button
                      onClick={() => setFeatureTypeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition ${
                        featureTypeFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFeatureTypeFilter('numeric')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition ${
                        featureTypeFilter === 'numeric' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      Numeric
                    </button>
                    <button
                      onClick={() => setFeatureTypeFilter('categorical')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition ${
                        featureTypeFilter === 'categorical' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      Categorical
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs pl-1">
                    <button
                      onClick={() => setSelectedFeatures(allColumns.filter((c) => c !== selectedTarget))}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => setSelectedFeatures([])}
                      className="text-[11px] text-slate-400 hover:text-slate-300 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Feature Chips Grid */}
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 pr-2">
                {filteredAvailableFeatures.map((col) => {
                  const isSelected = selectedFeatures.includes(col);
                  const colMeta = activeTable?.columns.find((c) => c.column_name === col);
                  const isNumeric = colMeta?.data_type === 'numeric';

                  return (
                    <button
                      key={col}
                      onClick={() => toggleFeature(col)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold shadow-sm'
                          : 'bg-[#060F22] border-blue-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500">
                        {isNumeric ? <Hash className="w-3 h-3 text-cyan-400 inline" /> : <Tag className="w-3 h-3 text-purple-400 inline" />}
                      </span>
                      <span>{col}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-400 shadow-sm' : 'bg-slate-700'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {trainingError && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{trainingError}</span>
            </div>
          )}

          {/* Stepped In-Flight Training Animation */}
          {isTraining && (
            <div className="border border-cyan-500/40 rounded-3xl bg-[#0B152B]/90 p-8 sm:p-10 text-center space-y-6 backdrop-blur-xl shadow-2xl animate-pulse">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/20">
                <BrainCircuit className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-wide">
                  Autonomous ML Pipeline In Flight
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Training candidate models, computing validation loss, and ranking algorithms...
                </p>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                {[
                  { step: 1, label: 'Data Preprocessing', sub: 'Imputation & Scaling' },
                  { step: 2, label: 'Holdout Partitioning', sub: '80% Train / 20% Val' },
                  { step: 3, label: 'Tournament Benchmarking', sub: 'Multi-Algorithm Grid' },
                  { step: 4, label: 'Feature Importance', sub: 'Permutation Sensitivity' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                      trainingStep >= s.step
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-sm'
                        : 'bg-[#060F22] border-blue-950 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>Step {s.step}</span>
                      {trainingStep >= s.step && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <p className="text-xs font-semibold text-white">{s.label}</p>
                    <p className="text-[10px] text-slate-400">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State before first training */}
          {!automlResult && !isTraining && (
            <div className="border border-blue-900/50 rounded-3xl bg-[#0B152B]/50 p-12 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-white">AutoML Benchmark Ready</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Select your target variable and click <strong>Launch AutoML Tournament</strong>. The system will benchmark Decision Trees, Regularized Ensembles, and Random Forests, rank holdout validation accuracy, and extract feature weights.
                </p>
              </div>
            </div>
          )}

          {/* Results: Champion + Leaderboard + Simulator */}
          {automlResult && (
            <div className="space-y-8 animate-fadeIn">
              {/* Champion Model 3D Holographic Showcase */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0B1B3D] via-[#0E2554] to-[#0A1A3A] border border-cyan-400/50 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-cyan-400 to-blue-500 shadow-md" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-[0_8px_25px_rgba(245,158,11,0.4)] border border-amber-200">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm">
                          Champion Algorithm
                        </span>
                        <span className="text-xs text-slate-300">
                          Target: <strong className="text-cyan-300">{automlResult.target_column}</strong>
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
                        {automlResult.champion_model}
                      </h2>
                      <p className="text-xs text-slate-300 max-w-xl">
                        Ranked #1 out of {automlResult.leaderboard.length} benchmarked model families on holdout validation data with lowest generalization error.
                      </p>
                    </div>
                  </div>

                  {/* Champion Metrics Pills & Quick Actions */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-5 bg-[#060F22]/90 px-6 py-4 rounded-2xl border border-cyan-500/40 shadow-inner">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {automlResult.primary_metric_name}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono drop-shadow-md">
                          {automlResult.primary_metric_value}
                        </span>
                      </div>
                      <div className="w-px h-8 bg-blue-900/60" />
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Latency
                        </span>
                        <span className="text-sm font-bold text-slate-200 flex items-center gap-1 font-mono">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          {automlResult.leaderboard[0]?.latency_ms} ms
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleCopyPythonSnippet}
                      className="px-4 py-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {copiedSnippet ? <Check className="w-4 h-4 text-emerald-400" /> : <Code2 className="w-4 h-4 text-cyan-400" />}
                      <span>{copiedSnippet ? 'Snippet Copied!' : 'Python Inference'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid: Leaderboard & Feature Importance */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 3D Model Tournament Leaderboard */}
                <div className="lg:col-span-7 bg-[#0B152B]/90 border border-blue-900/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      <span>Model Tournament Leaderboard</span>
                    </h3>

                    {/* Sorting selector */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Sort:</span>
                      <button
                        onClick={() => {
                          setLeaderboardSortBy('metric');
                          setLeaderboardSortDir(leaderboardSortDir === 'desc' ? 'asc' : 'desc');
                        }}
                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                          leaderboardSortBy === 'metric'
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'border-slate-800 text-slate-400'
                        }`}
                      >
                        Performance
                      </button>
                      <button
                        onClick={() => {
                          setLeaderboardSortBy('latency');
                          setLeaderboardSortDir(leaderboardSortDir === 'asc' ? 'desc' : 'asc');
                        }}
                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                          leaderboardSortBy === 'latency'
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'border-slate-800 text-slate-400'
                        }`}
                      >
                        Latency
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-blue-900/60 text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3">Rank</th>
                          <th className="py-3 px-3">Algorithm</th>
                          <th className="py-3 px-3">Family</th>
                          <th className="py-3 px-3 text-right">
                            {automlResult.task_type === 'classification' ? 'Accuracy' : 'R² Fit'}
                          </th>
                          <th className="py-3 px-3 text-right">
                            {automlResult.task_type === 'classification' ? 'F1 Score' : 'RMSE'}
                          </th>
                          <th className="py-3 px-3 text-right">Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-950/60">
                        {sortedLeaderboard.map((entry) => {
                          const championScore = automlResult.task_type === 'classification'
                            ? (automlResult.leaderboard[0]?.accuracy || 100)
                            : (automlResult.leaderboard[0]?.r_squared || 1);
                          const currentScore = automlResult.task_type === 'classification'
                            ? (entry.accuracy || 0)
                            : (entry.r_squared || 0);
                          const relativePct = championScore > 0 ? Math.round((currentScore / championScore) * 100) : 100;

                          return (
                            <tr
                              key={entry.rank}
                              className={`transition ${
                                entry.is_champion
                                  ? 'bg-cyan-500/15 font-bold border-l-2 border-cyan-400'
                                  : 'hover:bg-blue-950/30'
                              }`}
                            >
                              <td className="py-3.5 px-3">
                                {entry.is_champion ? (
                                  <span className="inline-flex items-center gap-1 text-amber-400 font-extrabold text-[11px]">
                                    <Trophy className="w-3.5 h-3.5" /> #1
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium font-mono">#{entry.rank}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-100">{entry.model_name}</span>
                                  {entry.is_champion && (
                                    <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                      Champion
                                    </span>
                                  )}
                                </div>
                                {/* Relative Performance Bar */}
                                <div className="w-28 bg-[#060F22] h-1.5 rounded-full overflow-hidden mt-1">
                                  <div
                                    className="h-full bg-cyan-400 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(10, relativePct))}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-3.5 px-3">
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950 text-slate-300 border border-blue-900/60 font-mono">
                                  {entry.algorithm_family}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono text-cyan-300 font-bold">
                                {automlResult.task_type === 'classification' ? `${entry.accuracy}%` : entry.r_squared}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                                {automlResult.task_type === 'classification' ? entry.f1_score : entry.rmse}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                                {entry.latency_ms} ms
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Predictive Feature Importance */}
                <div className="lg:col-span-5 bg-[#0B152B]/90 border border-blue-900/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Feature Sensitivity Ranking</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Permutation Weights</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Sensitivity analysis reveals which features carry the highest leverage in driving predictions for <strong>{automlResult.target_column}</strong>.
                  </p>

                  <div className="space-y-3 pt-2 max-h-[360px] overflow-y-auto pr-1">
                    {automlResult.feature_importance.map((feat, idx) => (
                      <div key={feat.feature} className="space-y-1.5 p-2 rounded-xl bg-[#060F22] border border-blue-950">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 truncate flex items-center gap-2">
                            <span className="text-[10px] text-cyan-400 font-mono font-bold">#{idx + 1}</span>
                            <span>{feat.feature}</span>
                          </span>
                          <span className="font-mono text-cyan-300 font-bold">{feat.importance_pct}%</span>
                        </div>
                        <div className="w-full bg-[#08132B] rounded-full h-2 overflow-hidden shadow-inner border border-slate-900">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-teal-300 rounded-full transition-all duration-700 shadow-sm"
                            style={{ width: `${Math.max(4, feat.importance_pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-Time 'What-If' Prediction Simulator */}
              <div className="bg-[#0B152B]/95 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/50 pb-5">
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>Interactive 'What-If' Inference Sandbox</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Adjust input sliders to evaluate real-time outputs generated by the Champion model.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Presets */}
                    <div className="flex items-center bg-[#060F22] border border-blue-900/60 rounded-xl p-0.5 text-xs">
                      <span className="text-[11px] text-slate-400 px-2 font-medium">Presets:</span>
                      <button
                        onClick={() => handleApplyPreset('mean')}
                        className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-blue-900/40 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Mean
                      </button>
                      <button
                        onClick={() => handleApplyPreset('min')}
                        className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-blue-900/40 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Min
                      </button>
                      <button
                        onClick={() => handleApplyPreset('max')}
                        className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-blue-900/40 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Max
                      </button>
                    </div>

                    <button
                      onClick={handleSimulateWhatIf}
                      disabled={isPredicting}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition"
                    >
                      {isPredicting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Run Prediction</span>
                    </button>
                  </div>
                </div>

                {/* Input Grid with Sliders + Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {automlResult.features_used.map((feat) => {
                    const colMeta = activeTable?.columns.find((c) => c.column_name === feat);
                    const isNum = colMeta?.data_type === 'numeric';
                    const val = simInputs[feat] !== undefined ? simInputs[feat] : '';
                    const min = colMeta?.statistics?.min ?? 0;
                    const max = colMeta?.statistics?.max ?? 100;
                    const step = max > 100 ? 1 : 0.1;

                    return (
                      <div key={feat} className="bg-[#060F22] p-3.5 rounded-2xl border border-blue-950 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-semibold text-slate-200 truncate" title={feat}>
                            {feat}
                          </label>
                          {isNum && (
                            <span className="font-mono text-cyan-300 text-xs font-bold">
                              {typeof val === 'number' ? val.toLocaleString() : val}
                            </span>
                          )}
                        </div>

                        {isNum ? (
                          <div className="space-y-1.5">
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={step}
                              value={typeof val === 'number' ? val : min}
                              onChange={(e) => handleInputChange(feat, parseFloat(e.target.value) || 0)}
                              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                            />
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                              <span>{min.toLocaleString()}</span>
                              <span>{max.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleInputChange(feat, e.target.value)}
                            className="input-dark w-full bg-[#070F22] border border-blue-900/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
                            style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Projected Prediction Result Card */}
                {predictionResult && (
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-[#06142E] via-[#0A2048] to-[#071836] border border-cyan-500/40 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-fadeIn shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-lg shadow-cyan-500/20">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Neural Inference Readout ({predictionResult.target_column})
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                          {predictionResult.task_type === 'classification' ? (
                            <>
                              <span className="text-cyan-300 font-mono">{predictionResult.predicted_label}</span>
                              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                {predictionResult.confidence_pct}% Confidence
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-cyan-300 font-mono">
                                {predictionResult.predicted_value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                              {predictionResult.range_lower !== undefined && predictionResult.range_upper !== undefined && (
                                <span className="text-xs text-slate-400 font-medium">
                                  (95% CI: {predictionResult.range_lower?.toLocaleString(undefined, { maximumFractionDigits: 2 })} – {predictionResult.range_upper?.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-right text-slate-400 space-y-1">
                      <div>Computed using <strong className="text-slate-100">{automlResult.champion_model}</strong></div>
                      <div className="text-[11px] text-cyan-400 font-mono">Inference time: ~12ms</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PARETO 80/20 CONCENTRATION ANALYSIS               */}
      {/* ========================================================= */}
      {activeSubTab === 'pareto' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-900/40 pb-5">
              <div className="space-y-1">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-cyan-400" />
                  <span>Pareto (80/20 Rule) Concentration Visualizer</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Identifies the 'Vital Few' entities generating 80% of aggregate metric volume and computes the Gini inequality coefficient.
                </p>
              </div>

              {/* Dimension & Metric Selectors */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={paretoDimension}
                  onChange={(e) => setParetoDimension(e.target.value)}
                  className="select-dark bg-[#070F22] border border-blue-900/80 text-white text-xs rounded-xl px-3.5 py-2 cursor-pointer font-semibold"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  {activeTable?.columns
                    .filter((c) => (c.data_type === 'categorical' || c.data_type === 'text') && !c.is_identifier)
                    .map((c) => (
                      <option key={c.column_name} value={c.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                        Dim: {c.column_name}
                      </option>
                    ))}
                </select>

                <select
                  value={paretoMetric}
                  onChange={(e) => setParetoMetric(e.target.value)}
                  className="select-dark bg-[#070F22] border border-blue-900/80 text-white text-xs rounded-xl px-3.5 py-2 cursor-pointer font-semibold"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  {activeTable?.columns
                    .filter((c) => c.data_type === 'numeric' && !c.is_identifier)
                    .map((c) => (
                      <option key={c.column_name} value={c.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                        Metric: {c.column_name}
                      </option>
                    ))}
                </select>

                <button
                  onClick={handleRunPareto}
                  disabled={isParetoLoading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isParetoLoading ? 'Analyzing...' : 'Run Pareto'}
                </button>
              </div>
            </div>

            {paretoResult && (
              <div className="space-y-6 pt-2">
                {/* Executive Takeaway Callout */}
                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-3.5 shadow-sm">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />
                  <div>
                    <strong className="block text-sm text-white mb-1">Executive Pareto Takeaway</strong>
                    <p className="leading-relaxed">{paretoResult.executive_takeaway}</p>
                  </div>
                </div>

                {/* Pareto Telemetry Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Aggregate Volume</span>
                    <span className="text-xl font-black text-white block font-mono">{paretoResult.total_value.toLocaleString()}</span>
                    <p className="text-[11px] text-slate-500">{paretoResult.total_entities} distinct entities evaluated</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Vital Few Entities</span>
                    <span className="text-xl font-black text-cyan-300 block font-mono">
                      {paretoResult.vital_few_count} ({paretoResult.vital_few_entity_pct}%)
                    </span>
                    <p className="text-[11px] text-slate-500">Entities driving 80% volume threshold</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Vital Volume Share</span>
                    <span className="text-xl font-black text-amber-400 block font-mono">
                      {paretoResult.vital_few_volume_pct}%
                    </span>
                    <p className="text-[11px] text-slate-500">Concentrated volume contribution</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Gini Inequality Coefficient</span>
                    <span className="text-xl font-black text-indigo-300 block font-mono">
                      {paretoResult.gini_coefficient}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {paretoResult.gini_coefficient > 0.6 ? 'High Concentration / Skew' : 'Moderate Concentration'}
                    </p>
                  </div>
                </div>

                {/* Dual-Axis Pareto Visualizer (Bar + Cumulative Line) */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#060F22] border border-blue-950 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>Dual-Axis Pareto Distribution Curve</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Individual entity volumes (bars) overlaid with cumulative % curve (line). Dashed marker denotes 80% cutoff.
                      </p>
                    </div>
                  </div>

                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={paretoChartData} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} />
                        <XAxis
                          dataKey="name"
                          stroke="#64748B"
                          fontSize={11}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis yAxisId="left" stroke="#64748B" fontSize={11} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#F59E0B"
                          fontSize={11}
                          domain={[0, 100]}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#070F22',
                            borderColor: '#1E3A8A',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#FFFFFF'
                          }}
                          formatter={(val: any, name: string) => [
                            name === 'value' ? val.toLocaleString() : `${val}%`,
                            name === 'value' ? 'Volume' : 'Cumulative Share'
                          ]}
                        />
                        <ReferenceLine
                          yAxisId="right"
                          y={80}
                          stroke="#EF4444"
                          strokeDasharray="4 4"
                          label={{ value: '80% Cutoff', fill: '#EF4444', fontSize: 10, position: 'top' }}
                        />
                        <Bar yAxisId="left" dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]}>
                          {paretoChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.isVital ? '#06B6D4' : '#334155'} />
                          ))}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#F59E0B"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#F59E0B' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pareto Breakdown Table with Search & Filter */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Entity Concentration Breakdown ({filteredParetoItems.length})
                    </h3>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search entity..."
                          value={paretoSearch}
                          onChange={(e) => setParetoSearch(e.target.value)}
                          className="input-dark bg-[#070F22] border border-blue-900/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                          style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                        />
                      </div>

                      <div className="flex items-center bg-[#060F22] border border-blue-900/60 rounded-xl p-0.5 text-[11px]">
                        <button
                          onClick={() => setParetoFilter('all')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            paretoFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setParetoFilter('vital')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            paretoFilter === 'vital' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          Vital 80%
                        </button>
                        <button
                          onClick={() => setParetoFilter('tail')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            paretoFilter === 'tail' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          Long Tail
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-blue-950 bg-[#060F22]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-blue-900/60 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60">
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">{paretoResult.dimension_col}</th>
                          <th className="py-3 px-4 text-right">Volume</th>
                          <th className="py-3 px-4 text-right">Share %</th>
                          <th className="py-3 px-4 text-right">Cumulative %</th>
                          <th className="py-3 px-4 text-center">Pareto Class</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-950/60">
                        {filteredParetoItems.map((item) => (
                          <tr key={item.rank} className={item.is_vital_few ? 'bg-cyan-500/5 hover:bg-cyan-500/10' : 'hover:bg-blue-950/30'}>
                            <td className="py-3 px-4 font-mono text-slate-400">#{item.rank}</td>
                            <td className="py-3 px-4 font-semibold text-slate-200">{item.label}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-100">{item.value.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">{item.share_pct}%</td>
                            <td className="py-3 px-4 text-right font-mono text-cyan-300 font-bold">{item.cumulative_pct}%</td>
                            <td className="py-3 px-4 text-center">
                              {item.is_vital_few ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  Vital 80%
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">Long Tail</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MULTIVARIATE OLS REGRESSION                        */}
      {/* ========================================================= */}
      {activeSubTab === 'regression' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#0B152B]/95 border border-blue-900/60 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-900/40 pb-5">
              <div className="space-y-1">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Multivariate OLS Regression Engine</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Ordinary Least Squares econometric fitting with p-values, t-statistics, and model equations.
                </p>
              </div>

              {/* Target Selector */}
              <div className="flex items-center gap-3">
                <select
                  value={regressionTarget}
                  onChange={(e) => setRegressionTarget(e.target.value)}
                  className="select-dark bg-[#070F22] border border-blue-900/80 text-white text-xs rounded-xl px-3.5 py-2 cursor-pointer font-semibold"
                  style={{ backgroundColor: '#070F22', color: '#FFFFFF', colorScheme: 'dark' }}
                >
                  {activeTable?.columns
                    .filter((c) => c.data_type === 'numeric' && !c.is_identifier)
                    .map((c) => (
                      <option key={c.column_name} value={c.column_name} style={{ backgroundColor: '#070F22', color: '#FFFFFF' }}>
                        Target: {c.column_name}
                      </option>
                    ))}
                </select>

                <button
                  onClick={handleRunRegression}
                  disabled={isRegressionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isRegressionLoading ? 'Fitting OLS...' : 'Fit Regression'}
                </button>
              </div>
            </div>

            {regressionResult && (
              <div className="space-y-6 pt-2">
                {/* Fitted Formula Equation Box */}
                <div className="p-5 rounded-2xl bg-[#060F22] border border-cyan-500/30 space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Fitted Econometric Model Equation (OLS)
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(regressionResult.formula_equation);
                        setCopiedEquation(true);
                        setTimeout(() => setCopiedEquation(false), 2000);
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copiedEquation ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEquation ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs sm:text-sm text-cyan-300 break-words leading-relaxed">
                    {regressionResult.formula_equation}
                  </div>
                </div>

                {/* Score Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">R² Coefficient</span>
                    <span className="text-xl font-black text-cyan-300 block font-mono">{regressionResult.r_squared}</span>
                    <p className="text-[11px] text-slate-500">Proportion of variance explained</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Adjusted R²</span>
                    <span className="text-xl font-black text-slate-200 block font-mono">{regressionResult.adjusted_r_squared}</span>
                    <p className="text-[11px] text-slate-500">Penalized for predictor count</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Residual Std Error</span>
                    <span className="text-xl font-black text-amber-400 block font-mono">{regressionResult.residual_std_error}</span>
                    <p className="text-[11px] text-slate-500">Unexplained standard deviation</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[#060F22] border border-blue-950 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Overall Fit Quality</span>
                    <span className="text-xl font-black text-indigo-300 block font-mono">{regressionResult.model_fit_quality}</span>
                    <p className="text-[11px] text-slate-500">{regressionResult.sample_size} sample rows fitted</p>
                  </div>
                </div>

                {/* Coefficient Tornado Chart */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#060F22] border border-blue-950 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>Regression Coefficient Impact (Tornado Chart)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Directional sensitivity: Green denotes positive leverage on {regressionResult.target_column}; Red denotes negative leverage.
                      </p>
                    </div>
                  </div>

                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={regressionChartData}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} />
                        <XAxis type="number" stroke="#64748B" fontSize={11} />
                        <YAxis dataKey="feature" type="category" stroke="#94A3B8" fontSize={11} width={80} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#070F22',
                            borderColor: '#1E3A8A',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#FFFFFF'
                          }}
                          formatter={(val: any) => [val, 'Coefficient (β)']}
                        />
                        <ReferenceLine x={0} stroke="#64748B" strokeWidth={1.5} />
                        <Bar dataKey="coefficient" radius={[4, 4, 4, 4]}>
                          {regressionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Coefficients Statistical Table */}
                <div className="overflow-x-auto rounded-2xl border border-blue-950 bg-[#060F22]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-blue-900/60 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/60">
                        <th className="py-3 px-4">Predictor Feature</th>
                        <th className="py-3 px-4 text-right">Coefficient (β)</th>
                        <th className="py-3 px-4 text-right">Std. Error</th>
                        <th className="py-3 px-4 text-right">t-Statistic</th>
                        <th className="py-3 px-4 text-right">p-Value</th>
                        <th className="py-3 px-4 text-center">Significance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-950/60">
                      {regressionResult.coefficients.map((c) => (
                        <tr key={c.feature} className="hover:bg-blue-950/30">
                          <td className="py-3 px-4 font-semibold text-slate-100">{c.feature}</td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${c.coefficient >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {c.coefficient}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">{c.standard_error}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-200">{c.t_statistic}</td>
                          <td className="py-3 px-4 text-right font-mono text-cyan-300">{c.p_value}</td>
                          <td className="py-3 px-4 text-center">
                            {c.is_statistically_significant ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                                p &lt; 0.05 ★
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Not Significant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
