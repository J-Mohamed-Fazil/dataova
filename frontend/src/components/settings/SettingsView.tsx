import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Database,
  ShieldCheck,
  Key,
  CheckCircle2,
  Server,
  Code2,
  ExternalLink,
  Lock,
  User,
  GraduationCap,
  KeyRound,
  Zap,
  Activity,
  Check,
  AlertCircle,
  Sparkles,
  Bot
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { useAuth } from '../../store/authContext';
import { api } from '../../services/api';
import { UserProfileModal } from '../auth/UserProfileModal';

interface TestResult {
  status: 'success' | 'error' | 'idle';
  latency_ms?: number;
  message: string;
  model?: string;
  sample?: string;
}

export const SettingsView: React.FC = () => {
  const { currentDataset } = useWorkspace();
  const { user } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [provider, setProvider] = useState<string>('auto');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [openaiModel, setOpenaiModel] = useState<string>('gpt-4o');
  const [customOpenaiModel, setCustomOpenaiModel] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  
  const [showGeminiEdit, setShowGeminiEdit] = useState<boolean>(false);
  const [showOpenaiEdit, setShowOpenaiEdit] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  
  // Diagnostics & Connection Testing State
  const [isTestingOpenai, setIsTestingOpenai] = useState<boolean>(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<TestResult>({ status: 'idle', message: '' });

  const [configStatus, setConfigStatus] = useState<{
    openai_configured: boolean;
    gemini_configured: boolean;
    openai_masked: string;
    gemini_masked: string;
    openai_from_env?: boolean;
    gemini_from_env?: boolean;
    openai_model?: string;
  }>({
    openai_configured: false,
    gemini_configured: false,
    openai_masked: '',
    gemini_masked: '',
    openai_from_env: false,
    gemini_from_env: false,
    openai_model: 'gpt-4o'
  });

  const OPENAI_MODELS = [
    { id: 'gpt-4o', name: 'GPT-4o (Omni Flagship)', badge: 'Recommended', desc: 'Ultra-fast multimodal analytical intelligence' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', badge: 'Fast & Lightweight', desc: 'High-speed, cost-efficient data synthesis' },
    { id: 'o3-mini', name: 'o3-mini (Reasoning Engine)', badge: 'Deep Reasoning', desc: 'Advanced STEM & multi-step algorithmic calculations' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', badge: 'Frontier AI', desc: 'Next-generation maximum contextual reasoning' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', badge: '128k Context', desc: 'Large dataset prompt processing' },
  ];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        if (data.provider) setProvider(data.provider);
        if (data.openai_model) {
          const matched = OPENAI_MODELS.find(m => m.id === data.openai_model);
          if (matched) {
            setOpenaiModel(data.openai_model);
            setIsCustomModel(false);
          } else {
            setOpenaiModel('custom');
            setCustomOpenaiModel(data.openai_model);
            setIsCustomModel(true);
          }
        }
        setConfigStatus({
          openai_configured: data.openai_configured,
          gemini_configured: data.gemini_configured,
          openai_masked: data.openai_masked,
          gemini_masked: data.gemini_masked,
          openai_from_env: data.openai_from_env,
          gemini_from_env: data.gemini_from_env,
          openai_model: data.openai_model || 'gpt-4o'
        });
      } catch (err) {
        console.warn('Could not load current settings:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSaveKeys = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const activeModel = isCustomModel ? customOpenaiModel.trim() || 'gpt-4o' : openaiModel;
      const res = await api.updateSettings({
        openai_key: openaiKey.trim() || undefined,
        gemini_key: geminiKey.trim() || undefined,
        openai_model: activeModel,
        provider
      });
      setIsSaved(true);
      setStatusMsg('Configuration and model parameters saved successfully!');
      setConfigStatus({
        openai_configured: res.openai_configured,
        gemini_configured: res.gemini_configured,
        openai_masked: res.openai_configured ? (openaiKey ? `${openaiKey.slice(0, 4)}...${openaiKey.slice(-4)}` : configStatus.openai_masked) : '',
        gemini_masked: res.gemini_configured ? (geminiKey ? `${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)}` : configStatus.gemini_masked) : '',
        openai_from_env: res.openai_from_env,
        gemini_from_env: res.gemini_from_env,
        openai_model: res.openai_model || activeModel
      });
      setOpenaiKey('');
      setGeminiKey('');
      setShowGeminiEdit(false);
      setShowOpenaiEdit(false);
      setTimeout(() => {
        setIsSaved(false);
        setStatusMsg('');
      }, 3500);
    } catch (err) {
      setStatusMsg('Error saving configuration. Please verify backend is operational.');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = async (newProvider: string) => {
    setProvider(newProvider);
    try {
      await api.updateSettings({ provider: newProvider });
    } catch (err) {
      console.warn('Failed to update provider:', err);
    }
  };

  const handleModelChange = async (selectedModel: string) => {
    if (selectedModel === 'custom') {
      setIsCustomModel(true);
      setOpenaiModel('custom');
    } else {
      setIsCustomModel(false);
      setOpenaiModel(selectedModel);
      try {
        await api.updateSettings({ openai_model: selectedModel });
        setConfigStatus(prev => ({ ...prev, openai_model: selectedModel }));
      } catch (err) {
        console.warn('Failed to auto-update model:', err);
      }
    }
  };

  const handleTestOpenai = async () => {
    setIsTestingOpenai(true);
    setOpenaiTestResult({ status: 'idle', message: 'Testing OpenAI connection...' });
    try {
      const activeModel = isCustomModel ? customOpenaiModel.trim() || 'gpt-4o' : openaiModel;
      const res = await api.testLLMConnection({
        provider: 'openai',
        api_key: openaiKey.trim() || undefined,
        model: activeModel
      });
      setOpenaiTestResult({
        status: res.status,
        latency_ms: res.latency_ms,
        message: res.message,
        model: res.model,
        sample: res.sample
      });
    } catch (err: any) {
      setOpenaiTestResult({
        status: 'error',
        message: err.message || 'Connection test failed to complete.'
      });
    } finally {
      setIsTestingOpenai(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-28 space-y-6 sm:space-y-8 bg-[#090D16] max-w-4xl mx-auto w-full">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" />
            <span>System Settings & Architecture</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure analytical reasoning engines, external LLM providers, OpenAI models, and verify database connectivity.
          </p>
        </div>

        {/* Global Key Status Banner */}
        {configStatus.openai_configured && (
          <div className="p-4 rounded-2xl glass-3d-card bg-gradient-to-r from-cyan-950/60 via-slate-900/90 to-[#07131F] border border-cyan-500/40 shadow-[0_12px_30px_rgba(6,182,212,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-white">OpenAI Intelligence Engine Ready</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {configStatus.openai_model || 'gpt-4o'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  High-speed SSE streaming, multi-model fallback cascade, and reasoning model integrations are enabled.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
                Key: {configStatus.openai_masked || '••••••••'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* User Account & Security Settings Card */}
      <div className="p-4 sm:p-6 rounded-2xl glass-3d-card border border-slate-800/80 space-y-4 sm:space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">User Profile & Security Credentials</h3>
              <p className="text-xs text-slate-400">Edit your analytical role persona, name, and account password</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                user?.role === 'Student' || user?.role?.includes('Student')
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {user?.role?.includes('Student') && <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{user?.role || 'Data Analyst'}</span>
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#060D1D] border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <span>{user?.full_name}</span>
              <span className="text-[11px] text-cyan-400 font-mono font-normal">({user?.email})</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Customize your role to tailor Nova AI insights and automated calculations, or update your password.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="btn-3d-primary px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Edit Role & Password</span>
          </button>
        </div>
      </div>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* AI Provider Configuration */}
      <div className="p-4 sm:p-6 rounded-2xl glass-3d-card border border-slate-800/80 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">LLM Orchestration Layer</h3>
              <p className="text-xs text-slate-400">Select model provider, configure OpenAI reasoning models, and execute diagnostic latency tests</p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Operational
          </span>
        </div>

        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Active Provider Strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => handleProviderSelect('auto')}
                className={`card-3d-interactive p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  provider === 'auto'
                    ? 'bg-brand-600/20 border-cyan-500 text-brand-200 shadow-[0_6px_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Auto</span>
                  {(configStatus.gemini_configured || configStatus.openai_configured) && (
                    <span className="text-[10px] text-emerald-400 font-mono">✓ Active</span>
                  )}
                </div>
                <div className="text-[11px] mt-1 text-slate-300 leading-snug">
                  {configStatus.openai_configured ? (
                    <span className="text-cyan-400 font-medium">OpenAI {configStatus.openai_model || 'GPT-4o'}</span>
                  ) : configStatus.gemini_configured ? (
                    <span className="text-emerald-400 font-medium">Gemini 1.5/2.5 in .env</span>
                  ) : (
                    <span className="text-slate-400">Deterministic fallback</span>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('openai')}
                className={`card-3d-interactive p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  provider === 'openai'
                    ? 'bg-brand-600/20 border-cyan-500 text-brand-200 shadow-[0_6px_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-white flex items-center justify-between">
                  <span>OpenAI GPT</span>
                  {configStatus.openai_configured ? (
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold">
                      ✓ Present
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Not set</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">SSE streaming & deep reasoning</div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('gemini')}
                className={`card-3d-interactive p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  provider === 'gemini'
                    ? 'bg-brand-600/20 border-cyan-500 text-brand-200 shadow-[0_6px_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Google Gemini</span>
                  {configStatus.gemini_configured ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      .env
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Not set</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                  {configStatus.gemini_configured ? 'Active in .env (2.5 Flash)' : 'Structured generation'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('ollama')}
                className={`card-3d-interactive p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  provider === 'ollama'
                    ? 'bg-brand-600/20 border-cyan-500 text-brand-200 shadow-[0_6px_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Ollama</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Private</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">100% offline, zero cloud transfer</div>
              </button>
            </div>
          </div>

          {/* OpenAI Model Selector & Diagnostic Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3.5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">OpenAI Model & Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestOpenai}
                  disabled={isTestingOpenai || (!configStatus.openai_configured && !openaiKey)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingOpenai ? 'animate-spin' : ''}`} />
                  <span>{isTestingOpenai ? 'Testing Probe...' : 'Test OpenAI Connection'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Select OpenAI Model
                </label>
                <select
                  value={isCustomModel ? 'custom' : openaiModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {OPENAI_MODELS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.badge})
                    </option>
                  ))}
                  <option value="custom">Custom Model Name...</option>
                </select>
                {isCustomModel && (
                  <input
                    type="text"
                    placeholder="e.g. gpt-4o-2024-08-06 or fine-tuned model"
                    value={customOpenaiModel}
                    onChange={(e) => setCustomOpenaiModel(e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1.5">
                <div className="text-slate-400 font-medium">Model Capabilities & Architecture:</div>
                <div className="text-slate-200">
                  {isCustomModel
                    ? 'Custom model identifier will be queried with auto-detected streaming and JSON parameter optimizations.'
                    : OPENAI_MODELS.find(m => m.id === openaiModel)?.desc}
                </div>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-cyan-400/90 font-mono">
                  <span>✓ Real-time SSE token stream</span>
                  <span>•</span>
                  <span>✓ Multi-model fallback</span>
                </div>
              </div>
            </div>

            {/* Test result status indicator */}
            {openaiTestResult.status !== 'idle' && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fadeIn ${
                  openaiTestResult.status === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {openaiTestResult.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">{openaiTestResult.message}</span>
                    {openaiTestResult.sample && (
                      <span className="block text-[11px] opacity-80 mt-0.5 font-mono">
                        Verification Probe Reply: &ldquo;{openaiTestResult.sample}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
                {openaiTestResult.latency_ms && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/40 border border-current shrink-0">
                    {openaiTestResult.latency_ms} ms
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Key & Provider Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* OpenAI Section */}
            <div>
              {configStatus.openai_configured && !showOpenaiEdit ? (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">OpenAI API Key</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            API key is present
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Loaded securely from backend environment</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOpenaiEdit(true)}
                      className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                    >
                      Change Key
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-mono">
                      Masked Key: <strong className="text-slate-200">{configStatus.openai_masked || '••••••••••••••••'}</strong>
                    </span>
                    <span className="text-cyan-400 font-mono text-[10px]">OpenAI GPT Ready</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>OpenAI API Key</span>
                      {configStatus.openai_configured && (
                        <span className="text-[10px] text-cyan-400 font-normal">
                          ✓ Configured ({configStatus.openai_masked})
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      {configStatus.openai_configured && (
                        <button
                          type="button"
                          onClick={() => setShowOpenaiEdit(false)}
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      )}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-brand-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Get key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <input
                    type="password"
                    placeholder={configStatus.openai_configured ? "•••••••• Enter new key to overwrite ••••••••" : "sk-proj-..."}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Or add <code className="text-brand-300 font-mono">OPENAI_API_KEY</code> to backend/.env</p>
                </div>
              )}
            </div>

            {/* Google Gemini Section */}
            <div>
              {configStatus.gemini_configured && !showGeminiEdit ? (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">Google Gemini API Key</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            API key is present
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-400/90 font-medium">Loaded securely from environment (.env)</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGeminiEdit(true)}
                      className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                    >
                      Change Key
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-mono">
                      Masked Key: <strong className="text-slate-200">{configStatus.gemini_masked || '••••••••••••••••'}</strong>
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">Gemini 1.5/2.5 Connected</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>Gemini API Key</span>
                      {configStatus.gemini_configured && (
                        <span className="text-[10px] text-emerald-400 font-normal">
                          ✓ Configured ({configStatus.gemini_masked})
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      {configStatus.gemini_configured && (
                        <button
                          type="button"
                          onClick={() => setShowGeminiEdit(false)}
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      )}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-brand-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Get key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <input
                    type="password"
                    placeholder={configStatus.gemini_configured ? "•••••••• Enter new key to overwrite ••••••••" : "AIzaSy..."}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Or add <code className="text-brand-300 font-mono">GEMINI_API_KEY</code> to backend/.env</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-500" />
                {configStatus.gemini_configured || configStatus.openai_configured
                  ? 'Keys and model configuration are preserved securely in backend memory and environment.'
                  : 'Keys are stored securely in backend .env and memory, never exposed in client bundles.'}
              </p>
              {statusMsg && (
                <p className="text-[11px] text-cyan-400 mt-1 font-medium">{statusMsg}</p>
              )}
            </div>

            <button
              onClick={handleSaveKeys}
              disabled={loading}
              className="btn-3d-primary px-4 py-2 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Database & Infrastructure */}
      <div className="p-4 sm:p-6 rounded-2xl glass-3d-card border border-slate-800/80 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Database & Persistence</h3>
            <p className="text-xs text-slate-400">PostgreSQL Ready with SQLite local development fallback</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="card-3d-interactive p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-sm hover:border-slate-700">
            <span className="text-slate-400 font-medium">Database Backend</span>
            <p className="font-mono text-white">SQLite (Local) / PostgreSQL Compatible</p>
          </div>
          <div className="card-3d-interactive p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-sm hover:border-slate-700">
            <span className="text-slate-400 font-medium">ORM Layer</span>
            <p className="font-mono text-white">SQLAlchemy 2.0 (15 Registered Models)</p>
          </div>
        </div>
      </div>

      {/* Product Architecture Summary */}
      <div className="p-4 sm:p-6 rounded-2xl glass-3d-card border border-slate-800/80 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
          <Code2 className="w-4 h-4" />
          <span>Product Principle Verification</span>
        </div>
        <h4 className="font-bold text-sm text-white">Zero Fake Analytical Data Principle</h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          DATOVA AI executes all statistical distributions, group-bys, time-series resamplings, and anomaly evaluations via Python deterministic mathematical tools. The AI reasoning layer only interprets and communicates verified calculations.
        </p>
      </div>
    </div>
  );
};
