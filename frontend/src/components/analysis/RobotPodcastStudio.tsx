import React from 'react';
import {
  Radio,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AudioDialogueTurn } from '../../types';
import { MiniPodcastRobots3D } from './MiniPodcastRobots3D';

interface RobotPodcastStudioProps {
  currentTurn?: AudioDialogueTurn;
  currentTurnIdx?: number;
  totalTurns?: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onSelectSpeaker?: (speaker: 'Luna' | 'Nova') => void;
  onNextTurn?: () => void;
  onPrevTurn?: () => void;
  datasetName: string;
}

export const RobotPodcastStudio: React.FC<RobotPodcastStudioProps> = ({
  currentTurn,
  currentTurnIdx = 0,
  totalTurns = 7,
  isPlaying,
  volume,
  isMuted,
  onSelectSpeaker,
  onNextTurn,
  onPrevTurn,
  datasetName,
}) => {
  const speakerName = currentTurn?.speaker?.toLowerCase() || '';
  const isLunaSpeaking = isPlaying && !isMuted && (speakerName.includes('luna') || speakerName.includes('alex'));
  const isNovaSpeaking = isPlaying && !isMuted && (speakerName.includes('nova') || speakerName.includes('morgan'));

  // Active question vs answer check
  const isQuestion = currentTurn?.turn_type === 'question' || isLunaSpeaking;

  const handleRobotClick = (who: 'luna' | 'nova') => {
    if (onSelectSpeaker) {
      onSelectSpeaker(who === 'luna' ? 'Luna' : 'Nova');
    }
  };

  return (
    <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-b from-[#0c1836] via-[#11234c] to-[#0a142e] border border-blue-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_20px_rgba(59,130,246,0.18)] select-none">
      {/* Soft Ambient Studio Lighting Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(192,132,252,0.15),transparent_50%),radial-gradient(circle_at_75%_35%,rgba(56,189,248,0.15),transparent_50%)] pointer-events-none" />

      {/* Studio Header Bar */}
      <div className="px-3 sm:px-5 py-2 flex items-center justify-between border-b border-blue-900/40 bg-[#060D1E]/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* ON AIR Studio Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider transition-all duration-300 ${
              isPlaying && !isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying && !isMuted ? 'bg-rose-400 animate-ping' : 'bg-slate-500'
              }`}
            />
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3" />
              {isPlaying && !isMuted ? 'ON AIR' : 'STANDBY'}
            </span>
          </div>

          <span className="hidden sm:inline text-xs text-slate-400 font-medium">
            3D Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs text-cyan-300/80 font-mono px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/50 flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="hidden md:inline">Topic:</span> {datasetName}
          </span>
        </div>
      </div>

      {/* Main Compact 3D WebGL Robots Stage (Three.js) */}
      <div className="relative w-full flex items-center justify-center min-h-[240px] sm:min-h-[270px] md:min-h-[290px]">
        {/* Real 3D Mini Robots Scene */}
        <MiniPodcastRobots3D
          isLunaSpeaking={isLunaSpeaking}
          isNovaSpeaking={isNovaSpeaking}
          isPlaying={isPlaying}
          volume={volume}
          isMuted={isMuted}
          onRobotClick={handleRobotClick}
        />
      </div>

      {/* Clean Teleprompter Dialogue Bubble docked directly beneath the 3D scene */}
      {currentTurn && (
        <div className="px-3 sm:px-5 pb-2.5">
          <div
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-xl border transition-all duration-300 shadow-xl flex items-start gap-2.5 ${
              isLunaSpeaking || speakerName.includes('luna') || isQuestion
                ? 'bg-gradient-to-r from-[#180B30]/95 via-[#130E2E]/90 to-[#0A1224]/90 border-purple-500/40 shadow-[0_8px_25px_rgba(168,85,247,0.20)]'
                : 'bg-gradient-to-r from-[#0A1224]/90 via-[#0B1A3B]/90 to-[#081830]/95 border-cyan-500/40 shadow-[0_8px_25px_rgba(6,182,212,0.20)]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-extrabold shadow-md border ${
                isLunaSpeaking || speakerName.includes('luna') || isQuestion
                  ? 'bg-gradient-to-tr from-purple-600 to-fuchsia-400 text-white border-purple-300/40 ring-1 ring-purple-400/30'
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-400 text-white border-cyan-300/40 ring-1 ring-cyan-400/30'
              }`}
            >
              {isLunaSpeaking || speakerName.includes('luna') || isQuestion ? '🌙' : '✨'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1 ${
                      isLunaSpeaking || speakerName.includes('luna') || isQuestion
                        ? 'text-fuchsia-300'
                        : 'text-cyan-300'
                    }`}
                  >
                    {isLunaSpeaking || speakerName.includes('luna') || isQuestion
                      ? '🌙 LUNA'
                      : '✨ NOVA'}
                  </span>

                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
                    {currentTurn.role}
                  </span>

                  {isPlaying && (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-cyan-300 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      SPEAKING
                    </span>
                  )}
                </div>

                {/* Prompter Turn Navigation Buttons */}
                <div className="flex items-center gap-1">
                  {onPrevTurn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrevTurn();
                      }}
                      disabled={currentTurnIdx === 0}
                      className="p-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition border border-slate-700/60"
                      title="Previous dialogue turn"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono px-1">
                    {currentTurnIdx + 1}/{totalTurns}
                  </span>
                  {onNextTurn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNextTurn();
                      }}
                      disabled={currentTurnIdx >= totalTurns - 1}
                      className="p-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition border border-slate-700/60"
                      title="Next dialogue turn"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-100 font-medium leading-relaxed line-clamp-2">
                "{currentTurn.text}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stage Footer Status Indicators */}
      <div className="px-3 sm:px-5 py-1.5 border-t border-blue-900/40 bg-[#060D1E]/90 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5 cursor-pointer hover:text-fuchsia-300 transition" onClick={() => handleRobotClick('luna')}>
            <span className={`w-2 h-2 rounded-full ${isLunaSpeaking ? 'bg-fuchsia-400 shadow-[0_0_8px_#c084fc]' : 'bg-slate-600'}`} />
            <strong className="text-slate-200">Luna</strong> (Moon Bot)
          </span>
          <span className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition" onClick={() => handleRobotClick('nova')}>
            <span className={`w-2 h-2 rounded-full ${isNovaSpeaking ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]' : 'bg-slate-600'}`} />
            <strong className="text-slate-200">Nova</strong> (Data Oracle)
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[10px]">
          <span>Move mouse to guide heads • Click robots to celebrate</span>
        </div>
      </div>
    </div>
  );
};
