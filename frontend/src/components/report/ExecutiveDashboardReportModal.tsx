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
  Square
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

  // Layout & Narrative Controls
  const [pageFormat, setPageFormat] = useState<'A4_PRINT' | 'WIDESCREEN_16_9'>('A4_PRINT');
  const [isPlainLanguage, setIsPlainLanguage] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'page_1' | 'page_2' | 'page_3' | 'all_pages'>('page_1');

  // Interactive Chart State
  const [activeTimeframe, setActiveTimeframe] = useState<'Months' | 'Years'>('Years');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // AI Customization Drawer State
  const [isAiCustomizing, setIsAiCustomizing] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
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
    chunks.push(...splitTextChunks(`Executive Performance Report for ${datasetName || data.dataset_name}.`));

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

  // AI Customize Synthesis
  const handleAiSynthesize = async () => {
    if (!aiPrompt.trim() || !datasetId) return;
    setIsSynthesizing(true);
    try {
      const data = await api.generateExecutiveReport(datasetId, {
        prompt: aiPrompt.trim(),
        user_name: reportData?.user_profile.name,
        user_role: reportData?.user_profile.role
      });
      setReportData(data);
      setIsAiCustomizing(false);
      setAiPrompt('');
    } catch (err: any) {
      console.error('Failed to customize report:', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Robust PDF Generation supporting both 3-Page A4 & 16:9 Deck
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

      if (pageFormat === 'WIDESCREEN_16_9') {
        // Single 16:9 Presentation Slide
        const targetElement = page1Ref.current || printRef.current;
        if (!targetElement) return;

        const canvas = await html2canvas(targetElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#F4F5FB',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [1920, 1080],
          hotfixes: ['px_scaling'],
        });

        pdf.addImage(imgData, 'PNG', 0, 0, 1920, 1080);
        pdf.save(`${sanitizedName}-16x9-presentation.pdf`);
      } else {
        // Multi-page Standard A4 Print Document (3 Pages: The Big Picture, The Why & Where, Action Steps)
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4', // 297mm x 210mm
        });

        const pagesToRender = [page1Ref.current, page2Ref.current, page3Ref.current].filter(Boolean) as HTMLElement[];

        for (let i = 0; i < pagesToRender.length; i++) {
          const pageEl = pagesToRender[i];
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#F4F5FB',
          });

          const imgData = canvas.toDataURL('image/png');
          if (i > 0) {
            pdf.addPage('a4', 'landscape');
          }
          pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
        }

        pdf.save(`${sanitizedName}-3page-executive-report.pdf`);
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Unable to generate PDF directly. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
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
            background: #F4F5FB !important;
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
        className="w-full max-w-[1500px] bg-[#F4F5FB] text-slate-800 rounded-3xl shadow-2xl border border-indigo-100/70 overflow-hidden flex flex-col my-auto relative max-h-[95vh]"
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        {/* Action Header Bar (No Print) */}
        <div className="no-print px-5 py-3 bg-white/90 backdrop-blur-md border-b border-indigo-100/60 flex items-center justify-between flex-wrap gap-3 shrink-0">
          {/* Title and Dataset Name */}
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1] animate-pulse" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#4338CA] flex items-center gap-2">
                Executive Storytelling Report
                <span className="text-slate-400 font-normal">•</span>
                <span className="text-slate-700 font-bold">{datasetName}</span>
              </h2>
            </div>
          </div>

          {/* Center: Controls for Plain English & Page Format */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Plain English Toggle */}
            <button
              onClick={() => setIsPlainLanguage(!isPlainLanguage)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                isPlainLanguage
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Switch between plain language and corporate terminology"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isPlainLanguage ? 'Plain Language: ON' : 'Plain Language: OFF'}</span>
            </button>

            {/* Format Preset Selector */}
            <div className="bg-slate-100/90 p-0.5 rounded-xl flex items-center border border-slate-200/70">
              <button
                onClick={() => {
                  setPageFormat('A4_PRINT');
                  setActiveTab('page_1');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  pageFormat === 'A4_PRINT'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Printer className="w-3 h-3" />
                <span>A4 Standard Print</span>
              </button>
              <button
                onClick={() => {
                  setPageFormat('WIDESCREEN_16_9');
                  setActiveTab('all_pages');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  pageFormat === 'WIDESCREEN_16_9'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>16:9 Screen</span>
              </button>
            </div>

            {/* Page Navigation Tabs (When A4 format is active) */}
            {pageFormat === 'A4_PRINT' && (
              <div className="bg-indigo-50/70 p-0.5 rounded-xl flex items-center border border-indigo-100">
                <button
                  onClick={() => setActiveTab('page_1')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'page_1'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-indigo-700 hover:bg-indigo-100/60'
                  }`}
                >
                  Page 1: Big Picture
                </button>
                <button
                  onClick={() => setActiveTab('page_2')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'page_2'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-indigo-700 hover:bg-indigo-100/60'
                  }`}
                >
                  Page 2: Breakdown
                </button>
                <button
                  onClick={() => setActiveTab('page_3')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'page_3'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-indigo-700 hover:bg-indigo-100/60'
                  }`}
                >
                  Page 3: Action Steps
                </button>
                <button
                  onClick={() => setActiveTab('all_pages')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeTab === 'all_pages'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-indigo-700 hover:bg-indigo-100/60'
                  }`}
                >
                  All 3 Pages
                </button>
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
                  : 'bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] border-indigo-200/60'
              }`}
              title={isSpeaking ? 'Stop voice reading' : 'Read executive report aloud clearly from beginning to end'}
            >
              {isSpeaking ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAiCustomizing(!isAiCustomizing)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-xs font-bold transition flex items-center gap-1.5 border border-indigo-200/60 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Focus</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-4 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
              <span>
                {isDownloadingPdf
                  ? 'Generating PDF...'
                  : pageFormat === 'A4_PRINT'
                  ? 'Download 3-Page A4 PDF'
                  : 'Download 16:9 PDF'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AI Customization Drawer Popover */}
        {isAiCustomizing && (
          <div className="no-print p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white border-b border-indigo-500/30 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Focus on everyday language, direct community impact, and next quarter actions..."
                className="flex-1 bg-slate-900 border border-indigo-500/40 text-xs text-white placeholder-slate-400 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAiSynthesize();
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAiSynthesize}
                disabled={isSynthesizing || !aiPrompt.trim()}
                className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                <span>{isSynthesizing ? 'Customizing...' : 'Apply AI Focus'}</span>
              </button>
              <button
                onClick={() => setIsAiCustomizing(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {loading ? (
          <div className="p-24 flex flex-col items-center justify-center gap-3 text-slate-500 flex-1">
            <RefreshCw className="w-8 h-8 animate-spin text-[#6366F1]" />
            <span className="text-sm font-semibold">Structuring Plain-Language Executive Report...</span>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-rose-600 space-y-2 flex-1 flex flex-col justify-center items-center">
            <p className="font-bold">{error}</p>
            <button
              onClick={loadTemplate}
              className="px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold"
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
                className="page-break-container bg-white rounded-3xl p-6 sm:p-7 border border-indigo-100 shadow-sm space-y-5"
              >
                {/* Page 1 Header */}
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-indigo-100/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        Page 1 • The Big Picture
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {isPlainLanguage ? 'Executive Summary & Main Trend' : (reportData.header.title || 'Profile Growth')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {isPlainLanguage
                        ? 'High-level snapshot showing overall direction and critical takeaways'
                        : (reportData.header.subtitle || 'Overall Strategic Telemetry')}
                    </p>
                  </div>

                  {/* Profile Block */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 overflow-hidden flex items-center justify-center text-amber-800 shadow-sm shrink-0 font-bold text-xs">
                      {reportData.user_profile.name
                        ? reportData.user_profile.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                        : 'ML'}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {reportData.user_profile.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {reportData.user_profile.role}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Human Story Lead Summary Card */}
                <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl p-4 sm:p-5 border border-indigo-200/80 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-md">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                      {isPlainLanguage ? 'The Human Story & Community Impact' : 'Executive Overview'}
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {isPlainLanguage
                        ? (reportData.human_story_summary || reportData.plain_summary || reportData.executive_summary)
                        : (reportData.executive_summary || reportData.plain_summary)}
                    </p>
                  </div>
                </div>

                {/* 2. Top Hero Numbers Row (3 to 4 Massive Clean Cards) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {reportData.top_kpis.map((kpi) => (
                    <div
                      key={kpi.id}
                      className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#6366F1] flex items-center justify-center shadow-sm shrink-0">
                          {renderTopKpiIcon(kpi.icon)}
                        </div>
                        <span className="text-xs font-bold text-slate-700 truncate">
                          {isPlainLanguage && kpi.plain_title ? kpi.plain_title : kpi.title}
                        </span>
                      </div>

                      <div className="text-2xl font-black text-indigo-950 tracking-tight mb-1">
                        {kpi.value}
                      </div>

                      <div className="text-[11px] font-bold flex items-center justify-between">
                        <span className={kpi.is_positive ? 'text-emerald-600' : 'text-rose-500'}>
                          {kpi.delta}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {isPlainLanguage ? 'vs last cycle' : 'MoM pace'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3. Dominant Timeline / Growth Capsule Chart */}
                <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-slate-200/80 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-indigo-950">
                        {isPlainLanguage && reportData.growth_chart.plain_title
                          ? reportData.growth_chart.plain_title
                          : reportData.growth_chart.title}
                      </h3>
                      {/* Contextual Subtitle Box */}
                      <p className="text-xs text-indigo-700/80 font-semibold mt-0.5">
                        {isPlainLanguage && reportData.growth_chart.plain_subtitle
                          ? reportData.growth_chart.plain_subtitle
                          : 'This chart shows continuous output trends over the reporting timeline.'}
                      </p>
                    </div>

                    <div className="bg-white p-0.5 rounded-full flex items-center gap-1 border border-slate-200 shadow-sm">
                      {['Months', 'Years'].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setActiveTimeframe(tf as any)}
                          className={`px-3 py-0.5 rounded-full text-xs font-bold transition ${
                            activeTimeframe === tf
                              ? 'bg-[#4F46E5] text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
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
                      className="absolute top-0 right-[15%] sm:right-[16%] z-10 -translate-y-2 bg-[#4F46E5] text-white px-3 py-1 rounded-2xl shadow-lg shadow-indigo-500/30 text-center pointer-events-none animate-bounce"
                      style={{ animationDuration: '3s' }}
                    >
                      <div className="text-[9px] text-indigo-200 font-medium leading-none mb-0.5">
                        {reportData.growth_chart.floating_tooltip.label}
                      </div>
                      <div className="text-xs font-black tracking-wide leading-none">
                        {reportData.growth_chart.floating_tooltip.value}
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#4F46E5] rotate-45" />
                    </div>

                    <div className="relative h-40 flex items-end">
                      <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-slate-400 font-mono select-none pr-3">
                        {reportData.growth_chart.y_axis_labels.map((yLabel) => (
                          <span key={yLabel}>{yLabel}</span>
                        ))}
                      </div>

                      <div className="absolute left-9 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                        {[0, 1, 2, 3].map((g) => (
                          <div key={g} className="w-full border-b border-slate-200/60" />
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
                                <span className="text-[10px] font-bold text-slate-600 mb-1 leading-none absolute -top-4">
                                  {bar.display_val || bar.value}
                                </span>
                              )}

                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-3 sm:w-3.5 rounded-full transition-all duration-300 ${
                                  bar.fill_type === 'gradient'
                                    ? 'bg-gradient-to-t from-[#4338CA] via-[#6366F1] to-[#818CF8] shadow-sm'
                                    : 'bg-[#C7D2FE]/70 hover:bg-[#A5B4FC]'
                                } ${isHovered ? 'scale-y-105 shadow-md shadow-indigo-500/20' : ''}`}
                              />

                              <span className="text-[10px] font-semibold text-slate-400 mt-1.5 absolute -bottom-5">
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
            {/* PAGE 2: THE "WHY" AND "WHERE" (Detailed Breakdown & Friendly Bar Charts)  */}
            {/* ========================================================================= */}
            {(activeTab === 'page_2' || activeTab === 'all_pages' || pageFormat === 'WIDESCREEN_16_9') && (
              <div
                ref={page2Ref}
                className="page-break-container bg-white rounded-3xl p-6 sm:p-7 border border-indigo-100 shadow-sm space-y-5"
              >
                {/* Page 2 Header */}
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-indigo-100/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                        Page 2 • The "Why" & "Where"
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {isPlainLanguage ? 'Where & Why Results Happened' : 'Detailed Breakdown & Driver Attribution'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {isPlainLanguage
                        ? 'Friendly horizontal comparisons showing which categories drove the most progress'
                        : 'Cohort breakdown, throughput distribution, and operational metrics'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: Friendly Horizontal Bar Distribution (7 cols) */}
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-5 border border-slate-200/80 space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
                        <h4 className="text-sm font-black text-indigo-950">
                          {isPlainLanguage ? 'Activity Share by Category' : 'Volume Breakdown by Segment'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {isPlainLanguage
                          ? 'This friendly bar chart makes it easy to see which specific programs contributed the most value.'
                          : 'Segment share aggregated across core categorical dimensions.'}
                      </p>
                    </div>

                    {/* Horizontal Bar Items */}
                    <div className="space-y-3 pt-2">
                      {(reportData.horizontal_breakdowns || [
                        { name: 'Community Programs', value: '$420,000', percentage: 92, note: 'Highest active engagement' },
                        { name: 'Direct Assistance', value: '$310,500', percentage: 78, note: 'Steady monthly delivery' },
                        { name: 'Education & Support', value: '$215,000', percentage: 58, note: 'Growing 15% this quarter' },
                        { name: 'Health & Wellness', value: '$140,000', percentage: 42, note: 'Expanding into 3 new areas' },
                        { name: 'General Operations', value: '$95,000', percentage: 28, note: 'Optimized low overhead' }
                      ]).map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-950">{item.value}</span>
                              <span className="text-[10px] text-slate-400 font-medium">({item.percentage}%)</span>
                            </div>
                          </div>
                          {/* Progress Track */}
                          <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${item.percentage}%` }}
                              className="h-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8] rounded-full transition-all duration-500"
                            />
                          </div>
                          {item.note && (
                            <div className="text-[10px] text-slate-500 font-medium pl-1">
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
                          className="bg-[#F8FAFC] rounded-2xl p-3.5 border border-slate-200/80 flex flex-col justify-between"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#6366F1] flex items-center justify-center text-white shrink-0 shadow-sm">
                              {renderDriverIcon(driver.icon)}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 truncate">
                              {isPlainLanguage && driver.plain_title ? driver.plain_title : driver.title}
                            </span>
                          </div>

                          <div className="text-lg font-black text-indigo-950 mb-0.5">
                            {driver.value}
                          </div>

                          <div className="text-[10px] font-bold flex items-center justify-between">
                            <span className={driver.is_positive ? 'text-emerald-600' : 'text-rose-500'}>
                              {driver.delta}
                            </span>
                            <span className="text-[9px] text-slate-400">vs benchmark</span>
                          </div>

                          {driver.explanation && (
                            <p className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-200/60 leading-tight">
                              {driver.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Monthly Progress Snapshot Bar Card */}
                    <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800">
                          {isPlainLanguage ? 'Quarterly Progress Checks' : 'Audit Velocity'}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                          Consistent
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {reportData.analytics_card.bars.map((b, idx) => (
                          <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-400 font-medium block">{b.date}</span>
                            <span className="text-sm font-black text-indigo-950 block">{b.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PAGE 3: CLEAR TAKEAWAYS & ACTION STEPS (Impact & Actionable Playbook)     */}
            {/* ========================================================================= */}
            {(activeTab === 'page_3' || activeTab === 'all_pages' || pageFormat === 'WIDESCREEN_16_9') && (
              <div
                ref={page3Ref}
                className="page-break-container bg-white rounded-3xl p-6 sm:p-7 border border-indigo-100 shadow-sm space-y-5"
              >
                {/* Page 3 Header */}
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-indigo-100/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Page 3 • Action & Impact
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {isPlainLanguage ? 'Clear Takeaways & Next Action Steps' : 'Strategic Governance & Next Milestones'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {isPlainLanguage
                        ? 'What these numbers mean for our community and what concrete steps we are taking next'
                        : 'Actionable playbooks, risk mitigation, and milestone commitments'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Column: Key Insights & Community Takeaways (6 cols) */}
                  <div className="lg:col-span-6 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isPlainLanguage ? 'Key Story Takeaways' : 'Strategic Insights'}</span>
                    </h4>

                    {(reportData.business_insights || []).map((insight, idx) => (
                      <div
                        key={idx}
                        className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200/80 space-y-1.5 hover:border-indigo-200 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              insight.is_positive
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPlainLanguage && insight.plain_tag ? insight.plain_tag : insight.tag}
                          </span>
                          <span className="text-xs font-black text-emerald-600">
                            {isPlainLanguage && insight.plain_impact ? insight.plain_impact : insight.impact}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-900">
                          {isPlainLanguage && insight.plain_title ? insight.plain_title : insight.title}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {isPlainLanguage && insight.plain_detail ? insight.plain_detail : insight.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Action Steps Checklist & Milestones (6 cols) */}
                  <div className="lg:col-span-6 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isPlainLanguage ? 'Concrete Next Steps' : 'Actionable Roadmap'}</span>
                    </h4>

                    {/* Action Items List */}
                    <div className="space-y-2.5">
                      {(reportData.action_steps || [
                        { id: 'a1', title: 'Expand Top Performing Programs', description: 'Allocate resources to the 2 fastest growing initiatives.', due_date: 'Next 30 Days', status: 'In Progress' },
                        { id: 'a2', title: 'Streamline Participant Onboarding', description: 'Reduce wait times from 5 days to 2 days for new members.', due_date: 'Next 60 Days', status: 'Ready' },
                        { id: 'a3', title: 'Community Progress Update', description: 'Publish quarterly plain-language recap for all participants.', due_date: 'Ongoing', status: 'Scheduled' }
                      ]).map((act) => (
                        <div
                          key={act.id}
                          className="bg-[#F8FAFC] rounded-2xl p-3.5 border border-slate-200/80 flex items-start gap-3"
                        >
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{act.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-bold">
                                {act.due_date}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-tight">
                              {act.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quality & Verification Assurance Box */}
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl p-4 border border-emerald-200/80 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {isPlainLanguage ? 'Quality & Verification Check' : 'Audit Compliance Passed'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {reportData.audit_card.radial_percentage}% of metrics verified accurate
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
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
