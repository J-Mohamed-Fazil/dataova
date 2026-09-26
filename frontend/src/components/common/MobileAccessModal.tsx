import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Smartphone,
  Laptop,
  QrCode,
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  Wifi,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Download,
  CheckCircle2,
  Compass,
  MonitorDown
} from 'lucide-react';
import { api } from '../../services/api';

interface MobileAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeviceTab = 'connect' | 'ios' | 'android' | 'laptop';

export const MobileAccessModal: React.FC<MobileAccessModalProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = useState<{ local_ip: string; port: number; mobile_url: string; hostname: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DeviceTab>('connect');
  const [detectedPlatform, setDetectedPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect user platform
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setDetectedPlatform('ios');
        setActiveTab('ios');
      } else if (/Android/i.test(ua)) {
        setDetectedPlatform('android');
        setActiveTab('android');
      } else {
        setDetectedPlatform('desktop');
        setActiveTab('connect');
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (isOpen) {
      api.getNetworkInfo()
        .then(setNetworkInfo)
        .catch(() => {
          // Fallback if fetch fails
          const host = window.location.hostname;
          const port = window.location.port || '5173';
          setNetworkInfo({
            local_ip: host,
            port: Number(port),
            mobile_url: `http://${host}:${port}`,
            hostname: 'Localhost'
          });
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const mobileUrl = networkInfo?.mobile_url || window.location.origin;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallNow = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result?.outcome === 'accepted') {
      setDeferredInstallPrompt(null);
    }
  };

  // Generate QR Code URL using high-availability QR API with dark cyber styling
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(mobileUrl)}&bgcolor=081126&color=38bdf8&margin=8`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/85 backdrop-blur-xl animate-fadeIn"
      style={{ zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl md:max-w-2xl rounded-3xl bg-[#081126] border border-cyan-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] overflow-hidden flex flex-col my-auto max-h-[92vh] sm:max-h-[88vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-modal-title"
      >
        {/* Cyber Neon Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-800/90 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#060D1E] via-[#08132B] to-[#060D1E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)] shrink-0">
              <Smartphone className="w-5 h-5 text-cyan-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="mobile-modal-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                  Phone & Tablet Access
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold hidden sm:inline">
                  LOCAL WI-FI
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                Scan QR or visit Wi-Fi URL on iPhone, iPad, Android or MacBook
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Mode Switcher Navigation Pills */}
        <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-slate-800/60 bg-[#060D1E]/60 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#050A18] border border-slate-800/90 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('connect')}
              className={`flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'connect'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Wi-Fi & QR</span>
            </button>

            <button
              onClick={() => setActiveTab('ios')}
              className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'ios'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-600/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>🍏</span>
              <span>Apple iOS</span>
              {detectedPlatform === 'ios' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('android')}
              className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'android'
                  ? 'bg-gradient-to-r from-indigo-500/25 to-cyan-600/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>🤖</span>
              <span>Android</span>
              {detectedPlatform === 'android' && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('laptop')}
              className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'laptop'
                  ? 'bg-gradient-to-r from-blue-500/25 to-indigo-600/25 text-blue-300 border border-blue-400/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-blue-400" />
              <span>Mac & PC</span>
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Active Tab 1: Wi-Fi & QR Code Scan */}
          {activeTab === 'connect' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* QR Code Container */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-[#050C1B] border border-cyan-500/30 shadow-inner text-center relative group">
                  <div className="relative p-2 rounded-xl bg-[#081126] border border-cyan-400/40 shadow-xl group-hover:border-cyan-400 transition-colors">
                    <img
                      src={qrCodeUrl}
                      alt="Datanova Mobile QR Code"
                      className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg object-contain block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 m-auto w-9 h-9 rounded-xl bg-[#050C1B]/95 border border-cyan-400 flex items-center justify-center pointer-events-none shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                    </div>
                  </div>

                  <span className="text-[11px] text-cyan-300 font-mono mt-2.5 flex items-center gap-1.5 font-bold">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Point Phone Camera to Scan</span>
                  </span>
                </div>

                {/* Direct LAN Wi-Fi Address & Quick Actions */}
                <div className="sm:col-span-7 space-y-3">
                  <div className="p-3.5 rounded-2xl bg-[#060D1E] border border-slate-800 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-mono text-cyan-300 font-bold">
                        <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Direct Wi-Fi URL</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Broadcasting Live
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-xl bg-[#09152E] border border-cyan-500/40 font-mono text-xs sm:text-sm text-cyan-200 select-all break-all shadow-inner font-semibold">
                        {mobileUrl}
                      </div>

                      <button
                        onClick={handleCopy}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/50 text-xs font-bold flex items-center gap-1.5 transition shrink-0 active:scale-95 shadow-sm"
                        title="Copy Wi-Fi Address"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Make sure your iPhone, iPad, or Android phone is on the <strong className="text-white">same Wi-Fi network</strong> or mobile hotspot as this machine.
                    </p>
                  </div>

                  {/* Device Quick Switch Callouts */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setActiveTab('ios')}
                      className="p-2.5 rounded-xl bg-[#060D1E] border border-slate-800 hover:border-emerald-500/40 text-left transition group active:scale-95"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-emerald-300">
                        <span>🍏</span>
                        <span>iPhone / iPad</span>
                        <ArrowRight className="w-3 h-3 ml-auto text-slate-500 group-hover:text-emerald-300 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Add to Home Screen in Safari</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('android')}
                      className="p-2.5 rounded-xl bg-[#060D1E] border border-slate-800 hover:border-cyan-500/40 text-left transition group active:scale-95"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-cyan-300">
                        <span>🤖</span>
                        <span>Android</span>
                        <ArrowRight className="w-3 h-3 ml-auto text-slate-500 group-hover:text-cyan-300 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Install App from Chrome</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Step Quick Guide */}
              <div className="p-3 rounded-2xl bg-[#050C1B]/80 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-mono text-[10px] font-bold">1</span>
                  <span>Same Wi-Fi</span>
                </div>
                <div className="hidden sm:block text-slate-600">→</div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-mono text-[10px] font-bold">2</span>
                  <span>Scan or Type URL</span>
                </div>
                <div className="hidden sm:block text-slate-600">→</div>
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-mono text-[10px] font-bold">3</span>
                  <span>Instant 3D Mobile Experience!</span>
                </div>
              </div>
            </div>
          )}

          {/* Active Tab 2: Apple iOS (iPhone & iPad) */}
          {activeTab === 'ios' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#05141D] to-[#071928] border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                    🍏
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Apple iOS Installation Guide</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        SAFARI PWA
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Install Datanova directly on iPhone or iPad with native app launch</p>
                  </div>
                </div>

                <button
                  onClick={handleCopy}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 transition shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              {/* 4 Interactive Visual Step Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-emerald-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-white">Open in Safari</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Open <strong className="text-emerald-300 font-mono">{mobileUrl}</strong> specifically in Apple's Safari browser.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-emerald-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-white">Tap Share Button</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Tap the <strong className="text-white">Share</strong> icon (square with arrow up ⎋) at the bottom toolbar of Safari.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-emerald-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                      3
                    </span>
                    <h4 className="text-xs font-bold text-white">Add to Home Screen</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Scroll down the sheet and select <strong className="text-emerald-300">"Add to Home Screen"</strong> with the [+] icon.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-emerald-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                      4
                    </span>
                    <h4 className="text-xs font-bold text-white">Tap Add &mdash; Fullscreen!</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Tap <strong className="text-white">Add</strong> in top-right. Launches like a native app with zero browser URL bar!
                  </p>
                </div>
              </div>

              {/* iOS Benefit Highlights */}
              <div className="p-2.5 rounded-xl bg-[#070F22] border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-300 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Full touch gestures, haptic feedback & full-screen iPad multitasking</span>
                </span>
              </div>
            </div>
          )}

          {/* Active Tab 3: Android (Samsung / Pixel) */}
          {activeTab === 'android' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#051121] to-[#081830] border border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Android Installation Guide</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        NATIVE PWA
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Chrome, Samsung Internet, Edge on Samsung Galaxy, Pixel, OnePlus</p>
                  </div>
                </div>

                {deferredInstallPrompt ? (
                  <button
                    onClick={handleInstallNow}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install Now</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopy}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold hover:bg-cyan-500/30 transition shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy URL'}</span>
                  </button>
                )}
              </div>

              {/* 4 Android Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center border border-cyan-500/30">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-white">Open in Chrome</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Open <strong className="text-cyan-300 font-mono">{mobileUrl}</strong> in Google Chrome or Edge.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center border border-cyan-500/30">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-white">Tap the 3 Dots (⋮)</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Tap the <strong className="text-white">three dots menu (⋮)</strong> in the top right corner of Chrome.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center border border-cyan-500/30">
                      3
                    </span>
                    <h4 className="text-xs font-bold text-white">Tap "Install App"</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Select <strong className="text-cyan-300">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-cyan-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center border border-cyan-500/30">
                      4
                    </span>
                    <h4 className="text-xs font-bold text-white">Launches from Drawer</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    App is placed in your Android app drawer with full high-resolution icon!
                  </p>
                </div>
              </div>

              {/* Android Highlights */}
              <div className="p-2.5 rounded-xl bg-[#070F22] border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-300 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fast offline caching, instant resume, and native tablet split-screen</span>
                </span>
              </div>
            </div>
          )}

          {/* Active Tab 4: Apple MacBook & PC */}
          {activeTab === 'laptop' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#071329] to-[#0A1A3A] border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(59,130,246,0.25)]">
                    💻
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Apple Mac & Windows Desktop</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        STANDALONE WINDOW
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Chrome, Edge, or Safari on any laptop or desktop computer</p>
                  </div>
                </div>

                <button
                  onClick={handleCopy}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold hover:bg-blue-500/30 transition shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              {/* 3 Step Desktop Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-blue-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 font-mono text-xs font-bold flex items-center justify-center border border-blue-500/30">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-white">Open in Browser</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Open <strong className="text-blue-300 font-mono">{mobileUrl}</strong> in Chrome, Edge, or Safari.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-blue-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 font-mono text-xs font-bold flex items-center justify-center border border-blue-500/30">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-white">Click Install Icon</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Click the <strong className="text-blue-300">Install icon (⊕)</strong> right in the browser address bar.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-[#060D1F] border border-slate-800 space-y-1 hover:border-blue-500/40 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 font-mono text-xs font-bold flex items-center justify-center border border-blue-500/30">
                      3
                    </span>
                    <h4 className="text-xs font-bold text-white">Standalone App</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-8 leading-relaxed">
                    Runs in an isolated window without tabs, dockable to Mac Dock or Windows Taskbar!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-800/90 bg-[#060D1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Host: <strong className="text-white">{networkInfo?.hostname || 'Localhost'}</strong></span>
            <span className="text-slate-600">•</span>
            <span>Port: <strong className="text-cyan-300">5173</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition active:scale-95"
            >
              {copied ? 'URL Copied!' : 'Copy Wi-Fi URL'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold text-xs hover:opacity-90 transition shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
