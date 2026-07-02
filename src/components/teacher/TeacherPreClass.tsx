import { useState, useEffect, useRef } from 'react';
import { FiCamera, FiMic, FiVolume2, FiPlay, FiTrash2, FiGrid, FiLogOut, FiYoutube, FiMonitor, FiImage, FiFile, FiMusic, FiCalendar, FiUsers, FiClock, FiHash, FiServer, FiCheckCircle, FiAlertCircle, FiBarChart2, FiBookOpen, FiChevronDown } from 'react-icons/fi';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi, getPersianWeekDay, getPersianTime } from '../../utils/persian';
import type { ClassSession } from '../../store/types';

interface Props {
  classData: ClassSession;
}

export default function TeacherPreClass({ classData }: Props) {
  const { startClass, logout, addMediaItem, removeMediaItem, mediaItems, students, addAlert } = useAppStore();
  const [now, setNow] = useState(new Date());
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const videoFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // ── Device lists ──────────────────────────────────────────
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(() => localStorage.getItem('pref_camera') || '');
  const [selectedMic, setSelectedMic] = useState(() => localStorage.getItem('pref_mic') || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(() => localStorage.getItem('pref_speaker') || '');
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [speakerOk, setSpeakerOk] = useState(false);

  // ── Volume controls ───────────────────────────────────────
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);

  // ── Mic level meter ───────────────────────────────────────
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  // ── Enumerate devices after permission ───────────────────
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const spkrs = devices.filter(d => d.kind === 'audiooutput');
      setCameras(cams);
      setMics(microphones);
      setSpeakers(spkrs);
      const savedCam = localStorage.getItem('pref_camera');
      const savedMic = localStorage.getItem('pref_mic');
      const savedSpk = localStorage.getItem('pref_speaker');
      if (cams.length) setSelectedCamera(c => (savedCam && cams.find(d => d.deviceId === savedCam)) ? savedCam : c || cams[0].deviceId);
      if (microphones.length) setSelectedMic(c => (savedMic && microphones.find(d => d.deviceId === savedMic)) ? savedMic : c || microphones[0].deviceId);
      if (spkrs.length) setSelectedSpeaker(c => (savedSpk && spkrs.find(d => d.deviceId === savedSpk)) ? savedSpk : c || spkrs[0].deviceId);
    } catch {}
  };

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
  }, []);

  // ── Camera test ───────────────────────────────────────────
  const testCamera = async () => {
    try {
      if (camStreamRef.current) { camStreamRef.current.getTracks().forEach(t => t.stop()); }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
      });
      camStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      await enumerateDevices();
      setCameraOk(true);
      addAlert({ type: 'success', title: 'دوربین', message: 'دوربین با موفقیت تست شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'دسترسی به دوربین رد شد', duration: 3000 });
    }
  };

  // ── Mic test + level meter ────────────────────────────────
  const testMic = async () => {
    try {
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); cancelAnimationFrame(micRafRef.current); }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      micStreamRef.current = stream;
      await enumerateDevices();
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, Math.round(avg * 2.5)));
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicOk(true);
      addAlert({ type: 'success', title: 'میکروفون', message: 'میکروفون با موفقیت تست شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'دسترسی به میکروفون رد شد', duration: 3000 });
    }
  };

  // ── Speaker test ──────────────────────────────────────────
  const testSpeaker = async () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = speakerVolume / 100 * 0.3;
      osc.frequency.value = 880;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 600);
      setSpeakerOk(true);
      addAlert({ type: 'success', title: 'اسپیکر', message: 'صدای تست پخش شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'خطا در پخش صدا', duration: 3000 });
    }
  };

  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(micRafRef.current);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (countdownActive && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdownActive && countdown === 0) {
      startClass(classData.id);
    }
  }, [countdownActive, countdown, classData.id, startClass]);

  const classStudents = students.filter(s => classData.students.includes(s.id));
  const onlineCount = classStudents.filter(s => s.isOnline).length;

  const totalSessions = (classData.sessions || []).length;
  const usedHours = Math.round((classData.sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0) / 60 * 10) / 10;
  const remainingHours = Math.max(0, (classData.totalHours || 0) - usedHours);
  const usedPercent = classData.totalHours ? Math.min(100, Math.round(usedHours / classData.totalHours * 100)) : 0;

  const dayNames: Record<string, string> = {
    saturday: 'شنبه', sunday: 'یکشنبه', monday: 'دوشنبه',
    tuesday: 'سه‌شنبه', wednesday: 'چهارشنبه', thursday: 'پنجشنبه', friday: 'جمعه',
  };

  const handleStartClass = () => {
    setCountdownActive(true);
  };

  const handleAddYoutube = () => {
    if (!youtubeUrl.trim()) return;
    addMediaItem({ type: 'youtube', name: 'ویدیو یوتیوب', url: youtubeUrl, isActive: false });
    setYoutubeUrl('');
    setShowYoutubeInput(false);
    addAlert({ type: 'success', title: 'موفق', message: 'ویدیو یوتیوب اضافه شد', duration: 2000 });
  };

  const handleFileAdd = (type: 'video' | 'audio' | 'slideshow', files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const id = Math.random().toString(36).slice(2);
      setObjectUrls(prev => ({ ...prev, [id]: url }));
      addMediaItem({ type, name: file.name, url, isActive: false });
    });
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0` : url;
  };

  const mediaTypeLabel: Record<string, string> = {
    video: 'ویدیو', youtube: 'یوتیوب', audio: 'صوتی', slideshow: 'تصویر', whiteboard: 'وایت‌برد', screen: 'اشتراک صفحه',
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Bar 1 */}
      <div className="glass border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <FiMonitor size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">سامانه کلاس‌های آموزشی سبز</h1>
              <p className="text-white/30 text-[10px]">G-Online-Edu-App</p>
              <p className="text-white/20 text-[10px]">نسخه {toPersianNum('2585/0/00')}</p>
            </div>
          </div>

          <div className="glass-dark rounded-xl px-4 py-2 text-center">
            <p className="text-white font-semibold text-sm">پنل معلم • آماده‌سازی کلاس</p>
            <p className="text-white/40 text-xs">{classData.name} • {classData.courseName}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-white/60 text-xs">{toShamsi(now)}</p>
              <p className="text-white/40 text-[10px]">{getPersianWeekDay(now)}</p>
              <p className="text-white/50 text-xs">{getPersianTime(now)}</p>
            </div>
            <button onClick={logout} className="glass-btn rounded-lg p-2 text-red-400"><FiLogOut size={16} /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Class Info Dashboard */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <FiCalendar className="text-cyan-400" /> اطلاعات مهم کلاس
            </h2>

            {/* Row 1 — identity */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiBookOpen size={10} /> نام کلاس / درس</p>
                <p className="text-white text-sm font-bold mt-1">{classData.name}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiHash size={10} /> کد کلاس</p>
                <p className="text-cyan-300 text-sm font-mono font-bold mt-1 tracking-wider" dir="ltr">{classData.code}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiCalendar size={10} /> تاریخ برگزاری</p>
                <p className="text-white text-xs font-medium mt-1" dir="ltr">{classData.startDate} <span className="text-white/30 mx-1">←</span> {classData.endDate}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(classData.scheduleDays || []).map(d => (
                    <span key={d} className="text-[10px] bg-cyan-500/10 text-cyan-300 rounded px-1">{dayNames[d] || d}</span>
                  ))}
                </div>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiClock size={10} /> ساعت کلاس</p>
                <p className="text-white text-sm font-bold mt-1" dir="ltr">{classData.startTime} — {classData.endTime}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {classData.startTime && classData.endTime
                    ? `${toPersianNum(Math.round((
                        (parseInt(classData.endTime.split(':')[0]) * 60 + parseInt(classData.endTime.split(':')[1])) -
                        (parseInt(classData.startTime.split(':')[0]) * 60 + parseInt(classData.startTime.split(':')[1]))
                      )))} دقیقه`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Row 2 — students */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">ثبت‌نام‌شده</p>
                <p className="text-white text-xl font-bold leading-none">{toPersianNum(classStudents.length)}</p>
                <p className="text-white/30 text-xs mt-1">از {toPersianNum(classData.capacity || 0)}</p>
              </div>
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">آنلاین</p>
                <p className="text-green-400 text-xl font-bold leading-none">{toPersianNum(onlineCount)}</p>
                <div className="flex justify-center mt-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /></div>
              </div>
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">آفلاین</p>
                <p className="text-red-400 text-xl font-bold leading-none">{toPersianNum(classStudents.length - onlineCount)}</p>
                <div className="flex justify-center mt-1"><div className="w-2 h-2 rounded-full bg-red-400" /></div>
              </div>
            </div>

            {/* Row 3 — hours */}
            <div className="glass-dark rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/60 text-xs flex items-center gap-1"><FiBarChart2 size={12} /> ساعات کلاس</p>
                <p className="text-white/40 text-xs">{toPersianNum(usedHours)} از {toPersianNum(classData.totalHours || 0)} ساعت مصرف‌شده</p>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-white/40 text-[10px]">کل ساعات</p>
                  <p className="text-white text-lg font-bold">{toPersianNum(classData.totalHours || 0)}<span className="text-white/30 text-xs"> ساعت</span></p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">مصرف‌شده</p>
                  <p className="text-amber-400 text-lg font-bold">{toPersianNum(usedHours)}<span className="text-white/30 text-xs"> ساعت</span></p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">باقی‌مانده</p>
                  <p className={`text-lg font-bold ${remainingHours <= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {toPersianNum(remainingHours)}<span className="text-white/30 text-xs"> ساعت</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Row 4 — sessions + server */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-dark rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <FiClock size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-white/40 text-xs">جلسات برگزارشده</p>
                  <p className="text-white text-lg font-bold">{toPersianNum(totalSessions)}<span className="text-white/30 text-xs"> جلسه</span></p>
                </div>
              </div>
              <div className="glass-dark rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${classData.isActive ? 'bg-emerald-500/20' : 'bg-red-500/10'}`}>
                  {classData.isActive
                    ? <FiCheckCircle size={16} className="text-emerald-400" />
                    : <FiAlertCircle size={16} className="text-red-400" />}
                </div>
                <div>
                  <p className="text-white/40 text-xs">وضعیت کلاس</p>
                  <p className={`text-sm font-bold ${classData.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {classData.isActive ? 'فعال' : 'غیرفعال'}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning: low hours */}
            {remainingHours <= 2 && remainingHours > 0 && (
              <div className="mt-3 rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <FiAlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-red-300 text-xs">ساعات کلاس رو به اتمام است — تنها {toPersianNum(remainingHours)} ساعت باقی مانده</p>
              </div>
            )}
            {remainingHours === 0 && (
              <div className="mt-3 rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <FiAlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-red-300 text-xs font-bold">ساعات مجاز کلاس به پایان رسیده است</p>
              </div>
            )}
          </div>

          {/* Device Test */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <FiCamera className="text-emerald-400" /> تست دستگاه‌ها
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* ── Camera ── */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cameraOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiCamera size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">دوربین</span>
                  {cameraOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                {/* Device selector */}
                <div className="relative">
                  <select
                    value={selectedCamera}
                    onChange={e => { setSelectedCamera(e.target.value); localStorage.setItem('pref_camera', e.target.value); setCameraOk(false); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7"
                    dir="rtl"
                  >
                    {cameras.length === 0 && <option value="">دوربین یافت نشد</option>}
                    {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `دوربین ${cameras.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                {/* Camera preview */}
                <div className="rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16/9', width: '100%' }}>
                  <video ref={videoRef} muted playsInline
                    className={cameraOk ? '' : 'hidden'}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  {!cameraOk && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiCamera size={28} className="text-white/10" />
                    </div>
                  )}
                </div>
                <button onClick={testCamera}
                  className={`rounded-lg py-2 text-xs w-full transition-all ${cameraOk ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {cameraOk ? '✓ تست موفق — تست مجدد' : 'تست دوربین'}
                </button>
              </div>

              {/* ── Microphone ── */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${micOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiMic size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">میکروفون</span>
                  {micOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                {/* Device selector */}
                <div className="relative">
                  <select
                    value={selectedMic}
                    onChange={e => { setSelectedMic(e.target.value); localStorage.setItem('pref_mic', e.target.value); setMicOk(false); setMicLevel(0); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7"
                    dir="rtl"
                  >
                    {mics.length === 0 && <option value="">میکروفون یافت نشد</option>}
                    {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `میکروفون ${mics.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                {/* Level meter */}
                <div>
                  <p className="text-white/40 text-[10px] mb-1">سطح صدا</p>
                  <div className="flex gap-0.5 h-5 items-end">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const threshold = (i + 1) * 5;
                      const active = micLevel >= threshold;
                      const color = i < 12 ? 'bg-emerald-400' : i < 16 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <div key={i} className={`flex-1 rounded-sm transition-all duration-75 ${active ? color : 'bg-white/10'}`}
                          style={{ height: `${40 + i * 3}%` }} />
                      );
                    })}
                  </div>
                </div>
                {/* Volume slider */}
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-white/40 text-[10px]">حساسیت میکروفون</p>
                    <p className="text-white/60 text-[10px]">{toPersianNum(micVolume)}٪</p>
                  </div>
                  <input type="range" min={0} max={100} value={micVolume}
                    onChange={e => setMicVolume(+e.target.value)}
                    className="w-full h-1.5 rounded-full accent-emerald-400 cursor-pointer" />
                </div>
                <button onClick={testMic}
                  className={`rounded-lg py-2 text-xs w-full transition-all ${micOk ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {micOk ? '✓ تست موفق — تست مجدد' : 'تست میکروفون'}
                </button>
              </div>

              {/* ── Speaker ── */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${speakerOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiVolume2 size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">اسپیکر</span>
                  {speakerOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                {/* Device selector */}
                <div className="relative">
                  <select
                    value={selectedSpeaker}
                    onChange={e => { setSelectedSpeaker(e.target.value); localStorage.setItem('pref_speaker', e.target.value); setSpeakerOk(false); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7"
                    dir="rtl"
                  >
                    {speakers.length === 0 && <option value="">اسپیکر یافت نشد</option>}
                    {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `اسپیکر ${speakers.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                {/* Speaker visual */}
                <div className="flex items-center justify-center gap-1 h-16">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const h = [30, 55, 75, 100, 75, 55, 30][i];
                    return (
                      <div key={i}
                        className={`w-2 rounded-full transition-all ${speakerOk ? 'bg-emerald-400' : 'bg-white/15'}`}
                        style={{ height: `${h}%`, animationDelay: `${i * 80}ms`, animation: speakerOk ? 'pulse 0.8s ease-in-out infinite alternate' : 'none' }} />
                    );
                  })}
                </div>
                {/* Volume slider */}
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-white/40 text-[10px]">میزان صدای اسپیکر</p>
                    <p className="text-white/60 text-[10px]">{toPersianNum(speakerVolume)}٪</p>
                  </div>
                  <input type="range" min={0} max={100} value={speakerVolume}
                    onChange={e => setSpeakerVolume(+e.target.value)}
                    className="w-full h-1.5 rounded-full accent-cyan-400 cursor-pointer" />
                </div>
                <button onClick={testSpeaker}
                  className={`rounded-lg py-2 text-xs w-full transition-all ${speakerOk ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {speakerOk ? '✓ تست موفق — پخش مجدد' : 'تست اسپیکر'}
                </button>
              </div>

            </div>
          </div>

          {/* Pre-class Media */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <FiImage className="text-amber-400" /> محتوای از پیش آماده
              </h2>
              <span className="text-white/30 text-xs">{toPersianNum(mediaItems.length)} آیتم</span>
            </div>
            <p className="text-white/40 text-xs mb-4">فایل‌ها و محتوایی که قبل از شروع کلاس آماده می‌کنید، در تایل‌های کلاس نمایش داده می‌شوند</p>

            {/* Add buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                { label: 'افزودن ویدیو',  icon: <FiFile size={15} className="text-blue-400" />,   onClick: () => videoFileRef.current?.click(), active: false },
                { label: 'افزودن تصویر',  icon: <FiImage size={15} className="text-pink-400" />,  onClick: () => imageFileRef.current?.click(), active: false },
                { label: 'افزودن صوتی',   icon: <FiMusic size={15} className="text-purple-400" />, onClick: () => audioFileRef.current?.click(), active: false },
                { label: 'یوتیوب',        icon: <FiYoutube size={15} className="text-red-400" />,  onClick: () => setShowYoutubeInput(v => !v), active: showYoutubeInput },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  className={`glass-btn rounded-xl py-2.5 flex items-center justify-center gap-2 text-xs transition-all ${btn.active ? 'text-red-400 border-red-400/30' : 'text-white/60 hover:text-white'}`}>
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Hidden file inputs */}
            <input ref={videoFileRef} type="file" accept="video/*" multiple className="hidden"
              onChange={e => handleFileAdd('video', e.target.files)} />
            <input ref={audioFileRef} type="file" accept="audio/*" multiple className="hidden"
              onChange={e => handleFileAdd('audio', e.target.files)} />
            <input ref={imageFileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleFileAdd('slideshow', e.target.files)} />

            {/* YouTube URL input */}
            {showYoutubeInput && (
              <div className="flex gap-2 mb-4 animate-float-in">
                <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddYoutube()}
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-sm" dir="ltr" placeholder="https://youtube.com/watch?v=..." />
                <button onClick={handleAddYoutube}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl px-4 py-2 text-xs flex items-center gap-1">
                  <FiYoutube size={14} /> افزودن
                </button>
              </div>
            )}

            {/* Media List */}
            {mediaItems.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-sm">هنوز محتوایی اضافه نشده</div>
            ) : (
              <div className="space-y-2">
                {mediaItems.map(item => {
                  const iconMap: Record<string, JSX.Element> = {
                    video: <FiFile className="text-blue-400" />,
                    youtube: <FiYoutube className="text-red-400" />,
                    slideshow: <FiImage className="text-pink-400" />,
                    audio: <FiMusic className="text-purple-400" />,
                    whiteboard: <FiGrid className="text-amber-400" />,
                    screen: <FiMonitor className="text-cyan-400" />,
                  };
                  return (
                    <div key={item.id} className="glass-dark rounded-xl p-3 flex items-center gap-3">
                      {/* Type icon */}
                      <span className="text-lg shrink-0">{iconMap[item.type] || <FiFile />}</span>

                      {/* Name — editable on click */}
                      <div className="flex-1 min-w-0">
                        {editingNameId === item.id ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onBlur={() => {
                              if (editingName.trim()) {
                                // update name inline via store or just local state tweak
                                (item as any).name = editingName.trim();
                              }
                              setEditingNameId(null);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') { (item as any).name = editingName.trim(); setEditingNameId(null); } }}
                            className="glass-input w-full rounded-lg px-2 py-1 text-xs text-white"
                          />
                        ) : (
                          <button
                            className="text-white text-sm truncate max-w-full block text-right hover:text-cyan-300 transition-colors"
                            title="برای ویرایش نام کلیک کنید"
                            onClick={() => { setEditingNameId(item.id); setEditingName(item.name); }}
                          >
                            {item.name}
                          </button>
                        )}
                        <span className="text-white/30 text-[10px]">{mediaTypeLabel[item.type] || item.type}</span>
                      </div>

                      {/* Preview button */}
                      {(item.url || item.type === 'whiteboard') && (
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="glass-btn rounded-lg px-3 py-1.5 text-xs text-cyan-300 hover:text-white shrink-0 flex items-center gap-1"
                        >
                          <FiPlay size={12} /> پیش‌نمایش
                        </button>
                      )}

                      {/* Delete */}
                      <button onClick={() => {
                        if (objectUrls[item.id]) URL.revokeObjectURL(objectUrls[item.id]);
                        removeMediaItem(item.id);
                      }} className="text-red-400/50 hover:text-red-400 shrink-0">
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview Modal */}
          {previewItem && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.85)' }}
              onClick={() => setPreviewItem(null)}
            >
              <div
                className="glass rounded-2xl p-4 w-full max-w-2xl animate-float-in"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold">{previewItem.name}</h3>
                  <button onClick={() => setPreviewItem(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
                </div>

                {previewItem.type === 'video' && previewItem.url && (
                  <video src={previewItem.url} controls className="w-full rounded-xl max-h-96" />
                )}
                {previewItem.type === 'youtube' && previewItem.url && (
                  <iframe
                    src={getYoutubeEmbedUrl(previewItem.url)}
                    className="w-full rounded-xl"
                    style={{ height: '360px', border: 'none' }}
                    allowFullScreen
                  />
                )}
                {previewItem.type === 'audio' && previewItem.url && (
                  <div className="py-6 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <FiMusic size={36} className="text-purple-400" />
                    </div>
                    <audio src={previewItem.url} controls className="w-full" />
                  </div>
                )}
                {previewItem.type === 'slideshow' && previewItem.url && (
                  <img src={previewItem.url} alt={previewItem.name} className="w-full rounded-xl max-h-96 object-contain bg-black" />
                )}
                {previewItem.type === 'whiteboard' && (
                  previewItem.url && (previewItem.name?.endsWith('.pptx') || previewItem.name?.endsWith('.ppt') || previewItem.name?.endsWith('.odp'))
                    ? (
                      <div className="py-6 text-center space-y-3">
                        <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
                          <FiGrid size={36} className="text-amber-400" />
                        </div>
                        <p className="text-white text-sm">{previewItem.name}</p>
                        <p className="text-white/40 text-xs">پیش‌نمایش پاورپوینت در مرورگر پشتیبانی نمی‌شود</p>
                        <a href={previewItem.url} download={previewItem.name}
                          className="inline-flex items-center gap-2 glass-btn rounded-xl px-4 py-2 text-amber-300 text-sm">
                          <FiFile size={14} /> دانلود فایل
                        </a>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-white/40">
                        <FiGrid size={48} className="mx-auto mb-3 text-amber-400/40" />
                        <p>تخته وایت‌برد در حین کلاس فعال می‌شود</p>
                      </div>
                    )
                )}
              </div>
            </div>
          )}

          {/* Start Class Button */}
          <div className="text-center py-6">
            <button onClick={handleStartClass}
              className="bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-2xl px-12 py-4 text-lg font-bold flex items-center gap-3 mx-auto hover:shadow-2xl hover:shadow-emerald-500/25 transition-all hover:scale-105">
              <FiPlay size={24} />
              شروع کلاس
            </button>
          </div>
        </div>
      </div>

      {/* ── Fullscreen countdown overlay ── */}
      {countdownActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <p className="text-white/50 text-lg mb-6 tracking-widest uppercase">کلاس در حال شروع</p>
          <div className="relative w-48 h-48">
            <svg className="-rotate-90 w-48 h-48" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle cx="60" cy="60" r="54" fill="none" stroke="#10b981" strokeWidth="5"
                strokeDasharray="339.3"
                strokeDashoffset={339.3 * (countdown / 5)}
                strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold"
              style={{ fontSize: '5rem', lineHeight: 1 }}>
              {toPersianNum(countdown)}
            </span>
          </div>
          <p className="text-emerald-400 text-sm mt-6">{classData.name}</p>
        </div>
      )}
    </div>
  );
}
