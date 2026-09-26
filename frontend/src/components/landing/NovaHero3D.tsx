import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Zap,
  ShieldCheck,
  Layers,
  Smile,
  PartyPopper,
  Lightbulb,
  Hand,
  Volume2
} from 'lucide-react';
import { RobotGuide3D } from '../tutorial/RobotGuide3D';

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
}

interface NovaDialogueState {
  text: string;
  expression: 'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink';
  moodTag: string;
}

const DIALOGUE_PRESETS: NovaDialogueState[] = [
  {
    text: "Hi! I'm Nova, your autonomous AI analyst. Drop your dataset below and let's uncover hidden patterns!",
    expression: 'wave',
    moodTag: 'Welcoming'
  },
  {
    text: "I instantly uncover anomalies, compute domain KPIs, and generate multi-sheet dashboards with 100% mathematical accuracy.",
    expression: 'explain',
    moodTag: 'Explaining'
  },
  {
    text: "Looking for instant insights? Click me anytime for a 360° spin or try one of the instant sample datasets below!",
    expression: 'wink',
    moodTag: 'Playful'
  },
  {
    text: "Analyzing multidimensional data structures, correlation matrices, and predictive horizons...",
    expression: 'thinking',
    moodTag: 'Deep Thought'
  },
  {
    text: "Woohoo! Ready to turn raw data into breakthrough discoveries! 🚀",
    expression: 'celebrate',
    moodTag: 'Celebration'
  }
];

