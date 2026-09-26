import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Briefcase,
  KeyRound,
  Sparkles,
  Save,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../store/authContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_ROLES = [
  {
    id: 'Senior AI Analyst',
    label: 'Senior AI Analyst',
    category: 'Enterprise Intelligence',
    description: 'Autonomous multi-table exploration, forecasting, and automated executive reporting.'
  },
  {
    id: 'Lead Data Scientist',
    label: 'Lead Data Scientist',
    category: 'Machine Learning',
    description: 'AutoML pipeline engineering, hyperparameter tuning, and regression telemetry.'
  },
  {
    id: 'Student (Academic / Research)',
    label: 'Student (Academic / Research)',
    category: 'Academic',
    isAcademic: true,
    description: 'Coursework analysis, capstone research, student cohorts, and statistical discovery.'
  },
  {
    id: 'Financial & Risk Quantitative Analyst',
    label: 'Financial & Risk Quantitative Analyst',
    category: 'Quantitative Finance',
    description: 'Portfolio volatility, fraud detection heuristics, and deterministic solvency audit.'
  },
  {
    id: 'Operations & Supply Chain Lead',
    label: 'Operations & Supply Chain Lead',
    category: 'Logistics & Supply',
    description: 'Inventory turn rates, supplier lead-times, and demand pattern clustering.'
  },
  {
    id: 'Executive / Business Strategist',
    label: 'Executive / Business Strategist',
    category: 'Leadership',
    description: 'High-level KPI pulse, Pareto distribution, and strategic board presentations.'
  }
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<string>('Senior AI Analyst');

  // Password update state
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setRole(user.role || 'Senior AI Analyst');
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setErrorMessage('Full name cannot be empty.');
      return;
    }

    if (isChangingPassword) {
      if (!currentPassword) {
        setErrorMessage('Please enter your current password to authorize this security change.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirmation do not match.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await updateProfile({
        full_name: cleanName,
        role: role,
        ...(isChangingPassword
          ? {
              current_password: currentPassword,
              new_password: newPassword
            }
          : {})
      });

      setSuccessMessage('Profile and credentials successfully updated!');
      if (isChangingPassword) {
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
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

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[#081226]/95 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-500/20 text-sm">
              {user.full_name
                ?.split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>Account Profile & Security</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-start gap-2 animate-fadeIn shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* User Name */}
          <div>
            <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Chen"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-sans"
            />
          </div>

          {/* User Role Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                <span>Active Role / Analytical Persona</span>
              </label>
              {role.includes('Student') && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  Academic Mode
                </span>
              )}
            </div>

            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl bg-[#040A17] border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-sans cursor-pointer appearance-none"
              >
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#070F22] text-white">
                    {r.isAcademic ? `🎓 ${r.label}` : r.label} — ({r.category})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
              {AVAILABLE_ROLES.find((r) => r.id === role)?.description ||
                'Tailors Nova co-pilot and automated insights to your analytical scope.'}
            </p>
          </div>

          {/* Security & Password Change Toggle */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Account Password</span>
                </span>
                <p className="text-[11px] text-slate-400">Update your account authentication credentials</p>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                  isChangingPassword
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
              </button>
            </div>

            {/* Password Fields (Expandable) */}
            {isChangingPassword && (
              <div className="mt-4 p-4 rounded-2xl bg-[#050C1B] border border-slate-800/90 space-y-4 animate-fadeIn">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Current Password</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Verification</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required={isChangingPassword}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 rounded-xl bg-[#030712] border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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
                      required={isChangingPassword}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 rounded-xl bg-[#030712] border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 ${strength.score >= 1 ? strength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 ${strength.score >= 2 ? strength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 ${strength.score >= 3 ? strength.color : 'bg-transparent'}`} />
                      </div>
                      <span className={`text-[10px] font-bold font-mono ${strength.color.split(' ')[1]}`}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Confirm New Password</span>
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required={isChangingPassword}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 rounded-xl bg-[#030712] border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-3d-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile & Role</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
