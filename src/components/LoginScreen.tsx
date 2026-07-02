import { useState } from 'react';
import { FiShield, FiMonitor, FiUsers, FiLogIn, FiArrowRight, FiEye, FiEyeOff, FiCamera, FiMic, FiVideo, FiWifi, FiPlay, FiUser, FiAlertCircle, FiClock, FiClipboard } from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import type { UserRole } from '../store/types';
import { toPersianNum } from '../utils/persian';

export default function LoginScreen() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, addAlert } = useAppStore();

  const roles = [
    { role: 'admin' as UserRole, icon: <FiShield size={32} />, title: 'مدیر سامانه', desc: 'مدیریت کلاس‌ها و کاربران', color: 'from-purple-500 to-indigo-600' },
    { role: 'teacher' as UserRole, icon: <FiMonitor size={32} />, title: 'معلم', desc: 'برگزاری و مدیریت کلاس', color: 'from-cyan-500 to-blue-600' },
    { role: 'student' as UserRole, icon: <FiUsers size={32} />, title: 'دانش‌آموز', desc: 'ورود به کلاس آنلاین', color: 'from-emerald-500 to-teal-600' },
  ];

  const clearErrors = () => {
    setCodeError('');
    setPasswordError('');
    setScheduleError('');
    setGeneralError('');
  };

  const handleLogin = async () => {
    if (!selectedRole) return;
    if (!code.trim()) { setCodeError('لطفاً کد کلاس را وارد کنید'); return; }
    if (!password.trim()) { setPasswordError('لطفاً رمز عبور را وارد کنید'); return; }
    setLoading(true);
    clearErrors();
    const result = await login(selectedRole, code.trim(), password.trim());
    setLoading(false);
    if (!result.success) {
      const msg = result.error || 'خطا در ورود';
      if (result.field === 'code') {
        setCodeError(msg);
      } else if (result.field === 'password') {
        setPasswordError(msg);
      } else if (result.field === 'schedule') {
        setScheduleError(msg);
      } else {
        setGeneralError(msg);
      }
      addAlert({
        type: 'error',
        title: 'خطا در ورود',
        message: msg,
        duration: 5000,
        showTimer: true,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 🎬 MODERN VIDEO CLASSROOM ANIMATED BACKGROUND          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="login-animated-bg">

        {/* Glowing Grid */}
        <div className="glowing-grid" />

        {/* Scanning Line */}
        <div className="scan-line" />

        {/* Connection Lines SVG */}
        <svg className="connection-lines" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <line x1="10%" y1="20%" x2="40%" y2="50%" />
          <line x1="40%" y1="50%" x2="70%" y2="30%" />
          <line x1="70%" y1="30%" x2="90%" y2="60%" />
          <line x1="20%" y1="70%" x2="50%" y2="50%" />
          <line x1="50%" y1="50%" x2="80%" y2="80%" />
          <line x1="15%" y1="40%" x2="35%" y2="75%" />
          <line x1="60%" y1="15%" x2="85%" y2="40%" />
        </svg>

        {/* Floating Video Screens */}
        <div className="floating-screen screen-1">
          <div className="screen-avatar">
            <FiUser size={18} color="white" />
          </div>
        </div>
        <div className="floating-screen screen-2">
          <div className="screen-avatar">
            <FiUser size={14} color="white" />
          </div>
        </div>
        <div className="floating-screen screen-3">
          <div className="screen-avatar">
            <FiUser size={16} color="white" />
          </div>
        </div>
        <div className="floating-screen screen-4">
          <div className="screen-avatar">
            <FiUser size={12} color="white" />
          </div>
        </div>

        {/* Audio Waveforms */}
        <div className="audio-wave wave-1">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="audio-wave wave-2">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="audio-wave wave-3">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>

        {/* Floating Icons */}
        <div className="floating-icon icon-1">
          <FiCamera />
        </div>
        <div className="floating-icon icon-2">
          <FiMic />
        </div>
        <div className="floating-icon icon-3">
          <FiVideo />
        </div>
        <div className="floating-icon icon-4">
          <FiWifi />
        </div>
        <div className="floating-icon icon-5">
          <FiPlay />
        </div>
        <div className="floating-icon icon-6">
          <FiMonitor />
        </div>

        {/* Pulsing Connection Rings */}
        <div className="pulse-ring ring-1" />
        <div className="pulse-ring ring-2" />
        <div className="pulse-ring ring-3" />
        <div className="pulse-ring ring-4" />

        {/* Data Particles */}
        <div className="data-particle particle-1" />
        <div className="data-particle particle-2" />
        <div className="data-particle particle-3" />
        <div className="data-particle particle-4" />
        <div className="data-particle particle-5" />
        <div className="data-particle particle-6" />
        <div className="data-particle particle-7" />

        {/* Stream Indicators */}
        <div className="stream-indicator indicator-1">LIVE</div>
        <div className="stream-indicator indicator-2">REC</div>

      </div>
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="relative w-full max-w-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8 animate-float-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/25 mb-4 logo-glow">
            <FiMonitor size={36} className="text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">سامانه کلاس‌های آموزشی سبز</h1>
          <p className="text-white/40 text-xs">G-Online-Edu-App</p>
          <p className="text-white/30 text-xs mt-1">نسخه {toPersianNum('1.0.0')}</p>
        </div>

        {!selectedRole ? (
          /* Role Selection */
          <div className="space-y-4 animate-float-in">
            <p className="text-white/60 text-center text-sm mb-6">لطفاً نقش خود را انتخاب کنید</p>
            {roles.map(({ role, icon, title, desc, color }) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="w-full glass-btn rounded-2xl p-5 flex items-center gap-4 text-right group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{title}</h3>
                  <p className="text-white/50 text-sm">{desc}</p>
                </div>
                <FiArrowRight className="text-white/30 group-hover:text-white/70 transition-colors rotate-180" size={20} />
              </button>
            ))}
          </div>
        ) : (
          /* Login Form */
          <div className="glass rounded-3xl p-6 md:p-8 animate-float-in">
            <button
              onClick={() => { setSelectedRole(null); clearErrors(); setCode(''); setPassword(''); }}
              className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-6 text-sm"
            >
              <FiArrowRight size={16} />
              <span>بازگشت</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roles.find(r => r.role === selectedRole)?.color} flex items-center justify-center text-white`}>
                {roles.find(r => r.role === selectedRole)?.icon}
              </div>
              <div>
                <h3 className="text-white font-semibold">{roles.find(r => r.role === selectedRole)?.title}</h3>
                <p className="text-white/40 text-xs">{roles.find(r => r.role === selectedRole)?.desc}</p>
              </div>
            </div>

            {/* Schedule / general error banner */}
            {(scheduleError || generalError) && (
              <div className="glass-alert rounded-xl p-3 mb-4 border-amber-400/30 animate-float-in" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
                <p className="text-amber-300 text-sm flex items-start gap-2">
                  {scheduleError ? <FiClock size={16} className="mt-0.5 shrink-0" /> : <FiAlertCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{scheduleError || generalError}</span>
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* Code field */}
              <div>
                <label className="text-white/60 text-sm mb-2 block">
                  {selectedRole === 'admin' ? 'نام کاربری' : 'کد کلاس'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeError(''); setScheduleError(''); setGeneralError(''); }}
                    onPaste={(e) => { e.stopPropagation(); }}
                    placeholder={selectedRole === 'admin' ? 'نام کاربری مدیر' : 'مثال: CLS-A1B2C3'}
                    className={`glass-input w-full rounded-xl px-4 py-3 text-sm ${selectedRole !== 'admin' ? 'pl-10' : ''} ${codeError ? 'border-red-400/60' : ''}`}
                    dir="ltr"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {selectedRole !== 'admin' && (
                    <button
                      type="button"
                      title="چسباندن از کلیپ‌بورد"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setCode(text.trim());
                          setCodeError(''); setScheduleError(''); setGeneralError('');
                        } catch {}
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-cyan-400 transition-colors"
                    >
                      <FiClipboard size={16} />
                    </button>
                  )}
                </div>
                {codeError && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <FiAlertCircle size={12} />
                    {codeError}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label className="text-white/60 text-sm mb-2 block">رمز عبور</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setScheduleError(''); setGeneralError(''); }}
                    onPaste={(e) => { e.stopPropagation(); }}
                    placeholder="رمز عبور"
                    className={`glass-input w-full rounded-xl px-4 py-3 text-sm ${selectedRole !== 'admin' ? 'pl-20' : 'pl-12'} ${passwordError ? 'border-red-400/60' : ''}`}
                    dir="ltr"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {selectedRole !== 'admin' && (
                      <button
                        type="button"
                        title="چسباندن از کلیپ‌بورد"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setPassword(text.trim());
                            setPasswordError(''); setScheduleError(''); setGeneralError('');
                          } catch {}
                        }}
                        className="text-white/40 hover:text-cyan-400 transition-colors"
                      >
                        <FiClipboard size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <FiAlertCircle size={12} />
                    {passwordError}
                  </p>
                )}
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                {loading ? (
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                ) : <FiLogIn size={18} />}
                <span>{loading ? 'در حال اتصال...' : 'ورود به سامانه'}</span>
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