export const NovaHero3D: React.FC = () => {
  const [expression, setExpression] = useState<'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink'>('wave');
  const [celebrateTrigger, setCelebrateTrigger] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number>(0);
  const [dialogueText, setDialogueText] = useState<string>(DIALOGUE_PRESETS[0].text);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-cycle friendly dialogues every 7.5 seconds if user is idle
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDialogueIndex((prev) => {
        const next = (prev + 1) % DIALOGUE_PRESETS.length;
        setDialogueText(DIALOGUE_PRESETS[next].text);
        setExpression(DIALOGUE_PRESETS[next].expression);
        triggerBriefSpeech();
        return next;
      });
    }, 7500);

    return () => clearInterval(interval);
  }, []);

  const triggerBriefSpeech = () => {
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 2200);
  };

  const spawnHeroConfetti = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height * 0.45;

    const colors = ['#38bdf8', '#fbbf24', '#34d399', '#f43f5e', '#a855f7', '#60a5fa', '#3b82f6'];
    const newParticles: ConfettiParticle[] = [];

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      newParticles.push({
        id: Date.now() + i,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 6,
        rotation: Math.random() * 360
      });
    }

    setConfetti(newParticles);
  };

  // Physics animation loop for confetti
  useEffect(() => {
    if (confetti.length === 0) return;
    const interval = setInterval(() => {
      setConfetti((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.38, // gentle gravity
            rotation: p.rotation + 6
          }))
          .filter((p) => p.y < window.innerHeight + 100)
      );
    }, 28);

    return () => clearInterval(interval);
  }, [confetti.length]);

  const handleRobotClick = () => {
    setCelebrateTrigger((prev) => prev + 1);
    setExpression('celebrate');
    setDialogueText("Woohoo! Let's explore your data universe together! 🚀✨");
    triggerBriefSpeech();
    spawnHeroConfetti();
  };

  const handleReactionClick = (
    newExpr: 'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink',
    text: string
  ) => {
    setExpression(newExpr);
    setDialogueText(text);
    triggerBriefSpeech();
    if (newExpr === 'celebrate') {
      setCelebrateTrigger((prev) => prev + 1);
      spawnHeroConfetti();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-3xl mx-auto flex flex-col items-center justify-center my-6 select-none"
    >
      {/* Confetti Particles Canvas Overlay */}
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confetti.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-sm"
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                width: `${p.size}px`,
                height: `${p.size * 0.7}px`,
                backgroundColor: p.color,
                transform: `rotate(${p.rotation}deg)`,
                boxShadow: `0 0 6px ${p.color}88`
              }}
            />
          ))}
        </div>
      )}

      {/* Dynamic Cyber Speech Bubble */}
      <div className="relative z-20 mb-2 w-full max-w-lg px-4 transition-all duration-300">
        <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/35 backdrop-blur-xl shadow-[0_10px_35px_rgba(6,182,212,0.2)] text-left relative group">
          {/* Small directional beacon toward Nova below */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-slate-900/90 border-r border-b border-cyan-500/35" />

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/25 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <span>Nova AI</span>
                    <span className="text-[10px] text-cyan-400 font-normal font-mono bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                      Autonomous Guide
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isSpeaking && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-[10px] font-mono text-cyan-300 border border-cyan-500/30 animate-pulse">
                      <Volume2 className="w-3 h-3 text-cyan-300" />
                      <span>Speaking</span>
                    </div>
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Online" />
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {dialogueText}
              </p>
            </div>
          </div>

          {/* Quick Reaction Pill Triggers */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <span className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Interact:</span>
            </span>

            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  handleReactionClick('wave', "Hello there! Ready to transform your raw tables into intelligent decisions? 👋")
                }
                className={`px-1.5 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  expression === 'wave'
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                <Hand className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>Wave</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleReactionClick('celebrate', "Woohoo! Let's celebrate high-velocity analytics and breakthroughs! 🚀")
                }
                className={`px-1.5 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  expression === 'celebrate'
                    ? 'bg-purple-500/25 border-purple-400 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-purple-500/40 hover:text-white'
                }`}
              >
                <PartyPopper className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Party</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleReactionClick('thinking', "Scanning feature correlations, distributions, and predictive clusters... 💡")
                }
                className={`px-1.5 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  expression === 'thinking'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-amber-500/40 hover:text-white'
                }`}
              >
                <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">Think</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleReactionClick('wink', "Tip: Click me anytime to trigger a full 360° spin! 😉")
                }
                className={`px-1.5 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                  expression === 'wink'
                    ? 'bg-blue-500/25 border-blue-400 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-blue-500/40 hover:text-white'
                }`}
              >
                <Smile className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Wink</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Nova Robot Viewport & Holographic Launchpad Stage */}
      <div className="relative w-full flex flex-col items-center justify-center my-1 sm:my-2">
        {/* Holographic Glowing Launchpad Pedestal */}
        <div className="absolute bottom-3 sm:bottom-6 w-36 sm:w-56 md:w-80 h-14 sm:h-24 pointer-events-none -z-10 flex items-center justify-center">
          {/* Radial ground illumination */}
          <div className="absolute inset-0 m-auto w-full h-full rounded-full bg-gradient-to-t from-cyan-500/25 via-blue-600/15 to-transparent blur-2xl" />
          
          {/* Outer Cyber Orbital Ring 1 */}
          <div className="absolute inset-0 m-auto w-36 sm:w-56 md:w-68 h-14 sm:h-20 rounded-[100%] border border-cyan-400/40 shadow-[0_0_25px_rgba(6,182,212,0.4)] animate-pulse" />
          
          {/* Inner Cyber Orbital Ring 2 with dashes */}
          <div className="absolute inset-0 m-auto w-28 sm:w-40 md:w-48 h-10 sm:h-14 rounded-[100%] border border-dashed border-indigo-400/50" />
          
          {/* Core Spotlight Beacon */}
          <div className="absolute bottom-1 sm:bottom-2 w-20 sm:w-28 h-4 sm:h-6 rounded-full bg-cyan-400/30 blur-md" />
        </div>

        {/* The 3D Nova Robot Canvas (Responsive height so it never cuts off on iPhone) */}
        <div className="relative z-10 flex items-center justify-center">
          <RobotGuide3D
            size="lg"
            expression={expression}
            isSpeaking={isSpeaking}
            celebrateTrigger={celebrateTrigger}
            onRobotClick={handleRobotClick}
            className="w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64 drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)] cursor-pointer"
          />
        </div>
      </div>

      {/* Telemetry Status HUD Pill */}
      <div className="relative z-10 -mt-1 sm:-mt-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 shadow-xl flex items-center gap-2.5 sm:gap-3 max-w-xs sm:max-w-md transition-all duration-300 hover:border-cyan-400/50">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Autonomous Nova AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              AGENT v3.0
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
            Tap Nova for 360° spin • Tap reactions to interact
          </p>
        </div>
      </div>
    </div>
  );
};
