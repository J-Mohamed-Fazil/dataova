import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Layers,
  AlertCircle,
  CheckCircle2,
  Zap,
  Briefcase,
  UserPlus,
  LogIn,
  GraduationCap,
  KeyRound,
  Send,
  RefreshCw,
  Server
} from 'lucide-react';
import { useAuth } from '../../store/authContext';
import { api } from '../../services/api';
import { RobotGuide3D } from '../tutorial/RobotGuide3D';

export const LoginPage: React.FC = () => {
  const { login, register, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Backend health status
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const checkBackendHealth = async () => {
    try {
      const res = await api.checkHealth();
      setBackendStatus(res.online ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 8000);
    return () => clearInterval(interval);
  }, []);
  
  // Login form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Register form state
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [regRole, setRegRole] = useState<string>('Senior AI Analyst');

  // Forgot password form state
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotCode, setForgotCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [dispatchedCodeNotice, setDispatchedCodeNotice] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Nova Robot state & reactions
  const [robotExpression, setRobotExpression] = useState<
    'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink' | 'wrong' | 'no_account' | 'new_user'
  >('wave');
  const [celebrateTrigger, setCelebrateTrigger] = useState<number>(0);
  const [robotDialogue, setRobotDialogue] = useState<string>(
    "Hello! I am Nova, your Quantum AI Co-Pilot. Enter your email and password to access your workspace!"
  );
  const [reactionType, setReactionType] = useState<
    'normal' | 'correct' | 'wrong' | 'no_account' | 'new_user'
  >('normal');
  const [customReactionTitle, setCustomReactionTitle] = useState<string | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError || authError;

  const handleModeSwitch = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setLocalError(null);
    setResetSuccessMessage(null);
    setDispatchedCodeNotice(null);
    setCustomReactionTitle(null);
    clearAuthError();

    if (newMode === 'register') {
      // NEW USER REACTION
      setRobotExpression('new_user');
      setReactionType('new_user');
      setRobotDialogue("✨ Welcome, new user! Fill in your details below to initialize your quantum analyst workspace!");
    } else if (newMode === 'forgot') {
      // FORGOT PASSWORD GUIDANCE
      setForgotStep('email');
      setForgotEmail(email || '');
      setRobotExpression('explain');
      setReactionType('normal');
      setRobotDialogue("🔑 Need a password reset? Enter your registered email address and I'll send you an encrypted 6-digit recovery code!");
    } else {
      setRobotExpression('happy');
      setReactionType('normal');
      setRobotDialogue("👋 Welcome back! Enter your email and password to resume your intelligence session.");
    }
  };

  const handlePasswordFocus = () => {
    if (reactionType === 'normal') {
      setRobotExpression('thinking');
      setRobotDialogue("🔒 Sensors shielded! Your password and session tokens are encrypted with PBKDF2.");
    }
  };

  const handlePasswordBlur = () => {
    if (reactionType === 'normal') {
      setRobotExpression('happy');
      setRobotDialogue("Ready when you are! Click Sign In to verify credentials.");
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string, roleName: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLocalError(null);
    clearAuthError();

    try {
      setIsSubmitting(true);
      setRobotExpression('thinking');
      setRobotDialogue(`Authenticating as demo profile: ${roleName}...`);

      await login(demoEmail, demoPass);

      setRobotExpression('celebrate');
      setReactionType('correct');
      setCelebrateTrigger((prev) => prev + 1);
      setRobotDialogue(`🎉 Access Granted! Signed in as ${roleName}. Welcome back!`);
    } catch (err: any) {
      const rawMsg = err.message || '';
      const errMsg = rawMsg.toLowerCase();
      setRobotExpression('wrong');
      setReactionType('wrong');

      if (errMsg.includes('offline') || errMsg.includes('port 8000') || errMsg.includes('unreachable') || errMsg.includes('connection')) {
        setBackendStatus('offline');
        setLocalError(rawMsg);
        setRobotDialogue("⚠️ Backend Offline! Port 8000 is not responding. Please run start_backend.bat or start_all.bat.");
      } else {
        setLocalError(rawMsg || 'Demo login failed');
        setRobotDialogue("⚠️ Alert: " + (rawMsg || "Could not complete demo sign-in."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Please enter your email address.');
      setRobotExpression('thinking');
      setRobotDialogue("Please enter your email address so I know which profile to load!");
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email format (e.g. name@organization.com).');
      setRobotExpression('thinking');
      setRobotDialogue("That email format doesn't look quite right. Make sure it includes '@' and a domain!");
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      setRobotExpression('wrong');
      setReactionType('wrong');
      setRobotDialogue("Password cannot be empty! Please type your password.");
      return;
    }

    try {
      setIsSubmitting(true);
      setRobotExpression('thinking');
      setRobotDialogue("Verifying encrypted neural credentials...");

      await login(cleanEmail, password);

      // CORRECT PASSWORD REACTION!
      setRobotExpression('celebrate');
      setReactionType('correct');
      setCelebrateTrigger((prev) => prev + 1);
      setRobotDialogue("🎉 Access Granted! Password verified! Welcome back to DataNova Quantum!");
    } catch (err: any) {
      const rawMsg = err.message || '';
      const errMsg = rawMsg.toLowerCase();

      if (
        errMsg.includes('offline') ||
        errMsg.includes('port 8000') ||
        errMsg.includes('unreachable') ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('start_backend')
      ) {
        setBackendStatus('offline');
        setRobotExpression('wrong');
        setReactionType('wrong');
        setLocalError(rawMsg || "Backend server is offline. Please launch FastAPI on port 8000.");
        setRobotDialogue("⚠️ Backend Offline! The server on Port 8000 is not responding. Please start it with start_backend.bat or start_all.bat.");
      } else if (errMsg.includes('no account') || errMsg.includes('not found')) {
        // NO ACCOUNT REACTION!
        setRobotExpression('no_account');
        setReactionType('no_account');
        setLocalError(rawMsg);
        setRobotDialogue(
          `🔍 Hmm! I couldn't find an account for "${cleanEmail}". Check the spelling or click Register to create one!`
        );
      } else if (errMsg.includes('incorrect password')) {
        // WRONG PASSWORD REACTION!
        setRobotExpression('wrong');
        setReactionType('wrong');
        setLocalError(rawMsg);
        setRobotDialogue("⚠️ Access Denied! Password mismatch. Please check your password or click Reset to set a new password.");
      } else {
        setRobotExpression('wrong');
        setReactionType('wrong');
        setLocalError(rawMsg || "Authentication could not be completed.");
        setRobotDialogue("⚠️ System alert: " + (rawMsg || "Connection error. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanName = regFullName.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanName) {
      setLocalError('Please provide your full name.');
      setRobotExpression('thinking');
      setRobotDialogue("What should I call you? Please enter your full name!");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please provide a valid work or academic email address.');
      setRobotExpression('thinking');
      setRobotDialogue("Please provide a valid email format for your new account.");
      return;
    }
    if (regPassword.length < 6) {
      setLocalError('Password must contain at least 6 characters.');
      setRobotExpression('wrong');
      setReactionType('wrong');
      setRobotDialogue("Password is too short! It needs at least 6 characters for security.");
      return;
    }

    try {
      setIsSubmitting(true);
      setRobotExpression('thinking');
      setRobotDialogue("Initializing your quantum profile and neural workspace...");

      await register(cleanEmail, regPassword, cleanName, regRole);

      // NEW USER REGISTRATION SUCCESS REACTION!
      setRobotExpression('celebrate');
      setReactionType('new_user');
      setCelebrateTrigger((prev) => prev + 1);
      setRobotDialogue(`🚀 Welcome to DataNova, ${cleanName}! Your Quantum account has been initialized!`);
    } catch (err: any) {
      setRobotExpression('wrong');
      setReactionType('wrong');
      setLocalError(err.message || "Registration failed.");
      setRobotDialogue("⚠️ Registration issue: " + (err.message || "Please check your information."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setDispatchedCodeNotice(null);
    clearAuthError();

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email address.');
      setRobotExpression('thinking');
      setRobotDialogue("Please provide a valid email format so I can dispatch your recovery code!");
      return;
    }

    try {
      setIsSubmitting(true);
      setRobotExpression('thinking');
      setRobotDialogue("Transmitting 6-digit security code to your email inbox...");

      const res = await api.forgotPassword(cleanEmail);

      setForgotStep('code');
      setRobotExpression('happy');
      setReactionType('normal');
      if (res.verification_code) {
        setDispatchedCodeNotice(`Verification code dispatched to ${cleanEmail}! (Security Token: ${res.verification_code})`);
        setForgotCode(res.verification_code);
      } else {
        setDispatchedCodeNotice(`Verification code dispatched to ${cleanEmail}! Please check your inbox.`);
      }
      setRobotDialogue(`📧 Security code sent to ${cleanEmail}! Enter the 6-digit code and your new password below.`);
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('no account') || errMsg.includes('not found')) {
        setRobotExpression('no_account');
        setReactionType('no_account');
        setLocalError(err.message || "No account found with this email.");
        setRobotDialogue(`🔍 I couldn't locate an account for "${cleanEmail}". Check the spelling or create an account!`);
      } else {
        setRobotExpression('wrong');
        setReactionType('wrong');
        setLocalError(err.message || "Failed to request password reset.");
        setRobotDialogue("⚠️ Transmission alert: " + (err.message || "Could not send verification code."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanCode = forgotCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setLocalError('Please enter the full 6-digit verification code.');
      setRobotExpression('wrong');
      setReactionType('wrong');
      setRobotDialogue("The verification code must be exactly 6 digits! Check your email.");
      return;
    }
    if (newPassword.length < 6) {
      setLocalError('New password must be at least 6 characters long.');
      setRobotExpression('wrong');
      setReactionType('wrong');
      setRobotDialogue("Password is too short! It requires at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      setRobotExpression('wrong');
      setReactionType('wrong');
      setRobotDialogue("Passwords don't match! Please ensure both password fields are identical.");
      return;
    }

    try {
      setIsSubmitting(true);
      setRobotExpression('thinking');
      setRobotDialogue("Updating encrypted credentials with cryptographic hash...");

      await api.resetPassword({
        email: forgotEmail.trim(),
        code: cleanCode,
        new_password: newPassword
      });

      // Reset success reaction
      setRobotExpression('celebrate');
      setReactionType('correct');
      setCelebrateTrigger((prev) => prev + 1);
      setResetSuccessMessage("Password successfully reset! Returning to Sign In in 2 seconds...");
      setRobotDialogue("🎉 Security cleared! Password updated successfully. Returning to Sign In so you can log in!");

      setEmail(forgotEmail.trim());
      setPassword('');
      setTimeout(() => {
        handleModeSwitch('login');
      }, 2000);
    } catch (err: any) {
      setRobotExpression('wrong');
      setReactionType('wrong');
      setLocalError(err.message || "Password reset failed.");
      setRobotDialogue("⚠️ Verification failed: " + (err.message || "Invalid or expired code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-400' };
    if (score === 2) return { score: 2, label: 'Medium', color: 'bg-amber-500 text-amber-400' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strength = getPasswordStrength(regPassword);

  const getReactionBadgeStyle = () => {
    switch (reactionType) {
      case 'correct':
        return 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
      case 'wrong':
        return 'border-rose-500/50 bg-rose-950/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-shake';
      case 'no_account':
        return 'border-amber-500/50 bg-amber-950/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]';
      case 'new_user':
        return 'border-cyan-400/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]';
      default:
        return 'border-cyan-500/30 bg-[#071329]/80 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050B17] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none font-sans text-slate-100">
      {/* Background Cybernetic Gradient Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[650px] h-[650px] bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[650px] h-[650px] bg-gradient-to-tl from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Col: 3D Nova Robot & Reactive Speech Bubble */}
        <div className="lg:col-span-6 flex flex-col items-center text-center lg:text-left space-y-4">
          
          {/* Brand Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-semibold shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <span>NOVA QUANTUM COMPANION</span>
          </div>

          {/* 3D Nova Robot Mascot */}
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] h-[260px] sm:h-[290px] flex items-center justify-center">
            {/* Ambient circular glow pedestal under Nova */}
            <div
              className={`absolute bottom-2 w-48 h-10 rounded-full blur-xl transition-all duration-500 pointer-events-none ${
                reactionType === 'correct'
                  ? 'bg-emerald-500/50 shadow-[0_0_40px_#10b981]'
                  : reactionType === 'wrong'
                  ? 'bg-rose-500/50 shadow-[0_0_40px_#f43f5e]'
                  : reactionType === 'no_account'
                  ? 'bg-amber-500/50 shadow-[0_0_40px_#f59e0b]'
                  : reactionType === 'new_user'
                  ? 'bg-cyan-400/60 shadow-[0_0_40px_#22d3ee]'
                  : 'bg-cyan-500/30 shadow-[0_0_30px_#06b6d4]'
              }`}
            />

            {/* Nova 3D Canvas */}
            <RobotGuide3D
              size="md"
              expression={robotExpression}
              celebrateTrigger={celebrateTrigger}
              onRobotClick={() => {
                setCelebrateTrigger((prev) => prev + 1);
                setRobotExpression('celebrate');
                setRobotDialogue("Teehee! I'm ready to analyze all your data! 🚀");
              }}
              className="w-full h-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] cursor-pointer"
            />
          </div>

          {/* Interactive Reactive Speech Bubble */}
          <div
            className={`w-full max-w-md p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 relative text-left ${getReactionBadgeStyle()}`}
          >
            {/* Little pointer triangle pointing up toward Nova */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-inherit border-t border-l border-inherit" />

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase">
                    {reactionType === 'correct' && '✅ Access Granted'}
                    {reactionType === 'wrong' && '⚠️ Password Mismatch'}
                    {reactionType === 'no_account' && '🔍 Account Not Found'}
                    {reactionType === 'new_user' && '👋 Welcome New User'}
                    {reactionType === 'normal' && '🤖 Nova AI Assistant'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">Live Reaction</span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-100">
                  {robotDialogue}
                </p>

                {/* Quick CTA button in bubble if no account is found */}
                {reactionType === 'no_account' && (
                  <div className="mt-2.5 pt-2 border-t border-amber-500/30">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('register')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Switch to Create Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Platform Info Pills */}
          <div className="hidden sm:flex items-center gap-3 pt-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              PBKDF2 Salted Encryption
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Sub-second Engine
            </span>
          </div>
        </div>

        {/* Right Col: Interactive Login / Register Form Card */}
        <div className="lg:col-span-6">
          <div className="relative rounded-3xl bg-[#081226]/95 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(6,182,212,0.15)] p-6 sm:p-8 overflow-hidden">
            {/* Ambient top light line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            {/* Header with Brand & Backend Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                    <span>DATOVA</span>
                    <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                      AI
                    </span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono">Quantum Intelligence Platform</p>
                </div>
              </div>

              {/* Live Backend Connection Indicator */}
              <div>
                {backendStatus === 'online' && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                    title="Backend FastAPI server is connected on Port 8000"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                    <span>Port 8000 Online</span>
                  </div>
                )}
                {backendStatus === 'offline' && (
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-mono hover:bg-rose-500/25 transition shadow-[0_0_10px_rgba(244,63,94,0.2)] cursor-pointer"
                    title="Backend not responding on Port 8000. Click to retry connection."
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shadow-[0_0_6px_#f43f5e]" />
                    <span>Backend Offline (Retry)</span>
                  </button>
                )}
                {backendStatus === 'checking' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-spin" />
                    <span>Checking Engine...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Offline Diagnostic Banner */}
            {backendStatus === 'offline' && (
              <div className="mb-5 p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/40 text-rose-200 text-xs shadow-lg shadow-rose-950/50">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-100 text-xs mb-1">Backend Server (Port 8000) is Offline</p>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed mb-2.5">
                      Your credentials cannot be verified because FastAPI is not running. Double-click <code className="bg-rose-900/60 px-1 py-0.5 rounded text-white font-mono text-[10px]">start_backend.bat</code> or <code className="bg-rose-900/60 px-1 py-0.5 rounded text-white font-mono text-[10px]">start_all.bat</code> in your project root.
                    </p>
                    <button
                      type="button"
                      onClick={checkBackendHealth}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1.5 transition shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Check Connection Again</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 bg-[#050C1B] rounded-2xl border border-slate-800/80 mb-6">
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-[0_2px_12px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch('register')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-[0_2px_12px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch('forgot')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  mode === 'forgot'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-[0_2px_12px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Success Notification Banner */}
            {resetSuccessMessage && (
              <div className="mb-5 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn shadow-md shadow-emerald-500/10">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div className="flex-1 font-medium">{resetSuccessMessage}</div>
              </div>
            )}

            {/* Dispatched Code Notice Banner */}
            {dispatchedCodeNotice && (
              <div className="mb-5 p-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs flex items-start gap-2.5 animate-fadeIn shadow-md shadow-cyan-500/10">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                <div className="flex-1 font-medium">{dispatchedCodeNotice}</div>
              </div>
            )}

            {/* Error Notification Banner */}
            {activeError && (
              <div
                className={`mb-5 p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                  reactionType === 'no_account'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{activeError}</div>
                <button
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className="text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Form: Sign In Mode */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Email (Username)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Required</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (reactionType !== 'normal') setReactionType('normal');
                    }}
                    placeholder="e.g. analyst@company.com"
                    autoComplete="username"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Password</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Case-sensitive</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (reactionType !== 'normal') setReactionType('normal');
                      }}
                      onFocus={handlePasswordFocus}
                      onBlur={handlePasswordBlur}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 pr-11 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#040A17] border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span>Remember this session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('forgot')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.4)] border border-cyan-300/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying with Nova...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to DataNova</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick 1-Click Demo Sign-In Profiles */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>1-Click Demo Profiles</span>
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">Pre-seeded & Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting || backendStatus === 'offline'}
                      onClick={() => handleQuickDemoLogin('demo@datanova.ai', 'datanova123', 'Senior AI Analyst')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-950/40 to-[#040E24] border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-900/40 text-left transition group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition flex items-center justify-between">
                        <span>Alex Chen</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-cyan-400" />
                      </div>
                      <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5">Senior AI Analyst</div>
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || backendStatus === 'offline'}
                      onClick={() => handleQuickDemoLogin('admin@datanova.ai', 'admin123', 'Enterprise Architect')}
                      className="p-2.5 rounded-xl bg-gradient-to-br from-purple-950/40 to-[#040E24] border border-purple-500/30 hover:border-purple-400 hover:bg-purple-900/40 text-left transition group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <div className="text-xs font-bold text-white group-hover:text-purple-300 transition flex items-center justify-between">
                        <span>Dr. Elena Vance</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-purple-400" />
                      </div>
                      <div className="text-[10px] text-purple-400/80 font-mono mt-0.5">Enterprise Architect</div>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Form: Register Mode */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Alex Chen"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Email Address (Username)</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@organization.com"
                    autoComplete="username"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Create Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 pr-11 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                      tabIndex={-1}
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {regPassword.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              strength.score === 1
                                ? 'w-1/3 bg-rose-500'
                                : strength.score === 2
                                ? 'w-2/3 bg-amber-500'
                                : 'w-full bg-emerald-400'
                            }`}
                          />
                        </div>
                        <span className={strength.color.split(' ')[1]}>{strength.label}</span>
                      </div>
                      <span className="text-slate-500">Salted PBKDF2</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {regRole === 'Student' ? (
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <span>Role / Specialization</span>
                    </span>
                    {regRole === 'Student' && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                        Academic Mode
                      </span>
                    )}
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegRole(val);
                      if (val === 'Student') {
                        setRobotExpression('new_user');
                        setReactionType('new_user');
                        setRobotDialogue("🎓 Welcome Student! DataNova is fully primed for your data science and analytics coursework!");
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-xs font-sans focus:outline-none focus:border-cyan-400 transition cursor-pointer"
                  >
                    <option value="Student">Student (Academic / Research)</option>
                    <option value="Senior AI Analyst">Senior AI Analyst</option>
                    <option value="Lead Data Scientist">Lead Data Scientist</option>
                    <option value="Enterprise Architect">Enterprise Architect</option>
                    <option value="Business Intelligence Lead">Business Intelligence Lead</option>
                    <option value="Executive / VP Analytics">Executive / VP Analytics</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.4)] border border-cyan-300/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering with Nova...</span>
                    </>
                  ) : (
                    <>
                      <span>Initialize Quantum Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Form: Forgot / Reset Password Mode */}
            {mode === 'forgot' && (
              <div className="space-y-4">
                {/* Step Indicators */}
                <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      forgotStep === 'email' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {forgotStep === 'code' ? '✓' : '1'}
                    </span>
                    <span className={`text-xs font-semibold ${forgotStep === 'email' ? 'text-white' : 'text-slate-400'}`}>
                      Request Code
                    </span>
                  </div>
                  <div className="h-[1px] w-8 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      forgotStep === 'code' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-slate-400'
                    }`}>
                      2
                    </span>
                    <span className={`text-xs font-semibold ${forgotStep === 'code' ? 'text-white' : 'text-slate-400'}`}>
                      Verify & Reset
                    </span>
                  </div>
                </div>

                {forgotStep === 'email' && (
                  <form onSubmit={handleRequestResetCode} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Account Email Address</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Will receive 6 digits</span>
                      </div>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          if (reactionType !== 'normal') setReactionType('normal');
                        }}
                        placeholder="e.g. analyst@company.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                      />
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enter your account email. Nova will verify your identity and dispatch a 6-digit cryptographic verification code to your inbox.
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.4)] border border-cyan-300/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Dispatching Security Code...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send 6-Digit Verification Code</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {forgotStep === 'code' && (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                          <span>6-Digit Security Code</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setForgotStep('email')}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Resend Code</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={forgotCode}
                        onChange={(e) => {
                          setForgotCode(e.target.value.replace(/\D/g, ''));
                          if (reactionType !== 'normal') setReactionType('normal');
                        }}
                        placeholder="123456"
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-cyan-500/50 text-cyan-300 text-center tracking-[0.4em] font-mono text-lg placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>New Password</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Min 6 chars</span>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (reactionType !== 'normal') setReactionType('normal');
                          }}
                          placeholder="••••••••••••"
                          disabled={isSubmitting}
                          className="w-full px-4 py-2.5 pr-11 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Confirm New Password</span>
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (reactionType !== 'normal') setReactionType('normal');
                        }}
                        placeholder="••••••••••••"
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition shadow-inner font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.4)] border border-cyan-300/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Updating Encrypted Credentials...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Update Password & Return to Sign In</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className="text-xs text-slate-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 mx-auto transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-400 font-mono">
              <span className="text-cyan-400">DataNova Quantum Engine v2.8</span> • Zero Telemetry Data Privacy
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
