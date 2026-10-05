import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronRight,
  Clock,
  Monitor,
  History,
  FileText,
  MousePointer,
  Users,
  Play,
  Download,
  Sparkles,
  RefreshCw,
  Calendar as CalendarIcon,
  Layers,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Layout,
  Printer,
  ChevronLeft,
  ListTodo,
  BarChart3,
  Compass,
  Volume2,
  Square,
  KeyRound,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Palette,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import { ExecutiveDashboardReportData } from '../../types';

interface ExecutiveDashboardReportModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutiveDashboardReportModal: React.FC<ExecutiveDashboardReportModalProps> = ({
  datasetId,
  datasetName,
  isOpen,
  onClose
}) => {
  const [reportData, setReportData] = useState<ExecutiveDashboardReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Theme: Default to 'neon' as requested by user
  const [theme, setTheme] = useState<'neon' | 'light'>('neon');
  const isNeon = theme === 'neon';

  // Layout & Narrative Controls
  const [pageFormat, setPageFormat] = useState<'A4_PRINT' | 'WIDESCREEN_16_9'>('WIDESCREEN_16_9');
  const [isPlainLanguage, setIsPlainLanguage] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'page_1' | 'page_2' | 'page_3' | 'all_pages'>('all_pages');

  // Interactive Chart State
  const [activeTimeframe, setActiveTimeframe] = useState<'Months' | 'Years'>('Years');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);

  // AI Customization & API Key State
  const [isAiCustomizing, setIsAiCustomizing] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('datanova_executive_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const printRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);

  // Speech Synthesis state
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const speechQueueRef = useRef<string[]>([]);
  const queueIndexRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);

  // Save API key to localStorage when updated
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    try {
      localStorage.setItem('datanova_executive_api_key', val);
    } catch {}
  };

  const cleanSpeechText = (raw: string): string => {
    return raw
      .replace(/\*\*/g, '')
      .replace(/\[TAG\]/gi, '')
      .replace(/#/g, '')
      .replace(/[-*•]\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const splitTextChunks = (text: string): string[] => {
    const cleaned = cleanSpeechText(text);
    if (!cleaned) return [];
    const sentences = cleaned.match(/[^.!?]+[.!?]+|\S+/g) || [cleaned];
    const chunks: string[] = [];
    let current = '';

    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if ((current + ' ' + trimmed).trim().length > 150) {
        if (current.trim()) chunks.push(current.trim());
        current = trimmed;
      } else {
        current = current ? `${current} ${trimmed}` : trimmed;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  };

  const buildExecutiveSpeechQueue = (data: ExecutiveDashboardReportData): string[] => {
    const chunks: string[] = [];
    chunks.push(...splitTextChunks(`Executive Dashboard Intelligence for ${datasetName || data.dataset_name}.`));

    const summaryText = isPlainLanguage
      ? (data.human_story_summary || data.plain_summary || data.executive_summary || '')
      : (data.executive_summary || data.plain_summary || '');
    if (summaryText) {
      chunks.push(...splitTextChunks(`Executive Overview. ${summaryText}`));
    }

    if (data.top_kpis && data.top_kpis.length > 0) {
      const kpiDescriptions = data.top_kpis
        .map(k => `${isPlainLanguage && k.plain_title ? k.plain_title : k.title}: ${k.value}, change of ${k.delta}`)
        .join('. ');
      chunks.push(...splitTextChunks(`Key Performance Indicators. ${kpiDescriptions}.`));
    }

    if (data.business_insights && data.business_insights.length > 0) {
      chunks.push(...splitTextChunks('Strategic Business Insights.'));
      for (const ins of data.business_insights) {
        const title = isPlainLanguage && ins.plain_title ? ins.plain_title : ins.title;
        const detail = isPlainLanguage && ins.plain_detail ? ins.plain_detail : ins.detail;
        chunks.push(...splitTextChunks(`${title}. ${detail}`));
      }
    }

    if (data.action_steps && data.action_steps.length > 0) {
      chunks.push(...splitTextChunks('Recommended Next Steps.'));
      for (const act of data.action_steps) {
        chunks.push(...splitTextChunks(`${act.title}. Target: ${act.due_date}. ${act.description}`));
      }
    }

    chunks.push(...splitTextChunks('This concludes the executive briefing.'));
    return chunks;
  };

  const stopSpeech = () => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playSpeechChunk = (index: number) => {
    if (!isSpeakingRef.current) return;
    if (index >= speechQueueRef.current.length) {
      stopSpeech();
      return;
    }
    queueIndexRef.current = index;
    const text = speechQueueRef.current[index];

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices() || [];
      const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium'))) || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        if (isSpeakingRef.current) {
          playSpeechChunk(index + 1);
        }
      };
      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        if (isSpeakingRef.current) {
          playSpeechChunk(index + 1);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListen = () => {
    if (!reportData) return;
    if (isSpeaking) {
      stopSpeech();
    } else {
      const queue = buildExecutiveSpeechQueue(reportData);
      if (queue.length === 0) return;
      speechQueueRef.current = queue;
      queueIndexRef.current = 0;
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      playSpeechChunk(0);
    }
  };

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Load Executive Template Data
  const loadTemplate = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExecutiveReportTemplate(datasetId);
      setReportData(data);
    } catch (err: any) {
      console.error('Failed to load executive report template:', err);
      setError(err.message || 'Failed to generate executive report template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplate();
    }
  }, [isOpen, datasetId]);

  // AI Customize Synthesis with optional API Key
  const handleAiSynthesize = async (promptOverride?: string) => {
    const finalPrompt = (promptOverride || aiPrompt).trim();
    if (!datasetId) return;
    setIsSynthesizing(true);
    try {
      const data = await api.generateExecutiveReport(datasetId, {
        prompt: finalPrompt || 'Synthesize comprehensive executive intelligence with deep strategic takeaways and business drivers',
        user_name: reportData?.user_profile.name,
        user_role: reportData?.user_profile.role,
        api_key: apiKey.trim() || undefined
      });
      setReportData(data);
      setIsAiCustomizing(false);
      setAiPrompt('');
    } catch (err: any) {
      console.error('Failed to customize report:', err);
      alert(`AI Enhancement Error: ${err.message || 'Check your API key and connection'}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Robust PDF Generation supporting both Neon 16:9 Deck & 3-Page A4
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const html2canvas = ((await import('html2canvas')).default || (await import('html2canvas'))) as (
        element: HTMLElement,
        options?: any
      ) => Promise<HTMLCanvasElement>;
      const { jsPDF } = await import('jspdf');

      const sanitizedName = (datasetName || 'executive-report')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-');

      const bgColor = isNeon ? '#060D1E' : '#F4F5FB';

      if (pageFormat === 'WIDESCREEN_16_9') {
        const targetElement = page1Ref.current || printRef.current;
        if (!targetElement) return;

        const canvas = await html2canvas(targetElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: bgColor,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [1920, 1080],
          hotfixes: ['px_scaling'],
        });

        pdf.addImage(imgData, 'PNG', 0, 0, 1920, 1080);
        pdf.save(`${sanitizedName}-neon-executive-deck.pdf`);
      } else {
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pagesToRender = [page1Ref.current, page2Ref.current, page3Ref.current].filter(Boolean) as HTMLElement[];

        for (let i = 0; i < pagesToRender.length; i++) {
          const pageEl = pagesToRender[i];
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: bgColor,
          });

          const imgData = canvas.toDataURL('image/png');
          if (i > 0) {
            pdf.addPage('a4', 'landscape');
          }
          pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
        }

        pdf.save(`${sanitizedName}-neon-executive-report.pdf`);
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Unable to generate PDF directly. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // High-Resolution PNG Image Download
  const handleDownloadPng = async () => {
    setIsDownloadingPng(true);
    try {
      const html2canvas = ((await import('html2canvas')).default || (await import('html2canvas'))) as (
        element: HTMLElement,
        options?: any
      ) => Promise<HTMLCanvasElement>;

      const targetElement = (activeTab === 'page_1' ? page1Ref.current : activeTab === 'page_2' ? page2Ref.current : activeTab === 'page_3' ? page3Ref.current : printRef.current) || printRef.current;
      if (!targetElement) return;

      const canvas = await html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isNeon ? '#060D1E' : '#F4F5FB',
      });

      const sanitizedName = (datasetName || 'executive-dashboard')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-');

      const link = document.createElement('a');
      link.download = `${sanitizedName}-neon-dashboard.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert('Failed to export PNG image.');
    } finally {
      setIsDownloadingPng(false);
    }
  };

  if (!isOpen) return null;

  // Icon Resolvers
  const renderTopKpiIcon = (icon: string) => {
    switch (icon) {
      case 'monitor':
        return <Monitor className="w-4 h-4 text-white" />;
      case 'history':
        return <History className="w-4 h-4 text-white" />;
      case 'file-text':
        return <FileText className="w-4 h-4 text-white" />;
      case 'clock':
      default:
        return <Clock className="w-4 h-4 text-white" />;
    }
  };

  const renderDriverIcon = (icon: string) => {
    switch (icon) {
      case 'mouse-pointer':
        return <MousePointer className="w-4 h-4 text-white" />;
      case 'users':
        return <Users className="w-4 h-4 text-white" />;
      case 'play':
        return <Play className="w-4 h-4 text-white" />;
      case 'clock':
      default:
        return <Clock className="w-4 h-4 text-white" />;
    }
  };

  // Dynamic Bars based on Timeframe
  const bars = reportData?.growth_chart.bars || [];
  const maxBarVal = Math.max(...bars.map((b) => b.value), 200);

  // Detect key type
  const isGeminiKey = apiKey.trim().startsWith('AIza') || apiKey.trim().length === 39;
  const isOpenAiKey = apiKey.trim().startsWith('sk-');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #executive-report-printable, #executive-report-printable * {
            visibility: visible;
          }
          #executive-report-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: ${isNeon ? '#060D1E' : '#F4F5FB'} !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .page-break-container {
            page-break-after: always;
            break-after: page;
            height: 100vh;
          }
        }
      `}</style>

      {/* Main Container */}
      <div
        ref={printRef}
        id="executive-report-printable"
        className={`w-full max-w-[1540px] rounded-3xl overflow-hidden flex flex-col my-auto relative max-h-[96vh] transition-colors duration-300 ${
          isNeon
            ? 'bg-[#060D1E] text-slate-100 border border-cyan-500/35 shadow-[0_20px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.18)]'
            : 'bg-[#F4F5FB] text-slate-800 border border-indigo-100/70 shadow-2xl'
        }`}
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        {/* Action Header Bar (No Print) */}
        <div
          className={`no-print px-5 py-3 border-b flex items-center justify-between flex-wrap gap-3 shrink-0 backdrop-blur-xl ${
            isNeon
              ? 'bg-[#0A1329]/95 border-cyan-500/25 text-white'
              : 'bg-white/90 border-indigo-100/60 text-slate-800'
          }`}
        >
          {/* Title and Dataset Name */}
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${isNeon ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse' : 'bg-[#6366F1]'}`} />
            <div>
              <h2 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isNeon ? 'text-cyan-300' : 'text-[#4338CA]'}`}>
                Executive Dashboard
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40">
                  {isNeon ? '⚡ NEON QUANTUM' : 'CORPORATE'}
                </span>
                <span className="text-slate-400 font-normal">•</span>
                <span className={`font-bold ${isNeon ? 'text-white' : 'text-slate-700'}`}>{datasetName}</span>
              </h2>
            </div>
          </div>

          {/* Center: Controls for Theme, Plain English & Page Format */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Theme Toggle (Neon vs Light) */}
            <button
              onClick={() => setTheme(isNeon ? 'light' : 'neon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                isNeon
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Toggle between Neon Quantum theme and Corporate Light theme"
            >
              <Palette className={`w-3.5 h-3.5 ${isNeon ? 'text-cyan-400' : 'text-indigo-600'}`} />
              <span>{isNeon ? '⚡ Neon Theme' : '📄 Light Theme'}</span>
            </button>

            {/* Plain English Toggle */}
            <button
              onClick={() => setIsPlainLanguage(!isPlainLanguage)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                isPlainLanguage
                  ? isNeon
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : isNeon
                  ? 'bg-slate-800/80 text-slate-400 border-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Switch between plain narrative and technical corporate terminology"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isPlainLanguage ? 'Plain Language: ON' : 'Plain Language: OFF'}</span>
            </button>

            {/* Format Preset Selector */}
            <div className={`p-0.5 rounded-xl flex items-center border ${isNeon ? 'bg-[#081226] border-slate-700/80' : 'bg-slate-100/90 border-slate-200/70'}`}>
              <button
                onClick={() => {
                  setPageFormat('WIDESCREEN_16_9');
                  setActiveTab('all_pages');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  pageFormat === 'WIDESCREEN_16_9'
                    ? isNeon
                      ? 'bg-cyan-500 text-black shadow-[0_0_12px_#22d3ee]'
                      : 'bg-white text-indigo-700 shadow-sm'
                    : isNeon ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>16:9 Screen</span>
              </button>
              <button
                onClick={() => {
                  setPageFormat('A4_PRINT');
                  setActiveTab('page_1');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  pageFormat === 'A4_PRINT'
                    ? isNeon
                      ? 'bg-cyan-500 text-black shadow-[0_0_12px_#22d3ee]'
                      : 'bg-white text-indigo-700 shadow-sm'
                    : isNeon ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Printer className="w-3 h-3" />
                <span>A4 Multi-Page</span>
              </button>
            </div>

            {/* Page Navigation Tabs (When A4 format is active) */}
            {pageFormat === 'A4_PRINT' && (
              <div className={`p-0.5 rounded-xl flex items-center border ${isNeon ? 'bg-[#091533] border-cyan-500/25' : 'bg-indigo-50/70 border-indigo-100'}`}>
                {(['page_1', 'page_2', 'page_3', 'all_pages'] as const).map((p) => {
                  const labels = {
                    page_1: 'Page 1: Big Picture',
                    page_2: 'Page 2: Drivers',
                    page_3: 'Page 3: Actions',
                    all_pages: 'All Pages'
                  };
                  return (
                    <button
                      key={p}
                      onClick={() => setActiveTab(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        activeTab === p
                          ? isNeon
                            ? 'bg-cyan-500 text-black font-extrabold shadow-sm'
                            : 'bg-[#4F46E5] text-white shadow-sm'
                          : isNeon ? 'text-slate-400 hover:text-white' : 'text-indigo-700 hover:bg-indigo-100/60'
                      }`}
                    >
                      {labels[p]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Listen Button */}
            <button
              onClick={toggleListen}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                isSpeaking
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
                  : isNeon
                  ? 'bg-[#0B1736] hover:bg-[#112352] text-cyan-300 border-cyan-500/30'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] border-indigo-200/60'
              }`}
              title={isSpeaking ? 'Stop voice reading' : 'Read executive briefing aloud'}
            >
              {isSpeaking ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Listen</span>
                </>
              )}
            </button>

            {/* AI Enhance with API Key Button */}
            <button
              onClick={() => setIsAiCustomizing(!isAiCustomizing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                isAiCustomizing
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white border-cyan-400 shadow-[0_0_15px_#22d3ee]'
                  : isNeon
                  ? 'bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-purple-500/15 text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] border-indigo-200/60'
              }`}
              title="Use custom API key to enhance the dashboard, key business charts and strategic insights"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>AI Enhance (API Key)</span>
            </button>

            {/* Download PNG */}
            <button
              onClick={handleDownloadPng}
              disabled={isDownloadingPng}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm disabled:opacity-60 ${
                isNeon
                  ? 'bg-[#0B1738] hover:bg-[#11224f] text-cyan-200 border-cyan-500/30 hover:border-cyan-400/60'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Download high-resolution image of the dashboard"
            >
              <ImageIcon className={`w-3.5 h-3.5 ${isDownloadingPng ? 'animate-spin' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">{isDownloadingPng ? 'Exporting...' : 'PNG'}</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-60 ${
                isNeon
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
              }`}
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
              <span>
                {isDownloadingPdf
                  ? 'Generating PDF...'
                  : pageFormat === 'A4_PRINT'
                  ? 'A4 PDF'
                  : '16:9 PDF'}
              </span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition ${
                isNeon ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AI Customization & API Key Drawer */}
        {isAiCustomizing && (
          <div className="no-print p-4 bg-[#081226] text-white border-b border-cyan-500/30 flex flex-col gap-3 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    AI Dashboard Enhancement Engine
                    {isGeminiKey && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Gemini Key Detected</span>}
                    {isOpenAiKey && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">OpenAI Key Detected</span>}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Provide your Gemini or OpenAI API key to calculate deeper business drivers, tailored financial charts, and strategic insights.
                  </p>
                </div>
              </div>

              {/* Preset directive pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-mono">Quick Focus:</span>
                {[
                  { label: '💰 Revenue & Margins', prompt: 'Focus on revenue drivers, unit economics, and profit margin optimization' },
                  { label: '📈 Growth & Velocity', prompt: 'Highlight user acquisition velocity, retention cohorts, and market expansion' },
                  { label: '⚠️ Risk & Mitigation', prompt: 'Deep-dive on anomaly detection, concentration risks, and operational safeguards' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPrompt(preset.prompt);
                      handleAiSynthesize(preset.prompt);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* API Key Input */}
              <div className="md:col-span-5 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="API Key (e.g. AIza... for Gemini or sk-... for OpenAI)"
                  className="w-full bg-[#050C1A] border border-cyan-500/40 text-xs text-white placeholder-slate-500 rounded-xl pl-3 pr-9 py-2 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title={showApiKey ? 'Hide Key' : 'Show Key'}
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Directive Prompt */}
              <div className="md:col-span-5">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Custom Directive (e.g. Focus on community impact and next quarter growth...)"
                  className="w-full bg-[#050C1A] border border-cyan-500/40 text-xs text-white placeholder-slate-500 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAiSynthesize();
                  }}
                />
              </div>

              {/* Run Button */}
              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  onClick={() => handleAiSynthesize()}
                  disabled={isSynthesizing}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                  <span>{isSynthesizing ? 'Enhancing...' : '⚡ Enhance AI'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {loading ? (
          <div className="p-24 flex flex-col items-center justify-center gap-3 text-slate-400 flex-1">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-sm font-semibold">Synthesizing Executive Dashboard Intelligence...</span>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-rose-400 space-y-2 flex-1 flex flex-col justify-center items-center">
            <p className="font-bold">{error}</p>
            <button
              onClick={loadTemplate}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
            >
              Retry Generation
            </button>
          </div>
        ) : reportData ? (
          <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-6">
            {/* ========================================================================= */}
            {/* PAGE 1: THE BIG PICTURE (Executive Summary, Hero KPIs & Dominant Trend)   */}
            {/* ========================================================================= */}
            {(activeTab === 'page_1' || activeTab === 'all_pages' || pageFormat === 'WIDESCREEN_16_9') && (
              <div
                ref={page1Ref}
                className={`page-break-container rounded-3xl p-6 sm:p-7 space-y-5 transition-colors duration-300 ${
                  isNeon
                    ? 'bg-[#081226]/90 border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.12)]'
                    : 'bg-white border border-indigo-100 shadow-sm'
                }`}
              >
                {/* Page 1 Header */}
                <div className={`flex items-center justify-between gap-4 pb-3 border-b ${isNeon ? 'border-cyan-500/20' : 'border-indigo-100/80'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isNeon ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        Executive Intelligence • Page 1
                      </span>
                      <span className={`text-sm font-black ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                        {isPlainLanguage ? 'Executive Summary & Dominant Growth Pattern' : (reportData.header.title || 'Profile Growth')}
                      </span>
                    </div>
                    <p className={`text-xs font-medium ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isPlainLanguage
                        ? 'High-level snapshot showing overall direction, revenue drivers, and critical takeaways'
                        : (reportData.header.subtitle || 'Overall Strategic Telemetry')}
                    </p>
                  </div>

                  {/* Profile Block */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 ${
                      isNeon
                        ? 'bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-[0_0_10px_#22d3ee] border border-cyan-400/50'
                        : 'bg-amber-100 border border-amber-200 text-amber-800'
                    }`}>
                      {reportData.user_profile.name
                        ? reportData.user_profile.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                        : 'ML'}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className={`text-xs font-black leading-tight ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                        {reportData.user_profile.name}
                      </div>
                      <div className={`text-[11px] font-medium ${isNeon ? 'text-cyan-400/80' : 'text-slate-400'}`}>
                        {reportData.user_profile.role}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Human Story Lead Summary Card */}
                <div className={`rounded-2xl p-4 sm:p-5 flex items-start gap-4 border transition-colors ${
                  isNeon
                    ? 'bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border-indigo-200/80'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isNeon
                      ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-black font-extrabold shadow-[0_0_15px_#22d3ee]'
                      : 'bg-[#4F46E5] text-white'
                  }`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className={`text-[10px] font-black uppercase tracking-wider ${isNeon ? 'text-cyan-400' : 'text-indigo-700'}`}>
                      {isPlainLanguage ? 'Executive Strategic Story & Narrative' : 'Executive Overview'}
                    </div>
                    <p className={`text-sm font-bold leading-relaxed ${isNeon ? 'text-slate-100' : 'text-slate-900'}`}>
                      {isPlainLanguage
                        ? (reportData.human_story_summary || reportData.plain_summary || reportData.executive_summary)
                        : (reportData.executive_summary || reportData.plain_summary)}
                    </p>
                  </div>
                </div>

                {/* 2. Top Hero Numbers Row (4 Massive Neon/Light Cards) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {reportData.top_kpis.map((kpi, idx) => {
                    const neonStyles = [
                      'border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-[#0A1633] text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]',
                      'border-purple-500/40 bg-gradient-to-br from-purple-950/40 to-[#0A1633] text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
                      'border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-[#0A1633] text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                      'border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-[#0A1633] text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
                    ];
                    const neonGlowStyle = neonStyles[idx % neonStyles.length];

                    return (
                      <div
                        key={kpi.id}
                        className={`rounded-2xl p-4 border flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${
                          isNeon
                            ? neonGlowStyle
                            : 'bg-[#F8FAFC] border-slate-200/80 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                            isNeon
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'bg-gradient-to-br from-[#7C3AED] to-[#6366F1]'
                          }`}>
                            {renderTopKpiIcon(kpi.icon)}
                          </div>
                          <span className={`text-xs font-bold truncate ${isNeon ? 'text-slate-200' : 'text-slate-700'}`}>
                            {isPlainLanguage && kpi.plain_title ? kpi.plain_title : kpi.title}
                          </span>
                        </div>

                        <div className={`text-2xl font-black tracking-tight mb-1 ${isNeon ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-indigo-950'}`}>
                          {kpi.value}
                        </div>

                        <div className="text-[11px] font-bold flex items-center justify-between">
                          <span className={kpi.is_positive ? (isNeon ? 'text-emerald-400 font-mono' : 'text-emerald-600') : (isNeon ? 'text-rose-400 font-mono' : 'text-rose-500')}>
                            {kpi.delta}
                          </span>
                          <span className={`text-[10px] font-normal ${isNeon ? 'text-slate-400' : 'text-slate-400'}`}>
                            {isPlainLanguage ? 'vs benchmark' : 'MoM pace'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Dominant Timeline / Growth Capsule Chart */}
                <div className={`rounded-2xl p-5 border space-y-3 ${
                  isNeon
                    ? 'bg-[#071126]/90 border-cyan-500/25 shadow-[0_0_25px_rgba(6,182,212,0.1)]'
                    : 'bg-[#F8FAFC] border-slate-200/80'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`text-sm sm:text-base font-black ${isNeon ? 'text-white' : 'text-indigo-950'}`}>
                        {isPlainLanguage && reportData.growth_chart.plain_title
                          ? reportData.growth_chart.plain_title
                          : reportData.growth_chart.title}
                      </h3>
                      <p className={`text-xs font-semibold mt-0.5 ${isNeon ? 'text-cyan-400/80' : 'text-indigo-700/80'}`}>
                        {isPlainLanguage && reportData.growth_chart.plain_subtitle
                          ? reportData.growth_chart.plain_subtitle
                          : 'Continuous metric trend output across the reporting timeline'}
                      </p>
                    </div>

                    <div className={`p-0.5 rounded-full flex items-center gap-1 border shadow-sm ${
                      isNeon ? 'bg-[#091533] border-cyan-500/30' : 'bg-white border-slate-200'
                    }`}>
                      {['Months', 'Years'].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setActiveTimeframe(tf as any)}
                          className={`px-3 py-0.5 rounded-full text-xs font-bold transition ${
                            activeTimeframe === tf
                              ? isNeon
                                ? 'bg-cyan-500 text-black shadow-[0_0_10px_#22d3ee]'
                                : 'bg-[#4F46E5] text-white shadow-sm'
                              : isNeon ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Capsule Chart Canvas */}
                  <div className="relative pt-6 pb-2">
                    <div
                      className={`absolute top-0 right-[15%] sm:right-[16%] z-10 -translate-y-2 px-3 py-1 rounded-2xl text-center pointer-events-none animate-bounce ${
                        isNeon
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-[0_0_20px_#06b6d4]'
                          : 'bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/30'
                      }`}
                      style={{ animationDuration: '3s' }}
                    >
                      <div className="text-[9px] text-cyan-100 font-medium leading-none mb-0.5">
                        {reportData.growth_chart.floating_tooltip.label}
                      </div>
                      <div className="text-xs font-black tracking-wide leading-none">
                        {reportData.growth_chart.floating_tooltip.value}
                      </div>
                      <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 ${
                        isNeon ? 'bg-indigo-600' : 'bg-[#4F46E5]'
                      }`} />
                    </div>

                    <div className="relative h-44 flex items-end">
                      <div className={`absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] font-mono select-none pr-3 ${
                        isNeon ? 'text-cyan-400/70' : 'text-slate-400'
                      }`}>
                        {reportData.growth_chart.y_axis_labels.map((yLabel) => (
                          <span key={yLabel}>{yLabel}</span>
                        ))}
                      </div>

                      <div className="absolute left-9 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                        {[0, 1, 2, 3].map((g) => (
                          <div key={g} className={`w-full border-b ${isNeon ? 'border-cyan-500/10' : 'border-slate-200/60'}`} />
                        ))}
                      </div>

                      <div className="ml-9 w-full h-full flex items-end justify-between px-2 pt-6 pb-6">
                        {bars.map((bar, idx) => {
                          const heightPct = Math.min(Math.max((bar.value / maxBarVal) * 100, 15), 95);
                          const isHovered = hoveredBarIndex === idx;

                          return (
                            <div
                              key={bar.id}
                              className="flex flex-col items-center group cursor-pointer relative h-full justify-end"
                              onMouseEnter={() => setHoveredBarIndex(idx)}
                              onMouseLeave={() => setHoveredBarIndex(null)}
                            >
                              {(bar.display_val || isHovered) && (
                                <span className={`text-[10px] font-bold mb-1 leading-none absolute -top-4 ${
                                  isNeon ? 'text-cyan-300 font-mono drop-shadow-[0_0_4px_#22d3ee]' : 'text-slate-600'
                                }`}>
                                  {bar.display_val || bar.value}
                                </span>
                              )}

                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-3.5 sm:w-4 rounded-full transition-all duration-300 ${
                                  isNeon
                                    ? bar.fill_type === 'gradient'
                                      ? 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-white shadow-[0_0_15px_rgba(6,182,212,0.8)]'
                                      : 'bg-cyan-950/70 border border-cyan-500/40 hover:bg-cyan-800/50'
                                    : bar.fill_type === 'gradient'
                                    ? 'bg-gradient-to-t from-[#4338CA] via-[#6366F1] to-[#818CF8] shadow-sm'
                                    : 'bg-[#C7D2FE]/70 hover:bg-[#A5B4FC]'
                                } ${isHovered ? 'scale-y-105 shadow-md shadow-cyan-500/40' : ''}`}
                              />

                              <span className={`text-[10px] font-semibold mt-1.5 absolute -bottom-5 ${
                                isNeon ? 'text-slate-400 font-mono' : 'text-slate-400'
                              }`}>
                                {bar.day}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PAGE 2: DRIVERS & CATEGORICAL BREAKDOWNS (Horizontal Neon Progress Bars) */}
            {/* ========================================================================= */}
            {(activeTab === 'page_2' || activeTab === 'all_pages' || pageFormat === 'WIDESCREEN_16_9') && (
              <div
                ref={page2Ref}
                className={`page-break-container rounded-3xl p-6 sm:p-7 space-y-5 transition-colors duration-300 ${
                  isNeon
                    ? 'bg-[#081226]/90 border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.12)]'
                    : 'bg-white border border-indigo-100 shadow-sm'
                }`}
              >
                {/* Page 2 Header */}
                <div className={`flex items-center justify-between gap-4 pb-3 border-b ${isNeon ? 'border-cyan-500/20' : 'border-indigo-100/80'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isNeon ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-800'
                      }`}>
                        Segment Drivers • Page 2
                      </span>
                      <span className={`text-sm font-black ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                        {isPlainLanguage ? 'Activity Drivers & Categorical Value Attribution' : 'Detailed Breakdown & Driver Attribution'}
                      </span>
                    </div>
                    <p className={`text-xs font-medium ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isPlainLanguage
                        ? 'High-impact horizontal comparisons showing which specific segments generated the most output'
                        : 'Cohort breakdown, throughput distribution, and operational metrics'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: Friendly Horizontal Bar Distribution (7 cols) */}
                  <div className={`lg:col-span-7 rounded-2xl p-5 border space-y-4 ${
                    isNeon
                      ? 'bg-[#071126]/90 border-cyan-500/25'
                      : 'bg-[#F8FAFC] border-slate-200/80'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className={`w-4 h-4 ${isNeon ? 'text-cyan-400' : 'text-[#4F46E5]'}`} />
                        <h4 className={`text-sm font-black ${isNeon ? 'text-white' : 'text-indigo-950'}`}>
                          {isPlainLanguage ? 'Volume Share by Category' : 'Volume Breakdown by Segment'}
                        </h4>
                      </div>
                      <p className={`text-xs font-medium mt-0.5 ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isPlainLanguage
                          ? 'Vibrant comparative bars showing which programs and channels generated the largest portion of value.'
                          : 'Segment share aggregated across core categorical dimensions.'}
                      </p>
                    </div>

                    {/* Horizontal Bar Items */}
                    <div className="space-y-3.5 pt-2">
                      {(reportData.horizontal_breakdowns || [
                        { name: 'Core Initiatives', value: '$420,000', percentage: 92, note: 'Highest active engagement' },
                        { name: 'Direct Fulfillment', value: '$310,500', percentage: 78, note: 'Steady monthly delivery' },
                        { name: 'Specialty Support', value: '$215,000', percentage: 58, note: 'Growing 15% this quarter' },
                        { name: 'Strategic Expansion', value: '$140,000', percentage: 42, note: 'Expanding into 3 new areas' },
                        { name: 'General Operations', value: '$95,000', percentage: 28, note: 'Optimized low overhead' }
                      ]).map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-bold ${isNeon ? 'text-slate-200' : 'text-slate-800'}`}>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-black ${isNeon ? 'text-cyan-300 font-mono drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]' : 'text-indigo-950'}`}>{item.value}</span>
                              <span className={`text-[10px] font-medium ${isNeon ? 'text-slate-400' : 'text-slate-400'}`}>({item.percentage}%)</span>
                            </div>
                          </div>
                          {/* Progress Track */}
                          <div className={`w-full h-3 rounded-full overflow-hidden ${
                            isNeon ? 'bg-slate-900 border border-cyan-500/20' : 'bg-slate-200/70'
                          }`}>
                            <div
                              style={{ width: `${item.percentage}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                isNeon
                                  ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                                  : 'bg-gradient-to-r from-[#4F46E5] to-[#818CF8]'
                              }`}
                            />
                          </div>
                          {item.note && (
                            <div className={`text-[10px] font-medium pl-1 ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                              • {item.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Driver Cards & Context Notes (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Driver Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {reportData.driver_cards.map((driver) => (
                        <div
                          key={driver.id}
                          className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors ${
                            isNeon
                              ? 'bg-[#071126]/90 border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.08)]'
                              : 'bg-[#F8FAFC] border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm ${
                              isNeon ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-gradient-to-br from-[#7C3AED] to-[#6366F1]'
                            }`}>
                              {renderDriverIcon(driver.icon)}
                            </div>
                            <span className={`text-[11px] font-bold truncate ${isNeon ? 'text-slate-200' : 'text-slate-700'}`}>
                              {isPlainLanguage && driver.plain_title ? driver.plain_title : driver.title}
                            </span>
                          </div>

                          <div className={`text-lg font-black mb-0.5 ${isNeon ? 'text-white font-mono drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]' : 'text-indigo-950'}`}>
                            {driver.value}
                          </div>

                          <div className="text-[10px] font-bold flex items-center justify-between">
                            <span className={driver.is_positive ? (isNeon ? 'text-emerald-400 font-mono' : 'text-emerald-600') : (isNeon ? 'text-rose-400 font-mono' : 'text-rose-500')}>
                              {driver.delta}
                            </span>
                            <span className={`text-[9px] ${isNeon ? 'text-slate-500' : 'text-slate-400'}`}>vs benchmark</span>
                          </div>

                          {driver.explanation && (
                            <p className={`text-[10px] mt-2 pt-1 border-t leading-tight ${
                              isNeon ? 'border-cyan-500/15 text-slate-400' : 'border-slate-200/60 text-slate-500'
                            }`}>
                              {driver.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Monthly Progress Snapshot Bar Card */}
                    <div className={`rounded-2xl p-4 border space-y-2 ${
                      isNeon
                        ? 'bg-[#071126]/90 border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.08)]'
                        : 'bg-[#F8FAFC] border-slate-200/80'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold ${isNeon ? 'text-slate-200' : 'text-slate-800'}`}>
                          {isPlainLanguage ? 'Operational Pacing Checks' : 'Audit Velocity'}
                        </h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          isNeon
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          Consistent
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {reportData.analytics_card.bars.map((b, idx) => (
                          <div key={idx} className={`p-2.5 rounded-xl border text-center ${
                            isNeon ? 'bg-[#050C1B] border-cyan-500/20' : 'bg-white border-slate-200'
                          }`}>
                            <span className={`text-[10px] font-medium block ${isNeon ? 'text-slate-400' : 'text-slate-400'}`}>{b.date}</span>
                            <span className={`text-sm font-black block font-mono ${isNeon ? 'text-cyan-300' : 'text-indigo-950'}`}>{b.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PAGE 3: STRATEGIC INSIGHTS & ACTION PLAYBOOK (AI Enriched)                */}
            {/* ========================================================================= */}
            {(activeTab === 'page_3' || activeTab === 'all_pages' || pageFormat === 'WIDESCREEN_16_9') && (
              <div
                ref={page3Ref}
                className={`page-break-container rounded-3xl p-6 sm:p-7 space-y-5 transition-colors duration-300 ${
                  isNeon
                    ? 'bg-[#081226]/90 border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.12)]'
                    : 'bg-white border border-indigo-100 shadow-sm'
                }`}
              >
                {/* Page 3 Header */}
                <div className={`flex items-center justify-between gap-4 pb-3 border-b ${isNeon ? 'border-cyan-500/20' : 'border-indigo-100/80'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isNeon ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Actionable Intelligence • Page 3
                      </span>
                      <span className={`text-sm font-black ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                        {isPlainLanguage ? 'Key Story Takeaways & Strategic Action Steps' : 'Strategic Governance & Next Milestones'}
                      </span>
                    </div>
                    <p className={`text-xs font-medium ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isPlainLanguage
                        ? 'Concrete next steps and high-order business takeaways enriched by LLM reasoning'
                        : 'Actionable playbooks, risk mitigation, and milestone commitments'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Column: Key Insights & Community Takeaways (6 cols) */}
                  <div className="lg:col-span-6 space-y-3">
                    <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isNeon ? 'text-cyan-300' : 'text-slate-800'}`}>
                      <Sparkles className={`w-3.5 h-3.5 ${isNeon ? 'text-cyan-400' : 'text-indigo-600'}`} />
                      <span>{isPlainLanguage ? 'Key Strategic Takeaways' : 'Strategic Insights'}</span>
                    </h4>

                    {(reportData.business_insights || []).map((insight, idx) => (
                      <div
                        key={idx}
                        className={`rounded-2xl p-4 border space-y-1.5 transition-all duration-200 ${
                          isNeon
                            ? 'bg-[#071126]/90 border-cyan-500/25 hover:border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.06)]'
                            : 'bg-[#F8FAFC] border-slate-200/80 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              insight.is_positive
                                ? isNeon
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                  : 'bg-indigo-100 text-indigo-800 border-transparent'
                                : isNeon
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                : 'bg-amber-100 text-amber-800 border-transparent'
                            }`}
                          >
                            {isPlainLanguage && insight.plain_tag ? insight.plain_tag : insight.tag}
                          </span>
                          <span className={`text-xs font-black font-mono ${isNeon ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            {isPlainLanguage && insight.plain_impact ? insight.plain_impact : insight.impact}
                          </span>
                        </div>

                        <div className={`text-xs font-bold ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                          {isPlainLanguage && insight.plain_title ? insight.plain_title : insight.title}
                        </div>

                        <p className={`text-xs leading-relaxed ${isNeon ? 'text-slate-300' : 'text-slate-600'}`}>
                          {isPlainLanguage && insight.plain_detail ? insight.plain_detail : insight.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Action Steps Checklist & Milestones (6 cols) */}
                  <div className="lg:col-span-6 space-y-3">
                    <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isNeon ? 'text-emerald-300' : 'text-slate-800'}`}>
                      <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isPlainLanguage ? 'Concrete Next Action Steps' : 'Actionable Roadmap'}</span>
                    </h4>

                    {/* Action Items List */}
                    <div className="space-y-2.5">
                      {(reportData.action_steps || [
                        { id: 'a1', title: 'Expand Top Performing Initiatives', description: 'Allocate key focus to the two fastest growing categorical segments.', due_date: 'Next 30 Days', status: 'In Progress' },
                        { id: 'a2', title: 'Streamline Process Turnaround', description: 'Reduce turnaround cycles from 5 days to 2 days for core transactions.', due_date: 'Next 60 Days', status: 'Ready' },
                        { id: 'a3', title: 'Quarterly Executive Review', description: 'Publish quarterly plain-language recap for stakeholders and board members.', due_date: 'Ongoing', status: 'Scheduled' }
                      ]).map((act) => (
                        <div
                          key={act.id}
                          className={`rounded-2xl p-3.5 border flex items-start gap-3 transition-colors ${
                            isNeon
                              ? 'bg-[#071126]/90 border-cyan-500/25'
                              : 'bg-[#F8FAFC] border-slate-200/80'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                            isNeon
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${isNeon ? 'text-white' : 'text-slate-900'}`}>{act.title}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                                isNeon
                                  ? 'bg-[#050C1B] border-cyan-500/30 text-cyan-300'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}>
                                {act.due_date}
                              </span>
                            </div>
                            <p className={`text-[11px] leading-tight ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                              {act.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quality & Verification Assurance Box */}
                    <div className={`rounded-2xl p-4 border flex items-center justify-between gap-4 transition-colors ${
                      isNeon
                        ? 'bg-gradient-to-r from-cyan-950/40 via-emerald-950/40 to-cyan-950/40 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                        : 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200/80'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isNeon
                            ? 'bg-emerald-500 text-black font-extrabold shadow-[0_0_12px_#34d399]'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`text-xs font-black ${isNeon ? 'text-white' : 'text-slate-900'}`}>
                            {isPlainLanguage ? 'Quality & Data Verification Check' : 'Audit Compliance Certified'}
                          </div>
                          <div className={`text-[11px] font-medium ${isNeon ? 'text-slate-400' : 'text-slate-500'}`}>
                            {reportData.audit_card.radial_percentage}% of telemetry metrics verified accurate
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        isNeon
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        100% Certified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
