import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle,
  Database,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Cpu,
  Trash2,
  Download,
  Copy,
  Check,
  BarChart2,
  Table as TableIcon,
  TrendingUp,
  FileText,
  RotateCcw,
  Sliders,
  PieChart,
  Activity,
  Mic,
  MicOff,
  Volume2,
  Lightbulb,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';
import { ChatMessage } from '../../types';
import { ChatInlineChart } from './ChatInlineChart';

export interface AskDatovaViewProps {
  compact?: boolean;
  activeTabLabel?: string;
  onOpenUpload?: () => void;
  refreshTrigger?: number;
  initialPrompt?: string;
  onInsertPromptRegister?: (fn: (text: string) => void) => void;
}

export const AskDatovaView: React.FC<AskDatovaViewProps> = ({
  compact = false,
  activeTabLabel,
  onOpenUpload,
  refreshTrigger,
  initialPrompt,
  onInsertPromptRegister,
}) => {
  const { currentDataset, activeSheetId, activeTab, setActiveTab } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewModes, setViewModes] = useState<Record<string, 'chart' | 'table'>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [thinkingPhase, setThinkingPhase] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [providerBadge, setProviderBadge] = useState<string>('Google Gemini Active (.env)');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (onInsertPromptRegister) {
      onInsertPromptRegister((text: string) => {
        setInputText((prev) => (prev ? `${prev} ${text}` : text));
      });
    }
  }, [onInsertPromptRegister]);

  useEffect(() => {
    api.getSettings().then(s => {
      if (s.gemini_configured) {
        setProviderBadge('Google Gemini Active (.env)');
      } else if (s.openai_configured) {
        setProviderBadge('OpenAI GPT Active (.env)');
      } else if (s.provider === 'ollama') {
        setProviderBadge('Ollama Local Active');
      } else {
        setProviderBadge('Deterministic Engine Active');
      }
    }).catch(() => {});
  }, []);

  // Animated thinking phase simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSending) {
      setThinkingPhase(0);
      interval = setInterval(() => {
        setThinkingPhase((prev) => (prev + 1) % 3);
      }, 900);
    }
    return () => clearInterval(interval);
  }, [isSending]);

  // Web Speech API dictation
  const toggleVoiceRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech-to-text dictation requires a browser supporting Web Speech API (e.g. Chrome or Edge).');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  // Dynamic smart suggestions based on current dataset schema
  const categorizedSuggestions = useMemo(() => {
    if (!currentDataset || !currentDataset.tables || currentDataset.tables.length === 0) {
      return {
        all: ['Which category performs best?', 'Show me the monthly trend', 'Find statistical anomalies', 'What is total revenue?'],
        trends: ['Show me the monthly trend over time', 'Growth trajectory by quarter'],
        comparative: ['Compare top 2 categories', 'Benchmark highest vs lowest performers'],
        diagnostics: ['Find statistical anomalies in data', 'Why did revenue drop?'],
        simulations: ['What if sales increase by 15%?', 'What features correlate with revenue?']
      };
    }
    const allCols: string[] = [];
    currentDataset.tables.forEach(t => t.columns?.forEach(c => allCols.push(c.column_name)));

    const dim = allCols.find(c => {
      const l = c.toLowerCase();
      return (
        !l.endsWith('id') &&
        !l.startsWith('id_') &&
        (l.includes('name') || l.includes('category') || l.includes('region') || l.includes('product') || l.includes('country') || l.includes('department'))
      );
    }) || 'Category';

    const met = allCols.find(c => {
      const l = c.toLowerCase();
      return (
        !l.endsWith('id') &&
        (l.includes('revenue') || l.includes('sales') || l.includes('amount') || l.includes('quantity') || l.includes('price') || l.includes('score') || l.includes('salary'))
      );
    }) || 'Value';

    const hasDate = allCols.some(c => {
      const l = c.toLowerCase();
      return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
    });

    const trends = [
      hasDate ? `Show monthly ${met} trend over time` : `Trend velocity of ${met}`,
      `Peak period of ${met}`
    ];

    const comparative = [
      `Compare top 2 ${dim}s by ${met}`,
      `Benchmark highest vs lowest ${dim}`,
      `Top 5 ${dim}s by ${met}`
    ];

    const diagnostics = [
      `Why did ${met} drop?`,
      'Find statistical anomalies in the data',
      `Show distribution of ${met}`
    ];

    const simulations = [
      `What if ${met} increases by 15%?`,
      `What features correlate with ${met}?`,
      `Simulate 10% decline in ${met}`
    ];

    const currentTab = activeTabLabel || activeTab;
    const tabPrompts: string[] = [];
    if (currentTab === 'forecast' || currentTab === 'Predictive Studio') {
      tabPrompts.push(`Forecast ${met} for next 6 months`, `Detect seasonal cyclicality in ${met}`);
    } else if (currentTab === 'clusters' || currentTab === 'ML Segments') {
      tabPrompts.push(`Segment data by ${dim} and ${met}`, `What distinguishes key customer segments?`);
    } else if (currentTab === 'dashboard' || currentTab === 'Dashboard') {
      tabPrompts.push(`Summarize overall dashboard performance for ${dim}`, `What is the average ${met}?`);
    } else if (currentTab === 'dataprep' || currentTab === 'Data Prep') {
      tabPrompts.push(`Audit data quality and missing values`, `Suggest data cleansing steps for ${met}`);
    } else if (currentTab === 'model' || currentTab === 'Model Studio') {
      tabPrompts.push(`Explain entity relationships across tables`, `Identify primary and foreign keys`);
    } else if (currentTab === 'insights' || currentTab === 'Insights') {
      tabPrompts.push(`Synthesize top 3 strategic insights`, `Find anomalies in ${dim}`);
    }

    const all = [
      ...tabPrompts,
      `Which ${dim} has highest ${met}?`,
      hasDate ? `Show monthly ${met} trend over time` : `Top 5 ${dim}s by ${met}`,
      `Compare top 2 ${dim}s`,
      `Why did ${met} drop?`,
      `What if ${met} increases by 15%?`,
      `What correlates with ${met}?`,
      'Find statistical anomalies'
    ];

    return { all, trends, comparative, diagnostics, simulations };
  }, [currentDataset, activeTab, activeTabLabel]);

  const fetchHistory = async () => {
    if (!currentDataset) return;
    try {
      const history = await api.getChatHistory(currentDataset.id);
      setMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentDataset, refreshTrigger]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  if (!currentDataset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
          🤖
        </div>
        <h3 className="text-base font-extrabold text-white mb-2 tracking-tight">Nova AI Analyst</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Nova is connected to your data and ready to answer complex analytical queries, simulate scenarios, and generate dynamic charts. Ingest a dataset to begin.
        </p>
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="btn-3d-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.35)]"
          >
            <Database className="w-4 h-4 text-cyan-300" />
            <span>Upload / Ingest Dataset</span>
          </button>
        )}
      </div>
    );
  }

  const handleSend = async (queryText?: string) => {
    const q = queryText || inputText;
    if (!q.trim() || isSending) return;

    setInputText('');
    setIsSending(true);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: 'temp',
      role: 'user',
      content: q,
      action_payload: {},
      citations: [],
      calculation_steps: [],
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api.sendChatQuery(currentDataset.id, q, activeSheetId || undefined);
      setMessages((prev) => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, res]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!currentDataset || isClearing) return;
    setIsClearing(true);
    try {
      await api.clearChatHistory(currentDataset.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportTranscript = () => {
    if (messages.length === 0) return;
    const lines = [
      `# DATOVA AI Analysis Transcript`,
      `**Dataset:** ${currentDataset.name} (${currentDataset.detected_domain})`,
      `**Generated:** ${new Date().toLocaleString()}`,
      `\n---\n`
    ];

    messages.forEach((msg, idx) => {
      const isUser = msg.role === 'user';
      lines.push(`### ${isUser ? 'User' : 'DATOVA AI Analyst'}`);
      lines.push(`${msg.content}\n`);
      if (!isUser && msg.calculation_steps && msg.calculation_steps.length > 0) {
        lines.push(`**Deterministic Proof Steps:**`);
        msg.calculation_steps.forEach((s, sIdx) => {
          lines.push(`${sIdx + 1}. ${s.step}`);
        });
        lines.push('');
      }
      if (!isUser && msg.citations && msg.citations.length > 0) {
        lines.push(`**Citations:** ${msg.citations.map(c => `${c.table} [${c.columns.join(', ')}]`).join('; ')}\n`);
      }
      lines.push('---\n');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `datova_analysis_${currentDataset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleExportTableCsv = (title: string, tableData: { columns: string[]; rows: any[][] }) => {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        tableData.columns.join(','),
        ...tableData.rows.map((row) =>
          row.map((cell) => (typeof cell === 'number' ? cell : `"${String(cell).replace(/"/g, '""')}"`)).join(',')
        )
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render markdown-styled content
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-white text-xs tracking-tight pt-1.5 pb-1 border-b border-slate-800/80 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>{line.replace('### ', '')}</span>
              </h4>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const clean = line.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 text-slate-200">
                <span className="text-brand-400 font-bold">•</span>
                <span>{renderFormattedText(clean)}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            const num = line.match(/^(\d+\.)\s/)?.[1];
            const clean = line.replace(/^\d+\.\s/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 text-slate-200">
                <span className="text-brand-400 font-mono text-[11px] font-bold">{num}</span>
                <span>{renderFormattedText(clean)}</span>
              </div>
            );
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} className="text-slate-200">
              {renderFormattedText(line)}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper for bold and inline code in text
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="font-mono bg-slate-900/90 px-1 py-0.5 rounded text-brand-300 border border-slate-800 text-[10px]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const thinkingMessages = [
    'Parsing query intent & mapping schema...',
    'Executing deterministic Pandas aggregates...',
    'Grounding findings & synthesizing briefing...'
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
      {/* Top Banner — hidden in compact mode because Nova window chrome and context ribbon provide header */}
      {!compact && (
        <div className="px-4 sm:px-6 py-2.5 border-b border-white/[0.07] bg-[#090D18] flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {/* Back button to return to dashboard/overview */}
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-semibold transition active:scale-95 shadow-sm group mr-1"
              title="Back to Executive Overview"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>

            {/* Nova avatar — static CSS, no WebGL in header */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>ASK DATOVA</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Nova AI Analyst
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Active Context: <span className="text-slate-200 font-semibold">{currentDataset.name}</span> • {currentDataset.detected_domain} • {currentDataset.row_count.toLocaleString()} rows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-xl shadow-inner font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">{providerBadge}</span>
            </div>

            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportTranscript}
                  title="Download transcript as Markdown"
                  className="btn-3d-secondary px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Transcript</span>
                </button>

                <button
                  onClick={handleClearHistory}
                  disabled={isClearing}
                  title="Clear conversation history"
                  className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition active:translate-y-0.5 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages List */}
      <div className={`flex-1 overflow-y-auto ${compact ? 'p-3 space-y-3.5' : 'p-3.5 sm:p-5 md:p-8 space-y-5 sm:space-y-6'} max-w-4xl mx-auto w-full custom-scrollbar`}>
        {messages.length === 0 ? (
          <div className={`${compact ? 'py-4 space-y-4' : 'py-10 space-y-6'} text-center animate-fadeIn`}>
            {/* Nova 3D Robot in empty state */}
            <div className="flex flex-col items-center gap-2">
              <div className={`${compact ? 'w-16 h-16 text-3xl' : 'w-28 h-28 text-6xl'} rounded-2xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_32px_rgba(6,182,212,0.18)] mx-auto select-none`}>
                🤖
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Nova is ready to analyze your data
              </div>
            </div>
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h3 className={`font-extrabold ${compact ? 'text-base' : 'text-xl'} text-white tracking-tight`}>Ask Nova Anything About Your Data</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Type or speak any question in plain English — Nova will analyze your data and explain the results with charts, tables, and plain-language summaries.
              </p>
            </div>

            {/* Category tabs for prompt suggestions */}
            <div className="tabs-3d-rail max-w-md mx-auto justify-center">
              {[
                { id: 'all', label: 'All Prompts' },
                { id: 'trends', label: '📈 Trends' },
                { id: 'comparative', label: '⚖️ Comparative' },
                { id: 'diagnostics', label: '🔍 Root Cause' },
                { id: 'simulations', label: '🔮 What-If' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`tab-3d-item ${
                    activeCategory === tab.id ? 'tab-3d-item-active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Suggested prompts tailored to active category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 max-w-xl mx-auto text-left">
              {(categorizedSuggestions[activeCategory as keyof typeof categorizedSuggestions] || categorizedSuggestions.all).map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(sq)}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-brand-600/15 border border-slate-800/80 hover:border-brand-500/50 text-slate-300 hover:text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-start gap-2.5 group"
                >
                  <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="leading-snug">{sq}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Sticky Back to Original AI Page bar */}
            <div className="sticky top-0 z-20 -mt-1 pb-2 pt-1 bg-[#080D1A]/95 backdrop-blur-md border-b border-cyan-500/20 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={isClearing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs font-bold transition shadow-sm active:scale-95 group"
                title="Return to the original AI welcome page with prompt suggestions"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Original AI Page</span>
                <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">(New Question)</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportTranscript}
                  title="Download transcript as Markdown"
                  className="btn-3d-secondary px-2.5 py-1 rounded-lg text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={isClearing}
                  title="Clear conversation history"
                  className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[11px] font-medium flex items-center gap-1 transition active:translate-y-0.5"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const inlineChart = msg.action_payload?.chart;
            const hasInlineChart = inlineChart && inlineChart.data && inlineChart.data.length > 0;
            const tableData = msg.action_payload?.table_data;
            const hasTableData = tableData && tableData.rows && tableData.rows.length > 0;
            const kpiHighlights = msg.action_payload?.kpi_highlights;
            const followups = msg.action_payload?.suggested_followups;
            const currentMode = viewModes[msg.id] || (hasInlineChart ? 'chart' : 'table');

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-base shrink-0 mt-1">
                    🤖
                  </div>
                )}

                <div
                  className={`${compact ? 'max-w-[92%] p-3.5' : 'max-w-2xl p-5'} rounded-2xl text-xs leading-relaxed space-y-3.5 shadow-2xl relative overflow-hidden transition-all duration-200 ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-[0_8px_25px_rgba(37,99,235,0.35)] border border-blue-400/40 font-medium'
                      : 'glass-3d-card border border-cyan-500/20 text-slate-100 shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_30px_rgba(6,182,212,0.05)]'
                  }`}
                >
                  {/* Nova holographic top accent on AI messages */}
                  {!isUser && <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />}
                  {/* KPI Highlight Badges Strip */}
                  {!isUser && kpiHighlights && kpiHighlights.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-800/80">
                      {kpiHighlights.map((kpi: any, kIdx: number) => {
                        const colorMap: Record<string, string> = {
                          emerald: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
                          rose: 'border-rose-500/30 text-rose-300 bg-rose-500/10',
                          cyan: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
                          purple: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
                          amber: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
                          indigo: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10'
                        };
                        const tint = colorMap[kpi.color] || colorMap.indigo;

                        return (
                          <div key={kIdx} className={`p-2 rounded-xl border ${tint} backdrop-blur-sm`}>
                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{kpi.label}</p>
                            <p className="text-xs font-extrabold text-white mt-0.5 font-mono">{kpi.value}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    renderMessageContent(msg.content)
                  )}

                  {/* Dual Mode View Switcher (Chart ↔ Table) */}
                  {!isUser && hasInlineChart && hasTableData && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                      <span className="text-[10px] text-slate-400 font-medium">Analytical Presentation:</span>
                      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
                        <button
                          onClick={() => setViewModes(prev => ({ ...prev, [msg.id]: 'chart' }))}
                          className={`px-2.5 py-1 rounded flex items-center gap-1 transition ${
                            currentMode === 'chart'
                              ? 'bg-brand-600 text-white font-medium shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <BarChart2 className="w-3 h-3" />
                          <span>Chart View</span>
                        </button>
                        <button
                          onClick={() => setViewModes(prev => ({ ...prev, [msg.id]: 'table' }))}
                          className={`px-2.5 py-1 rounded flex items-center gap-1 transition ${
                            currentMode === 'table'
                              ? 'bg-brand-600 text-white font-medium shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <TableIcon className="w-3 h-3" />
                          <span>Table View</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chart View Rendering */}
                  {!isUser && hasInlineChart && (!hasTableData || currentMode === 'chart') && (
                    <ChatInlineChart
                      chart={inlineChart}
                      datasetId={currentDataset.id}
                      activeSheetId={activeSheetId || undefined}
                      onViewDashboard={() => setActiveTab('dashboard')}
                      onViewReport={() => setActiveTab('report')}
                    />
                  )}

                  {/* Table View Rendering */}
                  {!isUser && hasTableData && (!hasInlineChart || currentMode === 'table') && (
                    <div className="mt-3.5 rounded-xl border border-slate-700/70 bg-slate-950/80 p-4 backdrop-blur-md space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <TableIcon className="w-3.5 h-3.5 text-brand-400" />
                          <span>Tabular Findings Breakdown</span>
                        </span>
                        <button
                          onClick={() => handleExportTableCsv(inlineChart?.title || 'analytical_data', tableData)}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-56 scrollbar-thin">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              {tableData.columns.map((col: string, cIdx: number) => (
                                <th key={cIdx} className={`py-2.5 px-3 font-semibold ${cIdx > 0 ? 'text-right' : ''}`}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {tableData.rows.map((row: any[], rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-slate-900/40 transition">
                                {row.map((cell: any, cIdx: number) => (
                                  <td key={cIdx} className={`py-2.5 px-3 text-slate-300 ${cIdx === 0 ? 'font-medium text-slate-200' : 'font-mono text-right'}`}>
                                    {typeof cell === 'number' ? cell.toLocaleString() : cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action Execution Notification Pill */}
                  {msg.action_type && (
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-brand-300 font-bold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Action Executed: {msg.action_type.replace('_', ' ')}</span>
                      </div>
                      {msg.action_type === 'CREATE_CHART' && (
                        <button
                          onClick={() => setActiveTab('dashboard')}
                          className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition"
                        >
                          <span>View on Dashboard</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {msg.action_type === 'ADD_TO_REPORT' && (
                        <button
                          onClick={() => setActiveTab('report')}
                          className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition"
                        >
                          <span>View in Briefing</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Calculation Proof Steps & Execution Duration */}
                  {!isUser && msg.calculation_steps && msg.calculation_steps.length > 0 && (
                    <details className="mt-2 text-[10px] text-slate-400 group select-none">
                      <summary className="cursor-pointer hover:text-slate-200 flex items-center gap-1 font-mono transition">
                        <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                        <span className="flex items-center gap-1 text-slate-400 font-semibold">
                          <Cpu className="w-2.5 h-2.5 text-brand-400" />
                          Deterministic reasoning proof ({msg.calculation_steps.length} steps)
                          {msg.action_payload?.execution_time_ms && (
                            <span className="text-emerald-400/90 ml-1">• {msg.action_payload.execution_time_ms} ms</span>
                          )}
                        </span>
                      </summary>
                      <div className="mt-2 pl-3 border-l-2 border-brand-500/40 space-y-1.5 py-1 font-mono text-[10px] text-slate-300">
                        {msg.calculation_steps.map((s, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-brand-400 font-bold">{idx + 1}.</span>
                            <span>{s.step}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Citations & Evidence */}
                  {!isUser && msg.citations && msg.citations.length > 0 && msg.citations[0].columns?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px] text-slate-400 border-t border-slate-800/60">
                      <span className="text-slate-400 font-medium">Verified from:</span>
                      {msg.citations.map((c, idx) => (
                        <span key={idx} className="font-mono bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300">
                          {c.table} [{c.columns.filter(Boolean).join(', ')}]
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Nova Output Explained — plain English for metric-heavy responses */}
                  {!isUser && (() => {
                    const hasNumbers = /\d+[.,]?\d*(%|\$|\s*(million|billion|thousand|k|m|b))?/i.test(msg.content);
                    const hasMetrics = /\b(revenue|sales|profit|margin|growth|trend|forecast|accuracy|score|rate|count|average|total|sum|mean|median)\b/i.test(msg.content);
                    if (!hasNumbers || !hasMetrics) return null;
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">Nova Explains the Numbers</span>
                        </div>
                        <p className="text-[10px] text-amber-100/80 leading-relaxed">
                          The numbers above come directly from your dataset — Nova calculated them using real aggregations (SUM, AVG, etc.) on your actual data rows. Higher values mean more volume/revenue in that segment. Percentages show share of total. If you see a trend, it means Nova detected a statistically consistent direction in your time-series data.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {['What does this mean for my business?', 'Show me a chart of this', 'How was this calculated?'].map((q, qi) => (
                            <button key={qi} onClick={() => handleSend(q)}
                              className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-300 hover:text-white hover:bg-amber-500/25 transition flex items-center gap-1">
                              {q} <ArrowRight className="w-2 h-2 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dynamic 1-Click Contextual Follow-Up Suggestions */}
                  {!isUser && followups && followups.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-brand-400" />
                        <span>Suggested Follow-up Inquiries:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {followups.map((fu: string, fIdx: number) => (
                          <button
                            key={fIdx}
                            onClick={() => handleSend(fu)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-brand-600/20 border border-slate-800 hover:border-brand-500/40 text-[11px] text-slate-300 hover:text-white transition shadow-sm flex items-center gap-1"
                          >
                            <span>{fu}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-brand-400 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Action Toolbar */}
                  {!isUser && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2 text-[10px] text-slate-400">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded transition"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Answer</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}

        {isSending && (
          <div className="flex gap-3 justify-start animate-fadeIn">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-base shrink-0">
              🤖
            </div>
            <div className="bg-[#0c1428] border border-cyan-500/20 rounded-2xl px-4 py-3 text-xs flex flex-col gap-2 shadow-lg min-w-[180px]">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent rounded-t-2xl" />
              <div className="flex items-center gap-2 text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span className="font-mono text-[11px] text-slate-200">{thinkingMessages[thinkingPhase]}</span>
              </div>
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5,6].map(i => (
                  <span key={i} className="w-1 rounded-full bg-cyan-500/50"
                    style={{ height: `${5 + Math.abs(Math.sin(i)) * 7}px` }} />
                ))}
                <span className="text-[9px] font-mono text-cyan-400/50 ml-1.5">Nova thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className={`p-3 border-t border-white/[0.07] bg-[#090D18] ${compact ? 'pb-3' : 'sm:p-4 pb-20 md:pb-4'}`}>
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Quick prompt shortcut chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            <span className="text-[10px] text-slate-400 shrink-0 font-medium">Quick Ask:</span>
            {(activeTab === 'forecast' ? [
              'Forecast next 6 months',
              'Detect seasonality',
              'What if +15% revenue?',
              'Anomalies'
            ] : activeTab === 'clusters' ? [
              'Segment into clusters',
              'Cluster distribution',
              'Top customer group',
              'Outliers'
            ] : activeTab === 'dataprep' ? [
              'Audit data quality',
              'Missing values check',
              'Find dirty records',
              'Clean data defects'
            ] : activeTab === 'model' ? [
              'Explain table relationships',
              'Identify primary keys',
              'Check referential integrity'
            ] : [
              'Forecast next 6 months',
              'Segment into clusters',
              'Clean data defects',
              'Compare top 2',
              'Why did sales drop?',
              'What if sales increase 15%?',
              'Find anomalies'
            ]).map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={isSending}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-brand-500/50 text-slate-300 hover:text-white text-[11px] font-medium transition-all shadow-sm hover:-translate-y-0.5 active:translate-y-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder={isListening ? "Listening... Speak your analytical question now..." : "Ask a question (e.g. 'Forecast revenue for next 6 months', 'Segment customers', 'Why did sales drop?')..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
              className={`flex-1 bg-slate-900/90 border rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner ${
                isListening ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-950/20' : 'border-slate-700/80 focus:border-brand-500 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)]'
              }`}
            />

            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleVoiceRecognition}
              disabled={isSending}
              className={`p-3 rounded-xl border transition flex items-center justify-center shrink-0 active:translate-y-0.5 ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_4px_15px_rgba(244,63,94,0.4)] animate-pulse'
                  : 'btn-3d-secondary border-slate-700/80 text-slate-300 hover:text-white'
              }`}
              title={isListening ? "Stop voice dictation" : "Dictate question with voice"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isSending}
              className="btn-3d-primary px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
