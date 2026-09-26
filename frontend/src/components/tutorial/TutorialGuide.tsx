import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  X,
  Play,
  Pause,
  RotateCcw,
  Bot,
  BarChart3,
  Lightbulb,
  Zap,
  ArrowRight,
  CheckCircle2,
  ListOrdered,
  Layout,
  HelpCircle,
  Activity,
  Eye,
  Upload,
  GraduationCap,
  Rocket,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  Trophy,
  Compass,
  Info,
  Target,
  Cpu,
  Database,
  TrendingUp,
  Brain,
  FileText,
} from 'lucide-react';
import { TUTORIAL_STEPS, WELCOME_STEP, TutorialStep } from './tutorialData';
import { RobotGuide3D } from './RobotGuide3D';
import { LiveSpotlightPointer } from './LiveSpotlightPointer';
import { useWorkspace } from '../../store/workspaceContext';
import { api } from '../../services/api';

interface TutorialGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpload?: () => void;
}

// XP per completed step
const XP_PER_STEP = 120;

const SECTION_ICONS: Record<string, React.ReactNode> = {
  'Data Engineering': <Database className="w-3.5 h-3.5" />,
  'Core Intelligence': <Brain className="w-3.5 h-3.5" />,
  'Visualization': <TrendingUp className="w-3.5 h-3.5" />,
  'Predictive & ML': <Cpu className="w-3.5 h-3.5" />,
  'Executive Output': <FileText className="w-3.5 h-3.5" />,
  'Graduation': <Trophy className="w-3.5 h-3.5" />,
};

