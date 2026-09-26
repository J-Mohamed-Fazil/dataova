import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Mic
} from 'lucide-react';
import { api } from '../../services/api';
import { AudioBriefResponse, AudioDialogueTurn } from '../../types';

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
  const [selectedAlexVoice, setSelectedAlexVoice] = useState<string>('');
  const [selectedMorganVoice, setSelectedMorganVoice] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

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

  // Resolve best voices for Alex & Morgan
  const resolveVoices = useCallback(() => {
    const list = voices.length > 0
      ? voices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() || [] : []);

    let alexV = list.find((v) => v.name === selectedAlexVoice);
    let morganV = list.find((v) => v.name === selectedMorganVoice);

    const enVoices = list.filter((v) =>
      v.lang.startsWith('en') ||
      (typeof navigator !== 'undefined' && v.lang.startsWith(navigator.language.slice(0, 2)))
    );
    const pool = enVoices.length > 0 ? enVoices : list;

    if (!alexV && pool.length > 0) {
      alexV = pool.find((v) =>
        /female|zira|samantha|jenny|heera|neerja|victoria|karen|catherine/i.test(v.name)
      ) || pool[0];
    }

    if (!morganV && pool.length > 0) {
      morganV = pool.find((v) =>
        v.name !== alexV?.name &&
        /male|david|george|guy|mark|ravi|prabhat|daniel|alex|richard/i.test(v.name)
      );
      if (!morganV) {
        morganV = pool.find((v) => v.name !== alexV?.name) || alexV;
      }
    }

    return { alexVoice: alexV, morganVoice: morganV, pool: list };
  }, [voices, selectedAlexVoice, selectedMorganVoice]);

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

    let bars = Array.from({ length: 42 }, () => Math.random() * 16 + 4);

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
            42,
            Math.max(6, height + (Math.random() - 0.5) * 16 * volume)
          );
        } else {
          targetHeight = Math.max(4, height * 0.9);
        }
        bars[i] = targetHeight;

        const grad = ctx.createLinearGradient(0, canvas.height - targetHeight, 0, canvas.height);
        grad.addColorStop(0, '#38BDF8'); // Cyan-400
        grad.addColorStop(0.5, '#2563EB'); // Blue-600
        grad.addColorStop(1, '#1D4ED8'); // Blue-700

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

      const { alexVoice, morganVoice } = resolveVoices();
      const speakerVoice = turn.speaker === 'Alex' ? alexVoice : morganVoice;

      if (speakerVoice) {
        utterance.voice = speakerVoice;
        utterance.lang = speakerVoice.lang;
      } else {
        utterance.lang = navigator.language || 'en-US';
      }

      if (turn.speaker === 'Alex') {
        utterance.pitch = 1.12;
      } else {
        utterance.pitch = 0.90;
        if (alexVoice && morganVoice && alexVoice.name === morganVoice.name) {
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

  const handleTestAudio = () => {
    try {
      setSpeechNotice(null);
      setTestStatus('Testing hardware speaker chime & voice...');
      playAudioChime(Math.max(0.3, volume));

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setTestStatus('⚠️ Web Speech API not supported in this browser.');
        return;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const { alexVoice } = resolveVoices();
      const testUtterance = new SpeechSynthesisUtterance('DataNova audio test successful. Voice synthesis is operational.');
      (window as any).__datovaSpeechUtterance = testUtterance;

      testUtterance.volume = Math.max(0.3, volume);
      testUtterance.rate = 1.0;
      testUtterance.pitch = 1.05;

      if (alexVoice) {
        testUtterance.voice = alexVoice;
        testUtterance.lang = alexVoice.lang;
      } else {
        testUtterance.lang = navigator.language || 'en-US';
      }

      testUtterance.onstart = () => {
        setTestStatus(`✅ Playing test tone & voice: ${alexVoice ? alexVoice.name : 'System Default'} (${testUtterance.lang})`);
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

  if (!isOpen) return null;

  const currentTurn: AudioDialogueTurn | undefined = brief?.dialogue[currentTurnIdx];
  const { alexVoice, morganVoice, pool } = resolveVoices();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-2xl p-2 sm:p-4 md:p-6 flex items-center justify-center animate-fadeIn min-h-screen">
      <div className="glass-3d-card border border-blue-500/30 rounded-3xl w-full max-w-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_60px_rgba(59,130,246,0.18)] flex flex-col max-h-[90vh] relative bg-[#070D1E]/95">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-blue-900/40 flex items-center justify-between bg-[#081020]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/20 border border-blue-400/40 flex items-center justify-center text-cyan-300 shadow-lg">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  Executive Briefing Audio Suite
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-mono border border-blue-500/30 flex items-center gap-1 font-bold">
                  <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  AI PODCAST SYNTH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm sm:max-w-md">
                Synthesized 2-host strategic debrief for <span className="text-cyan-300 font-medium">{datasetName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestAudio}
              className="btn-3d-cyan text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-medium shadow-sm"
              title="Test hardware chime and speech synthesis"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">Test Audio</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl transition ${
                showSettings
                  ? 'bg-blue-600/30 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
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
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Status Banners */}
        {testStatus && (
          <div className="px-5 sm:px-6 py-2 bg-blue-950/90 border-b border-blue-800/60 text-xs text-cyan-200 flex items-center justify-between animate-fadeIn shrink-0">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              {testStatus}
            </span>
            <button
              onClick={() => setTestStatus(null)}
              className="text-slate-400 hover:text-white text-[10px] ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {speechNotice && (
          <div className="px-5 sm:px-6 py-2.5 bg-rose-950/90 border-b border-rose-800/60 text-xs text-rose-200 flex items-center justify-between animate-fadeIn shrink-0">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              {speechNotice}
            </span>
            <button
              onClick={() => setSpeechNotice(null)}
              className="text-rose-300 hover:text-white text-[10px] underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Voice & Audio Settings Drawer */}
        {showSettings && (
          <div className="px-5 sm:px-6 py-3.5 bg-[#081020] border-b border-blue-900/50 space-y-3 animate-fadeIn text-xs shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Audio & Voice Engine Setup
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {pool.length > 0 ? `${pool.length} System Voices Detected` : 'Scanning System Voices...'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-cyan-300 mb-1">
                  Alex (Lead Strategist Voice)
                </label>
                <select
                  value={selectedAlexVoice || alexVoice?.name || ''}
                  onChange={(e) => setSelectedAlexVoice(e.target.value)}
                  className="w-full bg-[#0D1B36] border border-blue-800/60 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                >
                  {pool.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                  {pool.length === 0 && <option value="">Default System Voice</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-300 mb-1">
                  Morgan (Risk Analyst Voice)
                </label>
                <select
                  value={selectedMorganVoice || morganVoice?.name || ''}
                  onChange={(e) => setSelectedMorganVoice(e.target.value)}
                  className="w-full bg-[#0D1B36] border border-blue-800/60 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                >
                  {pool.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                  {pool.length === 0 && <option value="">Default System Voice</option>}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body */}
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Synthesizing executive briefing dialogue...</p>
          </div>
        ) : brief ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Visualizer & Active Speaker Stage */}
            <div className="p-4 rounded-2xl bg-[#081020]/90 border border-blue-900/50 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={400}
                height={50}
                className="w-full max-w-md h-12"
              />

              {/* Active Speaker Card */}
              {currentTurn && (
                <div className="mt-2.5 flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#0D1B36] border border-cyan-500/40 shadow-lg animate-fadeIn">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shadow-md ${
                      currentTurn.speaker === 'Alex'
                        ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 ring-2 ring-cyan-400/40'
                        : 'bg-gradient-to-tr from-indigo-600 to-purple-500 ring-2 ring-indigo-400/40'
                    }`}
                  >
                    {currentTurn.speaker[0]}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white leading-tight">
                        {currentTurn.speaker}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({currentTurn.role})
                      </span>
                    </div>
                  </div>
                  {isPlaying && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" />
                      <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                      <span className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Audio Controls Console */}
            <div className="glass-3d-card flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-2xl border border-blue-900/60 shadow-lg bg-[#0B152B]/90">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleSkipPrev}
                  disabled={currentTurnIdx === 0}
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white disabled:opacity-40 transition"
                  title="Previous turn"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="btn-3d-primary w-11 h-11 rounded-2xl text-white flex items-center justify-center transition shadow-[0_0_20px_rgba(37,99,235,0.4)]"
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
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white disabled:opacity-40 transition"
                  title="Next turn"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleRestart}
                  title="Restart from beginning"
                  className="p-2 rounded-xl bg-[#081020] border border-blue-900/60 text-slate-300 hover:text-white transition"
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSpeedToggle}
                  className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-cyan-300 bg-[#081020] border border-blue-800/60 hover:border-cyan-400 transition"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>
                <span className="text-[11px] font-mono text-slate-400 bg-[#081020] px-2.5 py-1 rounded-xl border border-blue-900/50">
                  Turn {currentTurnIdx + 1} of {brief.dialogue.length}
                </span>
              </div>
            </div>

            {/* Interactive Synced Transcript */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Executive Dialogue Transcript</span>
                </h4>
                <span className="text-[10px] text-slate-400">Click any dialogue turn to jump</span>
              </div>

              <div
                ref={transcriptContainerRef}
                className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar"
              >
                {brief.dialogue.map((turn, idx) => {
                  const isCurrent = currentTurnIdx === idx;
                  const isAlex = turn.speaker === 'Alex';

                  return (
                    <div
                      key={turn.id || idx}
                      data-turn-idx={idx}
                      onClick={() => {
                        stopAudio();
                        setSpeechNotice(null);
                        setCurrentTurnIdx(idx);
                        setIsPlaying(true);
                        playAudioChime(volume);
                        playTurn(idx, true);
                      }}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-start ${
                        isCurrent
                          ? 'bg-blue-950/70 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                          : 'bg-[#081020]/75 border-blue-950/80 hover:bg-[#0D1B36]/60 hover:border-blue-800 text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-xs font-black text-white shadow-sm ${
                          isAlex
                            ? 'bg-gradient-to-tr from-blue-600 to-cyan-500'
                            : 'bg-gradient-to-tr from-indigo-600 to-purple-500'
                        }`}
                      >
                        {turn.speaker[0]}
                      </div>

                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                isAlex ? 'text-cyan-300' : 'text-indigo-300'
                              }`}
                            >
                              {turn.speaker}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {turn.role}
                            </span>
                          </div>

                          {turn.emphasis === 'caution' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" /> Risk Alert
                            </span>
                          )}
                        </div>

                        <p
                          className={`leading-relaxed text-xs sm:text-[13px] ${
                            isCurrent
                              ? 'text-white font-medium'
                              : 'text-slate-300'
                          }`}
                        >
                          {turn.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
