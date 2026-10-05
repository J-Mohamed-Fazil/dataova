import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Volume1,
  Sparkles,
  Headphones,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  AlertCircle,
  HelpCircle,
  SkipBack,
  SkipForward,
  Mic,
  Moon,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Award,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../services/api';
import { AudioBriefResponse, AudioDialogueTurn } from '../../types';
import { RobotPodcastStudio } from './RobotPodcastStudio';

interface AudioBriefModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Enterprise Audio Chime via Web Audio API singleton for immediate audible hardware verification
let sharedAudioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

const playAudioChime = (vol: number = 0.25) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const effVol = Math.max(0.05, Math.min(1.0, vol));

    // Dual-tone harmonic executive chime (C5 -> G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(effVol * 0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
    gain2.gain.setValueAtTime(effVol * 0.7, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Non-fatal fallback
  }
};

export const AudioBriefModal: React.FC<AudioBriefModalProps> = ({
  datasetId,
  datasetName,
  isOpen,
  onClose
}) => {
  const [brief, setBrief] = useState<AudioBriefResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedLunaVoice, setSelectedLunaVoice] = useState<string>('');
  const [selectedNovaVoice, setSelectedNovaVoice] = useState<string>('');
  const [lunaPitch, setLunaPitch] = useState<number>(1.15);
  const [novaPitch, setNovaPitch] = useState<number>(0.92);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  // Enhanced UI State
  const [viewMode, setViewMode] = useState<'split' | 'studio' | 'transcript'>('split');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [speakerFilter, setSpeakerFilter] = useState<'all' | 'luna' | 'nova' | 'caution'>('all');
  const [showKeyTakeaways, setShowKeyTakeaways] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  // Chrome 15-second speech freeze fix: periodic pulse while speaking
  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 8000);
  };

  // Voice Loader
  const updateVoices = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const available = window.speechSynthesis.getVoices() || [];
      if (available.length > 0) {
        setVoices(available);
      }
    }
  }, []);

  useEffect(() => {
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
      const t1 = setTimeout(updateVoices, 200);
      const t2 = setTimeout(updateVoices, 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [updateVoices]);

  // Resolve best voices for Luna (Inquisitive Moon Robot) & Nova (Core Data Oracle Robot)
  const resolveVoices = useCallback(() => {
    const list = voices.length > 0
      ? voices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() || [] : []);

    let lunaV = list.find((v) => v.name === selectedLunaVoice);
    let novaV = list.find((v) => v.name === selectedNovaVoice);

    const enVoices = list.filter((v) =>
      v.lang.startsWith('en') ||
      (typeof navigator !== 'undefined' && v.lang.startsWith(navigator.language.slice(0, 2)))
    );
    const pool = enVoices.length > 0 ? enVoices : list;

    if (!lunaV && pool.length > 0) {
      lunaV = pool.find((v) =>
        /female|zira|samantha|jenny|heera|neerja|victoria|karen|catherine/i.test(v.name)
      ) || pool[0];
    }

    if (!novaV && pool.length > 0) {
      novaV = pool.find((v) =>
        v.name !== lunaV?.name &&
        /male|david|george|guy|mark|ravi|prabhat|daniel|alex|richard/i.test(v.name)
      );
      if (!novaV) {
        novaV = pool.find((v) => v.name !== lunaV?.name) || lunaV;
      }
    }

    return {
      lunaVoice: lunaV,
      novaVoice: novaV,
      alexVoice: lunaV,
      morganVoice: novaV,
      pool: list
    };
  }, [voices, selectedLunaVoice, selectedNovaVoice]);

  // Fetch audio briefing script
  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      return;
    }
    const loadData = async () => {
      try {
        setLoading(true);
        setSpeechNotice(null);
        setTestStatus(null);
        const data = await api.getAudioBrief(datasetId);
        setBrief(data);
        setCurrentTurnIdx(0);
      } catch (err) {
        console.error('Failed to load audio brief:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    return () => {
      stopAudio();
    };
  }, [isOpen, datasetId]);

  // Auto-scroll transcript to active turn
  useEffect(() => {
    if (transcriptContainerRef.current) {
      const activeElement = transcriptContainerRef.current.querySelector(`[data-turn-idx="${currentTurnIdx}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTurnIdx]);

  // Audio Equalizer Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars = Array.from({ length: 36 }, () => Math.random() * 12 + 4);

    const renderBars = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = 4;
      const gap = 3;
      const totalWidth = bars.length * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;

      bars.forEach((height, i) => {
        const x = startX + i * (barWidth + gap);
        let targetHeight = height;
        if (isPlaying && !isMuted && volume > 0) {
          targetHeight = Math.min(
            canvas.height - 2,
            Math.max(4, height + (Math.random() - 0.5) * 14 * volume)
          );
        } else {
          targetHeight = Math.max(3, height * 0.92);
        }
        bars[i] = targetHeight;

        const grad = ctx.createLinearGradient(0, canvas.height - targetHeight, 0, canvas.height);
        grad.addColorStop(0, '#38BDF8'); // Cyan-400
        grad.addColorStop(0.5, '#C084FC'); // Purple-400
        grad.addColorStop(1, '#2563EB'); // Blue-600

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, canvas.height - targetHeight, barWidth, targetHeight, 2);
        } else {
          ctx.rect(x, canvas.height - targetHeight, barWidth, targetHeight);
        }
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(renderBars);
    };

    renderBars();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isMuted, volume]);

  // Speech Playback
  const playTurn = (idx: number, isInitial = false) => {
    if (!brief || idx >= brief.dialogue.length) {
      setIsPlaying(false);
      stopHeartbeat();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechNotice('Web Speech API is not supported in this browser.');
      setIsPlaying(false);
      return;
    }

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    const turn = brief.dialogue[idx];
    setCurrentTurnIdx(idx);

    if (isMuted || volume === 0) {
      const readingMs = (turn.text.split(' ').length / (150 * playbackSpeed)) * 60000;
      playTimeoutRef.current = setTimeout(() => {
        if (isPlaying) playTurn(idx + 1, false);
      }, readingMs);
      return;
    }

    if (isInitial) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch (e) {}
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }

    try {
      const utterance = new SpeechSynthesisUtterance(turn.text);
      (window as any).__datovaSpeechUtterance = utterance;

      utterance.rate = playbackSpeed;
      utterance.volume = Math.max(0.1, volume);

      const { lunaVoice, novaVoice } = resolveVoices();
      const isLuna = turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex';
      const speakerVoice = isLuna ? lunaVoice : novaVoice;

      if (speakerVoice) {
        utterance.voice = speakerVoice;
        utterance.lang = speakerVoice.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }

      if (isLuna) {
        // Luna: Inquisitive moon robot, slightly higher pitch with lively tone
        utterance.pitch = lunaPitch;
      } else {
        // Nova: Core data oracle robot, smooth authoritative analytics tone
        utterance.pitch = novaPitch;
        if (lunaVoice && novaVoice && lunaVoice.name === novaVoice.name) {
          utterance.rate = playbackSpeed * 0.94;
        }
      }

      utterance.onstart = () => {
        setSpeechNotice(null);
        startHeartbeat();
      };

      utterance.onend = () => {
        (window as any).__datovaSpeechUtterance = null;
        if (idx + 1 < brief.dialogue.length) {
          playTurn(idx + 1, false);
        } else {
          setIsPlaying(false);
          stopHeartbeat();
        }
      };

      utterance.onerror = (e) => {
        (window as any).__datovaSpeechUtterance = null;
        stopHeartbeat();
        if (e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }

        console.warn('Speech synthesis turn notice:', e.error);
        const friendlyError =
          e.error === 'not-allowed'
            ? 'Browser blocked audio. Please click on the page and click Play again.'
            : e.error === 'language-unavailable'
            ? 'Voice language not installed. Choose another voice in settings.'
            : `Speech error (${e.error || 'notice'}). Click "Test Audio" or choose another voice.`;

        setSpeechNotice(friendlyError);
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      console.error('Speech synthesis execution error:', err);
      setSpeechNotice(`Could not start audio: ${err?.message || 'Speech error'}`);
      setIsPlaying(false);
      stopHeartbeat();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      setSpeechNotice(null);
      setTestStatus(null);
      setIsPlaying(true);
      playAudioChime(volume);
      playTurn(currentTurnIdx, true);
    }
  };

  const handleRestart = () => {
    stopAudio();
    setSpeechNotice(null);
    setCurrentTurnIdx(0);
    setIsPlaying(true);
    playAudioChime(volume);
    playTurn(0, true);
  };

  const handleSkipNext = () => {
    if (!brief) return;
    const nextIdx = Math.min(brief.dialogue.length - 1, currentTurnIdx + 1);
    stopAudio();
    setCurrentTurnIdx(nextIdx);
    setIsPlaying(true);
    playTurn(nextIdx, true);
  };

  const handleSkipPrev = () => {
    const prevIdx = Math.max(0, currentTurnIdx - 1);
    stopAudio();
    setCurrentTurnIdx(prevIdx);
    setIsPlaying(true);
    playTurn(prevIdx, true);
  };

  const stopAudio = () => {
    stopHeartbeat();
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    (window as any).__datovaSpeechUtterance = null;
    setIsPlaying(false);
  };

  const handleSpeedToggle = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (isPlaying) {
      stopAudio();
      setTimeout(() => {
        setIsPlaying(true);
        playTurn(currentTurnIdx, true);
      }, 50);
    }
  };

  const handleSelectSpeaker = (speaker: 'Luna' | 'Nova') => {
    if (!brief) return;
    const targetIdx = brief.dialogue.findIndex((turn, i) => {
      const match = speaker === 'Luna'
        ? (turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex')
        : (turn.speaker.toLowerCase().includes('nova') || turn.speaker === 'Morgan');
      return match && i >= currentTurnIdx && i !== currentTurnIdx;
    });

    const fallbackIdx = brief.dialogue.findIndex((turn) => {
      return speaker === 'Luna'
        ? (turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex')
        : (turn.speaker.toLowerCase().includes('nova') || turn.speaker === 'Morgan');
    });

    const nextIdx = targetIdx !== -1 ? targetIdx : (fallbackIdx !== -1 ? fallbackIdx : currentTurnIdx);
    stopAudio();
    setCurrentTurnIdx(nextIdx);
    setIsPlaying(true);
    playTurn(nextIdx, true);
  };

  const handleTestAudio = () => {
    try {
      setSpeechNotice(null);
      setTestStatus('Testing hardware speaker chime & robot voices...');
      playAudioChime(Math.max(0.3, volume));

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setTestStatus('⚠️ Web Speech API not supported in this browser.');
        return;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const { lunaVoice } = resolveVoices();
      const testUtterance = new SpeechSynthesisUtterance('DataNova briefing test. Luna questioning, and Nova answering your dataset insights.');
      (window as any).__datovaSpeechUtterance = testUtterance;

      testUtterance.volume = Math.max(0.3, volume);
      testUtterance.rate = 1.0;
      testUtterance.pitch = lunaPitch;

      if (lunaVoice) {
        testUtterance.voice = lunaVoice;
        testUtterance.lang = lunaVoice.lang;
      } else {
        testUtterance.lang = navigator.language || 'en-US';
      }

      testUtterance.onstart = () => {
        setTestStatus(`✅ Playing test chime & Luna voice: ${lunaVoice ? lunaVoice.name : 'System Default'} (${testUtterance.lang})`);
      };

      testUtterance.onend = () => {
        (window as any).__datovaSpeechUtterance = null;
        setTimeout(() => setTestStatus(null), 5000);
      };

      testUtterance.onerror = (e) => {
        (window as any).__datovaSpeechUtterance = null;
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          setTestStatus(`❌ Voice test error (${e.error}). Verify system audio output.`);
        }
      };

      window.speechSynthesis.speak(testUtterance);
    } catch (err: any) {
      setTestStatus(`❌ Test failed: ${err?.message || 'Audio error'}`);
    }
  };

  const handleTestSpecificVoice = (who: 'luna' | 'nova') => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const { lunaVoice, novaVoice } = resolveVoices();
      const voice = who === 'luna' ? lunaVoice : novaVoice;
      const pitch = who === 'luna' ? lunaPitch : novaPitch;
      const text = who === 'luna'
        ? "Hello! I'm Luna. My lunar scanners are calibrated to explore and question this dataset!"
        : "Greetings! I'm Nova. Core telemetry online, ready with deep dataset insights!";

      const testUtterance = new SpeechSynthesisUtterance(text);
      testUtterance.volume = Math.max(0.3, volume);
      testUtterance.rate = 1.0;
      testUtterance.pitch = pitch;
      if (voice) {
        testUtterance.voice = voice;
        testUtterance.lang = voice.lang;
      }

      window.speechSynthesis.speak(testUtterance);
    } catch (e) {
      console.warn('Voice preview error', e);
    }
  };

  // Copy full briefing script to clipboard
  const handleCopyScript = () => {
    if (!brief) return;
    const formatted = brief.dialogue.map(t => `${t.speaker} (${t.role}):\n"${t.text}"\n`).join('\n');
    navigator.clipboard.writeText(formatted).then(() => {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    });
  };

  // Download script as file
  const handleDownloadScript = () => {
    if (!brief) return;
    const content = `DATANOVA EXECUTIVE BRIEFING\nDataset: ${datasetName}\nDomain: ${brief.domain}\nDuration: ~${brief.duration_est_seconds}s\n\n` +
      `KEY TAKEAWAYS:\n` + brief.key_takeaways.map((k, i) => `${i+1}. ${k}`).join('\n') +
      `\n\nDIALOGUE SCRIPT:\n` +
      brief.dialogue.map(t => `[${t.speaker} - ${t.role}]\n"${t.text}"\n`).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DataNova_Briefing_${datasetName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered dialogue turns for search and tags
  const filteredDialogue = useMemo(() => {
    if (!brief) return [];
    return brief.dialogue.filter((turn) => {
      const isLuna = turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex';
      const isNova = turn.speaker.toLowerCase().includes('nova') || turn.speaker === 'Morgan';

      if (speakerFilter === 'luna' && !isLuna) return false;
      if (speakerFilter === 'nova' && !isNova) return false;
      if (speakerFilter === 'caution' && turn.emphasis !== 'caution') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          turn.text.toLowerCase().includes(query) ||
          turn.speaker.toLowerCase().includes(query) ||
          turn.role.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [brief, speakerFilter, searchQuery]);

  const questionCount = useMemo(() => {
    return brief?.dialogue.filter((t) => t.turn_type === 'question' || t.speaker.toLowerCase().includes('luna') || t.speaker === 'Alex').length || 0;
  }, [brief]);

  const answerCount = useMemo(() => {
    return brief?.dialogue.filter((t) => t.turn_type === 'answer' || t.speaker.toLowerCase().includes('nova') || t.speaker === 'Morgan').length || 0;
  }, [brief]);

  const chapters = useMemo(() => {
    if (!brief?.dialogue) return [];
    const list: { chapter: string; turnIdx: number }[] = [];
    const seen = new Set<string>();
    brief.dialogue.forEach((turn, idx) => {
      if (turn.chapter && !seen.has(turn.chapter)) {
        seen.add(turn.chapter);
        list.push({ chapter: turn.chapter, turnIdx: idx });
      }
    });
    return list;
  }, [brief]);

  if (!isOpen) return null;

  const currentTurn: AudioDialogueTurn | undefined = brief?.dialogue[currentTurnIdx];
  const { lunaVoice, novaVoice, pool } = resolveVoices();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-2xl p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fadeIn min-h-screen">
      <div className="glass-3d-card border border-blue-500/30 rounded-3xl w-full max-w-5xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(59,130,246,0.18)] flex flex-col max-h-[94vh] relative bg-[#070D1E]/95">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-amber-400 pointer-events-none" />

        {/* 1. Modal Top Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-blue-900/40 flex items-center justify-between bg-[#081020]/95 backdrop-blur-md shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600/30 via-blue-600/30 to-cyan-500/20 border border-blue-400/40 flex items-center justify-center text-cyan-300 shadow-lg">
              <Headphones className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                  Executive Podcast Studio • Luna &amp; Nova
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-mono border border-blue-500/30 flex items-center gap-1 font-bold">
                  <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  ROBOT Q&amp;A DUO
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                Dataset: <span className="text-cyan-300 font-medium">{datasetName}</span> • <span className="text-fuchsia-300 font-semibold">Luna</span> (Questions) &amp; <span className="text-cyan-300 font-semibold">Nova</span> (Answers)
              </p>
            </div>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="hidden md:flex items-center bg-[#050B18] p-1 rounded-xl border border-blue-900/60 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Split Studio
            </button>
            <button
              onClick={() => setViewMode('studio')}
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewMode === 'studio'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Cinematic Stage
            </button>
            <button
              onClick={() => setViewMode('transcript')}
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                viewMode === 'transcript'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Full Q&amp;A Script
            </button>
          </div>

          {/* Action Header Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleCopyScript}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-blue-900/50 transition"
              title="Copy entire briefing script"
            >
              {copiedScript ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handleDownloadScript}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-blue-900/50 transition hidden sm:inline-flex"
              title="Download briefing script file"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleTestAudio}
              className="btn-3d-cyan text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-medium shadow-sm"
              title="Test hardware audio tone & voice"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">Test Audio</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl transition ${
                showSettings
                  ? 'bg-blue-600/30 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
              }`}
              title="Voice & Engine Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                stopAudio();
                onClose();
              }}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition"
              title="Close briefing"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Executive Intelligence Metric Strip */}
        {brief && (
          <div className="px-4 sm:px-6 py-2 bg-[#060C1B] border-b border-blue-950 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono shrink-0">
            <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar py-0.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Domain:</span>
                <strong className="text-cyan-300 font-bold">{brief.domain}</strong>
              </span>

              <span className="text-slate-600">•</span>

              <span className="text-slate-300 flex items-center gap-1">
                <span>Duration:</span>
                <strong className="text-white">~{Math.round(brief.duration_est_seconds)}s</strong>
              </span>

              <span className="text-slate-600">•</span>

              <span className="text-slate-300 flex items-center gap-1">
                <span>Script:</span>
                <strong className="text-white">{brief.dialogue.length} Turns</strong>
                <span className="text-fuchsia-300 text-[10px]">({questionCount} Q)</span>
                <span className="text-cyan-300 text-[10px]">({answerCount} A)</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyTakeaways(!showKeyTakeaways)}
              className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition font-sans font-semibold ml-auto"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Key Takeaways ({brief.key_takeaways.length})</span>
              {showKeyTakeaways ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Expandable Key Takeaways Drawer */}
        {showKeyTakeaways && brief && (
          <div className="px-4 sm:px-6 py-3 bg-[#0A1224] border-b border-amber-500/30 text-xs animate-fadeIn shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {brief.key_takeaways.map((takeaway, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-[#0F1B36] to-[#0A1224] border border-amber-500/25 flex items-start gap-2 text-slate-200 shadow-sm"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center justify-center shrink-0 border border-amber-500/30">
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed text-[12px]">{takeaway}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status / Notice Banners */}
        {testStatus && (
          <div className="px-4 sm:px-6 py-2 bg-blue-950/90 border-b border-blue-800/60 text-xs text-cyan-200 flex items-center justify-between animate-fadeIn shrink-0">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              {testStatus}
            </span>
            <button onClick={() => setTestStatus(null)} className="text-slate-400 hover:text-white text-[10px]">
              Dismiss
            </button>
          </div>
        )}

        {speechNotice && (
          <div className="px-4 sm:px-6 py-2 bg-rose-950/90 border-b border-rose-800/60 text-xs text-rose-200 flex items-center justify-between animate-fadeIn shrink-0">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              {speechNotice}
            </span>
            <button onClick={() => setSpeechNotice(null)} className="text-rose-300 hover:text-white text-[10px] underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Voice & Speech Engine Settings Drawer */}
        {showSettings && (
          <div className="px-4 sm:px-6 py-3.5 bg-[#081020] border-b border-blue-900/50 space-y-3.5 animate-fadeIn text-xs shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Robot Voice &amp; Speech Synthesizer Setup
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {pool.length > 0 ? `${pool.length} System Voices Detected` : 'Scanning System Voices...'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Luna Voice Config */}
              <div className="p-3 rounded-2xl bg-[#0D1830] border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-fuchsia-300 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-fuchsia-400" />
                    Luna (Moon Bot • Questions Dataset)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTestSpecificVoice('luna')}
                    className="text-[10px] text-fuchsia-300 hover:text-white px-2 py-0.5 rounded-md bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 transition flex items-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    Preview
                  </button>
                </div>

                <select
                  value={selectedLunaVoice || lunaVoice?.name || ''}
                  onChange={(e) => setSelectedLunaVoice(e.target.value)}
                  className="w-full bg-[#081020] border border-purple-900/60 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-fuchsia-400"
                >
                  {pool.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                  {pool.length === 0 && <option value="">Default System Voice</option>}
                </select>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Pitch Tone:</span>
                  <input
                    type="range"
                    min="0.9"
                    max="1.4"
                    step="0.05"
                    value={lunaPitch}
                    onChange={(e) => setLunaPitch(parseFloat(e.target.value))}
                    className="w-28 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
                  />
                  <span className="font-mono text-fuchsia-300 w-8 text-right">{lunaPitch.toFixed(2)}x</span>
                </div>
              </div>

              {/* Nova Voice Config */}
              <div className="p-3 rounded-2xl bg-[#0D1830] border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Nova (Core Data Oracle • Answers Insights)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTestSpecificVoice('nova')}
                    className="text-[10px] text-cyan-300 hover:text-white px-2 py-0.5 rounded-md bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/30 transition flex items-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    Preview
                  </button>
                </div>

                <select
                  value={selectedNovaVoice || novaVoice?.name || ''}
                  onChange={(e) => setSelectedNovaVoice(e.target.value)}
                  className="w-full bg-[#081020] border border-cyan-900/60 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                >
                  {pool.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                  {pool.length === 0 && <option value="">Default System Voice</option>}
                </select>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Pitch Tone:</span>
                  <input
                    type="range"
                    min="0.75"
                    max="1.15"
                    step="0.05"
                    value={novaPitch}
                    onChange={(e) => setNovaPitch(parseFloat(e.target.value))}
                    className="w-28 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="font-mono text-cyan-300 w-8 text-right">{novaPitch.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Main Modal Content Body */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-300 font-medium tracking-wide">
              Calibrating Luna &amp; Nova intelligence telemetry...
            </p>
          </div>
        ) : brief ? (
          <div className="p-3 sm:p-5 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
            {/* 3A. Interactive Multi-Segment Timeline Scrubber */}
            <div className="p-3 rounded-2xl bg-[#091124]/90 border border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Timeline Dialogue Scrubber</span>
                </span>
                <span className="text-slate-300 font-bold">
                  Turn {currentTurnIdx + 1} of {brief.dialogue.length}
                </span>
              </div>

              {/* Segmented Turn Track */}
              <div
                className="grid gap-1 sm:gap-1.5"
                style={{ gridTemplateColumns: `repeat(${brief.dialogue.length}, minmax(0, 1fr))` }}
              >
                {brief.dialogue.map((turn, i) => {
                  const isCurrent = currentTurnIdx === i;
                  const isLuna = turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex';

                  return (
                    <button
                      key={turn.id || i}
                      type="button"
                      onClick={() => {
                        stopAudio();
                        setSpeechNotice(null);
                        setCurrentTurnIdx(i);
                        setIsPlaying(true);
                        playAudioChime(volume);
                        playTurn(i, true);
                      }}
                      className={`relative h-2.5 sm:h-3 rounded-full transition-all group overflow-hidden ${
                        isCurrent
                          ? isLuna
                            ? 'ring-2 ring-fuchsia-400 shadow-[0_0_12px_rgba(192,132,252,0.8)]'
                            : 'ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                          : 'opacity-65 hover:opacity-100'
                      } ${
                        isLuna
                          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-400'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                      }`}
                      title={`Turn ${i + 1}: ${turn.speaker} - ${turn.chapter || (isLuna ? 'Question' : 'Answer')}`}
                    >
                      {isCurrent && (
                        <span className="absolute inset-0 bg-white/40 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Chapter Quick-Jump Bar */}
              {chapters.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1.5 pb-0.5">
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 uppercase tracking-wider">Chapters:</span>
                  {chapters.map((ch, idx) => {
                    const isChapterActive = currentTurnIdx >= ch.turnIdx &&
                      (idx === chapters.length - 1 || currentTurnIdx < chapters[idx + 1].turnIdx);

                    return (
                      <button
                        key={ch.chapter}
                        type="button"
                        onClick={() => {
                          stopAudio();
                          setSpeechNotice(null);
                          setCurrentTurnIdx(ch.turnIdx);
                          setIsPlaying(true);
                          playAudioChime(volume);
                          playTurn(ch.turnIdx, true);
                        }}
                        className={`text-[10px] px-2.5 py-0.5 rounded-lg whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                          isChapterActive
                            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.3)] font-semibold'
                            : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                        title={`Jump to ${ch.chapter}`}
                      >
                        <Layers className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{ch.chapter}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3B. 3D Robot Broadcast Studio Stage (Visible in Split & Studio views) */}
            {viewMode !== 'transcript' && (
              <RobotPodcastStudio
                currentTurn={currentTurn}
                currentTurnIdx={currentTurnIdx}
                totalTurns={brief.dialogue.length}
                isPlaying={isPlaying}
                volume={volume}
                isMuted={isMuted}
                onSelectSpeaker={handleSelectSpeaker}
                onNextTurn={handleSkipNext}
                onPrevTurn={handleSkipPrev}
                datasetName={datasetName}
              />
            )}

            {/* 3C. Audio Controls Console Dock */}
            <div className="glass-3d-card flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-2xl border border-blue-900/60 shadow-lg bg-[#0B152B]/95">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleSkipPrev}
                  disabled={currentTurnIdx === 0}
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white disabled:opacity-30 transition hover:border-blue-700"
                  title="Previous dialogue turn"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="btn-3d-primary w-11 h-11 rounded-2xl text-white flex items-center justify-center transition shadow-[0_0_25px_rgba(37,99,235,0.45)] hover:scale-105 active:scale-95"
                  title={isPlaying ? 'Pause Briefing' : 'Play Briefing'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkipNext}
                  disabled={currentTurnIdx >= brief.dialogue.length - 1}
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white disabled:opacity-30 transition hover:border-blue-700"
                  title="Next dialogue turn"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleRestart}
                  title="Restart from beginning"
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white transition hover:border-blue-700"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Volume & Mute */}
                <div className="flex items-center gap-1.5 bg-[#081020] px-2.5 py-1.5 rounded-xl border border-blue-900/60">
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
                    className="p-0.5 rounded text-slate-300 hover:text-white transition"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-4 h-4 text-cyan-300" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-300" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (isMuted && val > 0) setIsMuted(false);
                    }}
                    className="w-16 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  />
                  <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>

              {/* Center Spectrum Wave Bar */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#081020] border border-blue-900/60">
                <canvas
                  ref={canvasRef}
                  width={180}
                  height={22}
                  className="w-36 h-5"
                />
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSpeedToggle}
                  className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-cyan-300 bg-[#081020] border border-blue-800/60 hover:border-cyan-400 transition"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                <div className="text-[11px] font-mono text-slate-300 bg-[#081020] px-2.5 py-1 rounded-xl border border-blue-900/50 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
                  <span>{isPlaying ? 'PLAYING' : 'IDLE'}</span>
                </div>
              </div>
            </div>

            {/* 3D. Synced Q&A Dialogue Transcript (Visible in Split & Transcript views) */}
            {viewMode !== 'studio' && (
              <div className="space-y-2.5 pt-1">
                {/* Transcript Header with Search & Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Synchronized Dialogue Feed</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({filteredDialogue.length} turns)
                    </span>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 flex-wrap text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSpeakerFilter('all')}
                      className={`px-2.5 py-0.5 rounded-lg font-medium transition ${
                        speakerFilter === 'all'
                          ? 'bg-blue-600/30 text-cyan-300 border border-cyan-400/40'
                          : 'text-slate-400 hover:text-white bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeakerFilter('luna')}
                      className={`px-2.5 py-0.5 rounded-lg font-medium transition flex items-center gap-1 ${
                        speakerFilter === 'luna'
                          ? 'bg-purple-600/30 text-fuchsia-300 border border-fuchsia-400/40'
                          : 'text-slate-400 hover:text-white bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      <Moon className="w-3 h-3 text-fuchsia-400" />
                      Luna (Q)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeakerFilter('nova')}
                      className={`px-2.5 py-0.5 rounded-lg font-medium transition flex items-center gap-1 ${
                        speakerFilter === 'nova'
                          ? 'bg-blue-600/30 text-cyan-300 border border-cyan-400/40'
                          : 'text-slate-400 hover:text-white bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Nova (A)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeakerFilter('caution')}
                      className={`px-2 py-0.5 rounded-lg font-medium transition flex items-center gap-1 ${
                        speakerFilter === 'caution'
                          ? 'bg-rose-600/30 text-rose-300 border border-rose-400/40'
                          : 'text-slate-400 hover:text-white bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      Risks
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search dialogue keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#081020] border border-blue-900/60 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Dialogue Turn Cards List */}
                <div
                  ref={transcriptContainerRef}
                  className={`space-y-2.5 overflow-y-auto pr-1 custom-scrollbar ${
                    viewMode === 'transcript' ? 'max-h-[550px]' : 'max-h-56 sm:max-h-64'
                  }`}
                >
                  {filteredDialogue.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono">
                      No dialogue turns match "{searchQuery}"
                    </div>
                  ) : (
                    filteredDialogue.map((turn) => {
                      const origIdx = brief.dialogue.findIndex(t => t.id === turn.id);
                      const activeIdx = origIdx !== -1 ? origIdx : 0;
                      const isCurrent = currentTurnIdx === activeIdx;
                      const isLuna = turn.speaker.toLowerCase().includes('luna') || turn.speaker === 'Alex';
                      const isNova = turn.speaker.toLowerCase().includes('nova') || turn.speaker === 'Morgan';

                      return (
                        <div
                          key={turn.id}
                          data-turn-idx={activeIdx}
                          onClick={() => {
                            stopAudio();
                            setSpeechNotice(null);
                            setCurrentTurnIdx(activeIdx);
                            setIsPlaying(true);
                            playAudioChime(volume);
                            playTurn(activeIdx, true);
                          }}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-start group ${
                            isCurrent
                              ? isLuna
                                ? 'bg-purple-950/70 border-fuchsia-400/80 shadow-[0_0_22px_rgba(192,132,252,0.25)] ring-1 ring-fuchsia-400/50'
                                : 'bg-blue-950/70 border-cyan-400/80 shadow-[0_0_22px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                              : 'bg-[#081020]/75 border-blue-950/80 hover:bg-[#0D1B36]/60 hover:border-blue-800 text-slate-400'
                          }`}
                        >
                          {/* Speaker Avatar Icon */}
                          <div
                            className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-sm font-black shadow-sm ${
                              isLuna
                                ? 'bg-gradient-to-tr from-purple-600 to-fuchsia-400 text-white ring-1 ring-fuchsia-400/40'
                                : 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white ring-1 ring-cyan-400/40'
                            }`}
                          >
                            {isLuna ? '🌙' : '✨'}
                          </div>

                          <div className="flex-1 text-xs">
                            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-bold ${
                                    isLuna ? 'text-fuchsia-300' : 'text-cyan-300'
                                  }`}
                                >
                                  {turn.speaker}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800">
                                  {turn.role}
                                </span>
                              </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {turn.chapter && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-900/30 text-blue-300 border border-blue-700/40 font-mono flex items-center gap-1">
                                      <Layers className="w-2.5 h-2.5 text-blue-400" /> {turn.chapter}
                                    </span>
                                  )}
                                  {(turn.turn_type === 'question' || isLuna) && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-1">
                                      <Moon className="w-2.5 h-2.5" /> Question
                                    </span>
                                  )}
                                  {(turn.turn_type === 'answer' || isNova) && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> Answer
                                    </span>
                                  )}
                                  {turn.emphasis === 'caution' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Risk Alert
                                    </span>
                                  )}

                                  <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                                    Click to Listen
                                  </span>
                                </div>
                            </div>

                            <p
                              className={`leading-relaxed text-xs sm:text-[13px] ${
                                isCurrent
                                  ? 'text-white font-medium'
                                  : 'text-slate-300'
                              }`}
                            >
                              "{turn.text}"
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