// ── Welcome Screen ───────────────────────────────────────────────────────────
const WelcomeScreen: React.FC<{ onStart: () => void; onClose: () => void }> = ({ onStart, onClose }) => {
  const [activeSection, setActiveSection] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" style={{ backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col rounded-2xl bg-[#080F26] border border-cyan-400/40 shadow-[0_24px_80px_rgba(0,0,0,0.95)] custom-scrollbar">
        {/* Top accent bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 rounded-t-2xl shrink-0" />

        {/* Header with Nova — static CSS avatar (no WebGL here) */}
        <div className="p-5 pb-4 flex items-start gap-4 border-b border-slate-800/70 shrink-0">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(6,182,212,0.18)]">
              🤖
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080F26]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30 font-bold">NOVA AI GUIDE</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">ONLINE</span>
            </div>
            <h1 className="text-xl font-black text-white leading-tight">{WELCOME_STEP.title}</h1>
            <p className="text-xs text-cyan-300/80 mt-0.5 font-medium">{WELCOME_STEP.subtitle}</p>
            <p className="text-[11px] text-slate-300 mt-2 leading-relaxed italic border-l-2 border-cyan-500/40 pl-3">
              "{WELCOME_STEP.novaIntro}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* What is DATOVA */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-2xl bg-[#0a1635]/80 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <Info className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-black text-white">What is DATOVA AI?</span>
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed">{WELCOME_STEP.whatIsDataova}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a1e1a]/80 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-black text-white">Who is it for?</span>
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed">{WELCOME_STEP.whoIsItFor}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#14101a]/80 border border-indigo-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <Compass className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-sm font-black text-white">How this tour works</span>
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed">{WELCOME_STEP.howTourWorks}</p>
          </div>

          {/* App sections grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black text-white uppercase tracking-wider">App Sections at a Glance</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WELCOME_STEP.quickSections.map((section, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSection(activeSection === idx ? null : idx)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 group ${
                    activeSection === idx
                      ? 'bg-cyan-500/15 border-cyan-400/60'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{section.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${activeSection === idx ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {section.name}
                      </span>
                      {activeSection === idx
                        ? <ChevronUp className="w-3 h-3 text-cyan-400 shrink-0" />
                        : <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                      }
                    </div>
                    {activeSection === idx && (
                      <p className="text-[10px] text-slate-300 mt-1 leading-snug">{section.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tour stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '16', label: 'Features', icon: <Star className="w-4 h-4 text-amber-400" /> },
              { value: '2', label: 'Phases each', icon: <Zap className="w-4 h-4 text-cyan-400" /> },
              { value: '1,920', label: 'Total XP', icon: <Trophy className="w-4 h-4 text-indigo-400" /> },
            ].map(({ value, label, icon }) => (
              <div key={label} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1 text-center">
                {icon}
                <span className="text-lg font-black text-white">{value}</span>
                <span className="text-[10px] text-slate-400 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div className="p-5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] text-slate-500 max-w-[280px] leading-snug">
            You can pause, replay, or skip to any step at any time. Voice narration is optional.
          </p>
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm shadow-[0_8px_24px_rgba(6,182,212,0.35)] hover:shadow-[0_8px_32px_rgba(6,182,212,0.5)] hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Rocket className="w-4 h-4" />
            Start 16-Step Tour
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── XP / Level Badge ─────────────────────────────────────────────────────────
const XPBadge: React.FC<{ completedSteps: number; total: number }> = ({ completedSteps, total }) => {
  const xp = completedSteps * XP_PER_STEP;
  const maxXP = total * XP_PER_STEP;
  const level = Math.floor(completedSteps / 4) + 1;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
      <Trophy className="w-3 h-3" />
      <span className="text-[9px] font-mono font-bold">LVL {level}</span>
      <span className="text-[9px] font-mono text-amber-400/70">{xp}/{maxXP} XP</span>
    </div>
  );
};

// ── Glossary Pill ─────────────────────────────────────────────────────────────
const GlossarySection: React.FC<{ glossary: Record<string, string> }> = ({ glossary }) => {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(glossary);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-700/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/70 hover:bg-slate-800/70 transition text-left"
      >
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Key Terms Glossary</span>
          <span className="text-[9px] text-slate-500 font-mono">({entries.length})</span>
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>
      {open && (
        <div className="p-2.5 space-y-2 bg-slate-900/40">
          {entries.map(([term, def]) => (
            <div key={term} className="flex gap-2">
              <span className="text-[10px] font-bold text-cyan-300 shrink-0 min-w-[80px] pt-0.5">{term}</span>
              <span className="text-[10px] text-slate-300 leading-snug">{def}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Fresh User Tip ─────────────────────────────────────────────────────────────
const FreshUserTipPanel: React.FC<{ tip: string }> = ({ tip }) => {
  const lines = tip.split('\n').filter(Boolean);
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
      <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
      <div>
        <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Step-by-Step for New Users</span>
        <div className="mt-1 space-y-0.5">
          {lines.map((line, i) => (
            <p key={i} className="text-[10px] text-indigo-100/80 leading-snug">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const TutorialGuide: React.FC<TutorialGuideProps> = ({ isOpen, onClose, onOpenUpload }) => {
  const { currentDataset, selectDatasetById, refreshDatasetList, setActiveTab } = useWorkspace();
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<'action' | 'output'>('action');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [dockPosition, setDockPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  // Voice & Audio controls
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.05);

  // Autopilot & Pacing
  // Countdown stored in a ref to avoid re-renders; CSS width updated via a DOM ref
  const [isAutopilot, setIsAutopilot] = useState<boolean>(true);
  const [actionStatus, setActionStatus] = useState<'moving' | 'clicking' | 'inspecting' | 'idle'>('idle');
  const countdownValueRef = useRef<number>(0);          // never triggers re-renders
  const countdownTotalRef = useRef<number>(14);
  const countdownBarRef  = useRef<HTMLDivElement>(null); // direct DOM for bar width
  const countdownTextRef = useRef<HTMLSpanElement>(null); // direct DOM for text
  const countdownRafRef  = useRef<number>(0);
  // For compatibility with display reads in render (won't re-render on change)
  const [observationCountdown, setObservationCountdown] = useState<number>(0);
  const [totalObservationSeconds] = useState<number>(14);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep: TutorialStep = TUTORIAL_STEPS[currentStepIndex] || TUTORIAL_STEPS[0];

  const clearAllTimers = useCallback(() => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    cancelAnimationFrame(countdownRafRef.current);
    countdownValueRef.current = 0;
    // Update DOM directly — no setState
    if (countdownBarRef.current) countdownBarRef.current.style.width = '0%';
    if (countdownTextRef.current) countdownTextRef.current.textContent = '';
    setObservationCountdown(0);
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakNarration = useCallback(
    (text: string, onEnd?: () => void) => {
      stopSpeech();

      if (!isVoiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
        if (onEnd) {
          const wordCount = text.split(/\s+/).length;
          const readingDelay = Math.max(3800, wordCount * 220);
          phaseTimeoutRef.current = setTimeout(onEnd, readingDelay);
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = 1.18;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Jenny') ||
              v.name.includes('David'))
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (englishVoice) utterance.voice = englishVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isVoiceEnabled, speechRate, stopSpeech]
  );

  const performCleanup = useCallback((step: TutorialStep) => {
    if (step.cleanupSelector) {
      try {
        const closeEl = document.querySelector(step.cleanupSelector) as HTMLElement | null;
        if (closeEl) closeEl.click();
      } catch (err) {
        console.warn('Cleanup selector failed:', err);
      }
    }
  }, []);

  const handleNext = useCallback(() => {
    clearAllTimers();
    stopSpeech();
    performCleanup(currentStep);
    setCompletedSteps(prev => new Set([...prev, currentStepIndex]));

    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsAutopilot(false);
    }
  }, [clearAllTimers, currentStep, currentStepIndex, performCleanup, stopSpeech]);

  const handlePrev = useCallback(() => {
    clearAllTimers();
    stopSpeech();
    performCleanup(currentStep);

    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [clearAllTimers, currentStep, currentStepIndex, performCleanup, stopSpeech]);

  const handleJumpToStep = useCallback(
    (index: number) => {
      clearAllTimers();
      stopSpeech();
      performCleanup(currentStep);
      setCurrentStepIndex(index);
      setIsRoadmapOpen(false);
    },
    [clearAllTimers, currentStep, performCleanup, stopSpeech]
  );

  const startObservationCountdown = useCallback(
    (seconds: number = 14) => {
      if (!isAutopilot) return;
      cancelAnimationFrame(countdownRafRef.current);
      countdownValueRef.current = seconds;
      countdownTotalRef.current = seconds;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        const remaining = Math.max(0, seconds - elapsed);
        countdownValueRef.current = remaining;
        const pct = ((seconds - remaining) / seconds) * 100;

        // Direct DOM manipulation — zero React re-renders
        if (countdownBarRef.current) countdownBarRef.current.style.width = `${pct}%`;
        if (countdownTextRef.current) countdownTextRef.current.textContent = `${Math.ceil(remaining)}s`;

        if (remaining > 0) {
          countdownRafRef.current = requestAnimationFrame(tick);
        } else {
          handleNext();
        }
      };
      countdownRafRef.current = requestAnimationFrame(tick);
    },
    [handleNext, isAutopilot]
  );

  const executePhase2Output = useCallback(
    (step: TutorialStep) => {
      clearAllTimers();
      setCurrentPhase('output');
      setActionStatus('inspecting');

      speakNarration(step.outputSpeech, () => {
        startObservationCountdown(14);
      });
    },
    [clearAllTimers, speakNarration, startObservationCountdown]
  );

  const executePhase1Action = useCallback(
    (step: TutorialStep) => {
      clearAllTimers();
      setCurrentPhase('action');
      setActionStatus('moving');

      if (step.tab && currentDataset) {
        setActiveTab(step.tab);
      }

      speakNarration(step.actionSpeech, () => {
        phaseTimeoutRef.current = setTimeout(() => {
          executePhase2Output(step);
        }, 600);
      });

      const actionDelay = step.actionDelayMs || 2000;
      actionTimeoutRef.current = setTimeout(() => {
        if (step.targetSelector) {
          const el = document.querySelector(step.targetSelector) as HTMLElement | null;
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            if (step.actionType === 'click' || step.actionType === 'modal_flow') {
              setActionStatus('clicking');
              el.click();

              if (step.id === 'welcome-ingest' && !currentDataset) {
                api
                  .loadSample('retail')
                  .then(async (ds) => {
                    await refreshDatasetList();
                    await selectDatasetById(ds.id);
                    setActiveTab('overview');
                  })
                  .catch(console.error);
              }
            } else {
              setActionStatus('inspecting');
            }
          }
        }
      }, actionDelay);
    },
    [clearAllTimers, currentDataset, executePhase2Output, refreshDatasetList, selectDatasetById, setActiveTab, speakNarration]
  );

  useEffect(() => {
    if (isOpen && !isMinimized && !showWelcome) {
      executePhase1Action(currentStep);
    } else {
      clearAllTimers();
      stopSpeech();
    }
    return () => {
      clearAllTimers();
      stopSpeech();
    };
  }, [currentStepIndex, isOpen, isMinimized, showWelcome]);

  const handleSwitchPhase = (phase: 'action' | 'output') => {
    clearAllTimers();
    stopSpeech();
    if (phase === 'action') {
      executePhase1Action(currentStep);
    } else {
      executePhase2Output(currentStep);
    }
  };

  const handleReplayCurrentPhase = () => {
    if (currentPhase === 'action') {
      executePhase1Action(currentStep);
    } else {
      executePhase2Output(currentStep);
    }
  };

  if (!isOpen) return null;

  // Show Welcome Screen
  if (showWelcome) {
    return (
      <WelcomeScreen
        onStart={() => setShowWelcome(false)}
        onClose={onClose}
      />
    );
  }

  const progressPct = ((currentStepIndex + 1) / TUTORIAL_STEPS.length) * 100;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  // ── MINIMIZED PILL ───────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        className={`fixed z-50 select-none transition-all duration-300 ${
          dockPosition === 'bottom-left' ? 'bottom-6 left-6' : 'bottom-6 right-6'
        }`}
      >
        <div
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 p-2.5 pr-4 rounded-2xl bg-[#070F22] border border-cyan-400/50 shadow-[0_8px_28px_rgba(6,182,212,0.25)] cursor-pointer hover:scale-105 transition-transform duration-200 group"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-xl">
              🤖
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#070F22]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white group-hover:text-cyan-300 transition truncate">Nova AI Guide</span>
              <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30 shrink-0">
                {currentStep.stepNumber}/{currentStep.totalSteps}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[160px] mt-0.5">{currentStep.featureName}</p>
            <div className="mt-1 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-cyan-400 shrink-0" />
        </div>
      </div>
    );
  }

  const targetSelector =
    currentPhase === 'action'
      ? currentStep.targetSelector
      : currentStep.outputHighlightSelector || currentStep.targetSelector;

  return (
    <>
      {/* Live Spotlight Pointer */}
      <LiveSpotlightPointer
        targetSelector={targetSelector}
        phase={currentPhase}
        actionStatus={actionStatus}
        label={
          currentPhase === 'action'
            ? currentStep.pointerLabel || `Nova Leading: ${currentStep.featureName}`
            : `AI Output Analysis: ${currentStep.featureName}`
        }
        outputSnippet={currentStep.keyMetricNotice}
      />

      {/* Floating Tutorial HUD — NO backdrop-blur on outer shell (GPU expensive) */}
      <div
        className={`fixed z-50 w-full max-w-[780px] select-none pointer-events-auto ${
          dockPosition === 'bottom-left' ? 'bottom-4 left-4' : 'bottom-4 right-4'
        }`}
        style={{ willChange: 'transform' }}
      >
        <div className="relative rounded-2xl bg-[#0A1830] border border-cyan-400/35 shadow-[0_20px_60px_rgba(0,0,0,0.92)] flex flex-col overflow-hidden">
          {/* Top accent gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500" />

          {/* Step Progress Bar */}
          <div className="absolute top-[2px] left-0 right-0 h-0.5 bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* ── TOP HUD BAR — light icon instead of second WebGL robot ── */}
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between bg-[#081430]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-lg shrink-0">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-white tracking-tight">Nova AI Co-Pilot</span>
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 font-bold ${
                      currentPhase === 'action'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        currentPhase === 'action' ? 'bg-cyan-400' : 'bg-emerald-400'
                      }`}
                    />
                    {currentPhase === 'action' ? 'LEADING' : 'EXPLAINING'}
                  </span>

                  {/* XP Badge */}
                  <XPBadge completedSteps={completedSteps.size} total={TUTORIAL_STEPS.length} />

                  {/* Beginner/Expert toggle */}
                  <button
                    onClick={() => setBeginnerMode(!beginnerMode)}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition flex items-center gap-1 ${
                      beginnerMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                    }`}
                    title={beginnerMode ? 'Switch to Expert Mode' : 'Switch to Beginner Mode'}
                  >
                    <GraduationCap className="w-3 h-3" />
                    {beginnerMode ? 'BEGINNER' : 'EXPERT'}
                  </button>
                </div>
              </div>
            </div>

            {/* Top Bar Controls */}
            <div className="flex items-center gap-1.5">
              {/* Autopilot */}
              <button
                onClick={() => {
                  const next = !isAutopilot;
                  setIsAutopilot(next);
                  if (!next) {
                    clearAllTimers();
                  } else {
                    if (currentPhase === 'output') {
                      startObservationCountdown(12);
                    }
                  }
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                  isAutopilot
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
                title={isAutopilot ? 'Pause hands-free Autopilot' : 'Resume live hands-free Autopilot'}
              >
                {isAutopilot ? (
                  <><Pause className="w-3 h-3 text-emerald-400" /><span>Autopilot</span></>
                ) : (
                  <><Play className="w-3 h-3 text-amber-400" /><span>Manual</span></>
                )}
              </button>

              {/* Voice */}
              <div className="flex items-center bg-slate-900/80 border border-slate-700/60 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    const next = !isVoiceEnabled;
                    setIsVoiceEnabled(next);
                    if (next) {
                      speakNarration(
                        currentPhase === 'action'
                          ? currentStep.actionSpeech
                          : currentStep.outputSpeech
                      );
                    } else {
                      stopSpeech();
                    }
                  }}
                  className={`p-1.5 rounded-md text-xs transition ${
                    isVoiceEnabled ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                  title={isVoiceEnabled ? 'Voice narration active' : 'Enable voice narration'}
                >
                  {isVoiceEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>

                {isVoiceEnabled && (
                  <button
                    onClick={() => {
                      const nextRate = speechRate === 1.05 ? 1.2 : speechRate === 1.2 ? 0.9 : 1.05;
                      setSpeechRate(nextRate);
                    }}
                    className="text-[10px] font-mono text-cyan-300 px-1 hover:text-white"
                    title="Change voice narration speed"
                  >
                    {speechRate}x
                  </button>
                )}
              </div>

              {/* Welcome screen */}
              <button
                onClick={() => setShowWelcome(true)}
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg transition"
                title="Show Welcome & App Overview"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              {/* Roadmap Drawer */}
              <button
                onClick={() => setIsRoadmapOpen(!isRoadmapOpen)}
                className={`p-1.5 rounded-lg text-xs transition ${
                  isRoadmapOpen ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="View All 16 Features Curriculum"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              {/* Dock Switch */}
              <button
                onClick={() =>
                  setDockPosition(dockPosition === 'bottom-right' ? 'bottom-left' : 'bottom-right')
                }
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition"
                title={dockPosition === 'bottom-right' ? 'Dock to bottom-left' : 'Dock to bottom-right'}
              >
                <Layout className="w-3.5 h-3.5" />
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition"
                title="Minimize to corner"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                title="End Tour"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── APP CONTEXT BANNER ── */}
          {currentStep.appContext && (
            <div className="px-4 py-1.5 bg-slate-900/50 border-b border-slate-800/60 flex items-center gap-2">
              <div className="text-slate-400">
                {SECTION_ICONS[currentStep.category] || <Info className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[10px] text-slate-300 leading-none">{currentStep.appContext}</span>
            </div>
          )}

          {/* ── DUAL PHASE SWITCHER ── */}
          <div className="flex items-center bg-[#060D20] px-3 pt-2 pb-1.5 border-b border-slate-800/80 gap-2">
            {(['action', 'output'] as const).map((phase) => {
              const isActive = currentPhase === phase;
              return (
                <button
                  key={phase}
                  onClick={() => handleSwitchPhase(phase)}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    isActive
                      ? phase === 'action'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {phase === 'action' ? <Zap className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
                  <span>{phase === 'action' ? '① Nova Leads Action' : '② Nova Explains Output'}</span>
                  {isActive && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ml-1 ${phase === 'action' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />}
                </button>
              );
            })}
          </div>

          {/* ── MAIN BODY ── */}
          <div className="p-4 flex items-start gap-4">
            {/* 3D Nova Robot — single instance per tutorial session */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="w-32 h-32 relative rounded-2xl bg-gradient-to-b from-[#071530] to-[#030C1C] border border-cyan-500/25 overflow-hidden">
                <RobotGuide3D
                  expression={currentStep.robotExpression}
                  isSpeaking={isSpeaking}
                  size="md"
                  className="w-full h-full"
                  showBackground={false}
                  onRobotClick={() => speakNarration(currentStep.novaQuip || 'Hi! I am Nova, your AI guide!')}
                />
                {/* Speaking waveform overlay */}
                {isSpeaking && (
                  <div className="absolute bottom-2 left-0 right-0 flex items-end justify-center gap-0.5 h-5">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                      <span
                        key={i}
                        className="w-1 bg-cyan-400 rounded-full"
                        style={{
                          height: `${8 + Math.random() * 14}px`,
                          animation: `soundbar 0.6s ease-in-out infinite alternate`,
                          animationDelay: `${i * 70}ms`,
                          opacity: 0.85
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Nova quip */}
              {currentStep.novaQuip && (
                <div className="w-36 text-center">
                  <p className="text-[9px] text-cyan-300/70 italic leading-snug line-clamp-3">
                    "{currentStep.novaQuip}"
                  </p>
                </div>
              )}

              {/* Status badge — text updated via ref, no re-render */}
              <div className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isSpeaking ? 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30' : 'text-slate-400 bg-slate-800/60 border-slate-700/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-cyan-400' : 'bg-slate-500'}`} />
                {isSpeaking ? 'SPEAKING' : <span ref={countdownTextRef} />}
              </div>
            </div>

            {/* Dynamic Content Panel */}
            <div className="flex-1 min-w-0 space-y-2.5 overflow-y-auto max-h-[340px] custom-scrollbar pr-1">
              {/* Step Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase border ${currentStep.badgeColor}`}>
                      {currentStep.category}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">Step {currentStep.stepNumber}/{currentStep.totalSteps}</span>
                    {completedSteps.has(currentStepIndex) && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Viewed
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white mt-1 leading-tight">{currentStep.featureName}</h3>
                </div>
                {isSpeaking ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 shrink-0">
                    {[1, 2, 3, 4, 5].map(i => <span key={i} className="w-0.5 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />)}
                    <span className="text-[9px] font-mono text-cyan-300 font-bold ml-1">SPEAKING</span>
                  </div>
                ) : isAutopilot && observationCountdown > 0 ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{observationCountdown}s</span>
                  </div>
                ) : null}
              </div>

              {/* ── PHASE 1: AI Leading Action ── */}
              {currentPhase === 'action' && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#091636]/90 border border-cyan-500/40 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold">ACTION IN PROGRESS:</span>
                      <span className="text-slate-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800 text-[9px]">
                        {actionStatus === 'clicking' ? 'EXECUTING CLICK' : actionStatus === 'moving' ? 'TARGETING' : 'INSPECTING'}
                      </span>
                    </div>
                    <button
                      onClick={() => executePhase2Output(currentStep)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition text-[10px]"
                    >
                      Skip to Output <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-100 font-medium leading-relaxed">
                    {currentStep.actionLead}
                  </p>

                  <div className="text-[10px] font-mono text-slate-400 truncate">→ {currentStep.pointerLabel}</div>

                  {/* Beginner explain card */}
                  {beginnerMode && currentStep.beginnerExplain && (
                    <div className="flex items-start gap-2 text-[11px] text-blue-300 bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 mt-1">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-blue-200 text-[10px] uppercase tracking-wider">What is this?</span>
                        <p className="mt-0.5 leading-snug text-blue-100/80">{currentStep.beginnerExplain}</p>
                      </div>
                    </div>
                  )}

                  {/* What you see now */}
                  {beginnerMode && currentStep.whatIsSeen && (
                    <div className="flex items-start gap-2 text-[11px] text-slate-300 bg-slate-800/40 p-2 rounded-xl border border-slate-700/40">
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="leading-snug"><strong className="text-slate-200">What you see: </strong>{currentStep.whatIsSeen}</span>
                    </div>
                  )}

                  {/* Fresh user step-by-step tip */}
                  {beginnerMode && currentStep.freshUserTip && (
                    <FreshUserTipPanel tip={currentStep.freshUserTip} />
                  )}
                </div>
              )}

              {/* ── PHASE 2: AI Explaining Output ── */}
              {currentPhase === 'output' && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#081B2E]/90 border border-emerald-500/40 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold">OUTPUT ANALYSIS:</span>
                    </div>
                    <span className="bg-emerald-950/60 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-700 text-[10px] font-bold">
                      100% AUDITABLE
                    </span>
                  </div>

                  {/* Nova's explanation */}
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">Nova's Plain English Explanation</span>
                    </div>
                    <p className="text-xs text-slate-100 leading-relaxed">{currentStep.outputBreakdown}</p>
                  </div>

                  {/* Key metric pill */}
                  <div className="p-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center gap-2 text-xs">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-mono text-emerald-300 font-bold text-[10px]">{currentStep.keyMetricNotice}</span>
                  </div>

                  {/* What this means */}
                  {beginnerMode && currentStep.outputMeaning && (
                    <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-200 text-[10px] uppercase tracking-wider">What this means for you</span>
                        <p className="mt-0.5 leading-snug text-amber-100/80">{currentStep.outputMeaning}</p>
                      </div>
                    </div>
                  )}

                  {/* What to do next */}
                  {beginnerMode && currentStep.whatToDoNext && (
                    <div className="flex items-start gap-2 text-[11px] text-cyan-300 bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20">
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-cyan-200 text-[10px] uppercase tracking-wider">What to do next</span>
                        <p className="mt-0.5 leading-snug text-cyan-100/80">{currentStep.whatToDoNext}</p>
                      </div>
                    </div>
                  )}

                  {/* Glossary */}
                  {beginnerMode && currentStep.outputGlossary && Object.keys(currentStep.outputGlossary).length > 0 && (
                    <GlossarySection glossary={currentStep.outputGlossary} />
                  )}

                  {/* Strategic value */}
                  <div className="flex items-start gap-2 text-[11px] text-slate-300 bg-slate-800/40 p-2 rounded-xl border border-slate-700/40">
                    <Rocket className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="leading-snug"><strong className="text-slate-200">Business Impact: </strong>{currentStep.strategicValue}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Observation progress bar — width animated by RAF, no React re-render */}
          <div className="w-full bg-slate-900/80 h-[3px] relative overflow-hidden">
            <div
              ref={countdownBarRef}
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
              style={{ width: '0%', transition: 'none' }}
            />
          </div>

          {/* ── BOTTOM CONTROLS ── */}
          <div className="p-3 px-4 border-t border-slate-800/80 bg-[#070F22]/90 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={currentStepIndex}
                onChange={(e) => handleJumpToStep(Number(e.target.value))}
                className="bg-[#0A1635] border border-slate-700 text-xs text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer max-w-[210px] truncate font-medium"
              >
                {TUTORIAL_STEPS.map((step, idx) => (
                  <option key={step.id} value={idx} className="bg-[#0B1733] text-white">
                    {step.stepNumber}. {step.featureName}
                  </option>
                ))}
              </select>

              <button
                onClick={handleReplayCurrentPhase}
                className="p-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition"
                title="Replay speech and action"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress fraction */}
            <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
              {completedSteps.size}/{TUTORIAL_STEPS.length} steps viewed
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="btn-3d-secondary px-3 py-1.5 text-xs font-semibold text-slate-300 rounded-xl flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {isLastStep && onOpenUpload ? (
                <button
                  onClick={() => { onClose(); onOpenUpload(); }}
                  className="btn-3d-primary px-4 py-1.5 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 bg-gradient-to-r from-emerald-600 to-cyan-600"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload My Data</span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="btn-3d-primary px-4 py-1.5 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30"
                >
                  <span>{isLastStep ? 'Finish Tour' : 'Next'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CURRICULUM ROADMAP MODAL ── */}
      {isRoadmapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl bg-[#081226] border border-cyan-400/40 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header — icon only, no extra WebGL robot */}
            <div className="p-4 px-5 border-b border-slate-800 flex items-center justify-between bg-[#0A1635]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-base">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Full Feature Curriculum (16 Modules)</h3>
                  <p className="text-xs text-slate-400">
                    Click any module to command Nova to lead that action live
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRoadmapOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps List */}
            <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {TUTORIAL_STEPS.map((step, idx) => {
                const isCurrent = currentStepIndex === idx;
                const isPassed = completedSteps.has(idx);

                return (
                  <div
                    key={step.id}
                    onClick={() => handleJumpToStep(idx)}
                    className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                      isCurrent
                        ? 'bg-cyan-500/20 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                        : isPassed
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        : 'bg-[#091530]/40 border-slate-800/60 hover:border-cyan-500/40 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                        isCurrent
                          ? 'bg-cyan-400 text-slate-950 font-black'
                          : isPassed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : step.stepNumber}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold ${
                            isCurrent ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {step.featureName}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {step.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">
                        {step.novaQuip || step.beginnerExplain}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isCurrent ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950">
                          ACTIVE
                        </span>
                      ) : (
                        <button className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
                          Jump →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 px-6 border-t border-slate-800 bg-[#0A1635] flex items-center justify-between text-xs text-slate-400">
              <span>{completedSteps.size} of 16 features viewed • {completedSteps.size * XP_PER_STEP} XP earned</span>
              <button
                onClick={() => setIsRoadmapOpen(false)}
                className="btn-3d-primary px-4 py-1.5 text-xs font-bold text-white rounded-xl"
              >
                Resume Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
