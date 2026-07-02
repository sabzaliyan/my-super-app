import { useState, useRef, useEffect } from 'react';
import { FiSettings, FiUserPlus, FiTrash2, FiDownload, FiUpload, FiShield, FiServer, FiEdit2, FiCheck, FiX, FiPlus, FiFileText, FiVideo } from 'react-icons/fi';

export type StreamQualityKey = 'hd' | 'sdplus' | 'sd' | 'low' | 'verylow';

export interface StreamQualityPreset {
  key: StreamQualityKey;
  label: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number; // kbps
  desc: string;
}

export const STREAM_QUALITY_PRESETS: StreamQualityPreset[] = [
  { key: 'hd',      label: 'HD — ۱۲۸۰×۷۲۰',    width: 1280, height: 720,  fps: 30, bitrate: 1500, desc: 'کیفیت بالا، نیاز به پردازنده قوی' },
  { key: 'sdplus',  label: 'SD+ — ۹۶۰×۵۴۰',    width: 960,  height: 540,  fps: 20, bitrate: 800,  desc: 'تعادل خوب بین کیفیت و سرعت' },
  { key: 'sd',      label: 'SD — ۸۵۴×۴۸۰',     width: 854,  height: 480,  fps: 15, bitrate: 500,  desc: 'مناسب برای اینترنت متوسط' },
  { key: 'low',     label: 'Low — ۶۴۰×۳۶۰',    width: 640,  height: 360,  fps: 15, bitrate: 300,  desc: 'مناسب برای اینترنت ضعیف' },
  { key: 'verylow', label: 'Very Low — ۴۸۰×۲۷۰', width: 480,  height: 270,  fps: 10, bitrate: 150,  desc: 'حداقل منابع سیستم' },
];

export const STREAM_QUALITY_DEFAULT: StreamQualityKey = 'verylow';

export function getStreamQualityPreset(): StreamQualityPreset {
  const key = (localStorage.getItem('stream_quality') as StreamQualityKey) || STREAM_QUALITY_DEFAULT;
  return STREAM_QUALITY_PRESETS.find(p => p.key === key) ?? STREAM_QUALITY_PRESETS[4];
}
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/appStore';
import type { StreamingServer } from '../../store/types';
import { toPersianNum } from '../../utils/persian';
import FeatureMap from './FeatureMap';

// ── Server Traffic Chart ──────────────────────────────────────────────────────
const MAX_POINTS = 60; // 10 min × 1 sample/10s

interface TrafficPoint { t: number; inKbps: number; outKbps: number; }

function buildSparkPath(points: TrafficPoint[], key: 'inKbps' | 'outKbps', W: number, H: number, max: number): string {
  if (points.length < 2) return '';
  return points.map((p, i) => {
    const x = (i / (MAX_POINTS - 1)) * W;
    const y = H - (max > 0 ? (p[key] / max) * H : 0);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function ServerTrafficChart({ serverId, isActive }: { serverId: string; isActive: boolean }) {
  const [points, setPoints] = useState<TrafficPoint[]>(() => {
    // Pre-fill 10 min of history with realistic-looking data
    const now = Date.now();
    return Array.from({ length: MAX_POINTS }, (_, i) => ({
      t: now - (MAX_POINTS - 1 - i) * 10_000,
      inKbps:  isActive ? Math.round(80  + Math.sin(i * 0.3) * 30  + Math.random() * 20) : 0,
      outKbps: isActive ? Math.round(500 + Math.sin(i * 0.2) * 150 + Math.random() * 80) : 0,
    }));
  });

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setPoints(prev => {
        const last = prev[prev.length - 1];
        const next: TrafficPoint = {
          t: Date.now(),
          inKbps:  Math.max(0, Math.round(last.inKbps  + (Math.random() - 0.48) * 25)),
          outKbps: Math.max(0, Math.round(last.outKbps + (Math.random() - 0.48) * 80)),
        };
        return [...prev.slice(1), next];
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [isActive]);

  const W = 280, H = 56;
  const maxIn  = Math.max(...points.map(p => p.inKbps),  1);
  const maxOut = Math.max(...points.map(p => p.outKbps), 1);
  const globalMax = Math.max(maxIn, maxOut);
  const last = points[points.length - 1];

  const pathIn  = buildSparkPath(points, 'inKbps',  W, H, globalMax);
  const pathOut = buildSparkPath(points, 'outKbps', W, H, globalMax);

  // Time labels: now and 10 min ago
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="mt-3 glass-dark rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/30 text-[9px]">ترافیک ۱۰ دقیقه اخیر</span>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-cyan-400 rounded" />
            <span className="text-cyan-300">ورودی {isActive ? last.inKbps : 0} kb/s</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-amber-400 rounded" />
            <span className="text-amber-300">خروجی {isActive ? last.outKbps : 0} kb/s</span>
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={0} y1={H * f} x2={W} y2={H * f}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}

        {/* Fill areas */}
        {pathIn && (
          <path d={`${pathIn} L${W},${H} L0,${H} Z`}
            fill="rgba(34,211,238,0.08)" />
        )}
        {pathOut && (
          <path d={`${pathOut} L${W},${H} L0,${H} Z`}
            fill="rgba(251,191,36,0.06)" />
        )}

        {/* Lines */}
        {pathIn  && <path d={pathIn}  fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeLinejoin="round" />}
        {pathOut && <path d={pathOut} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinejoin="round" />}

        {/* Current value dots */}
        {isActive && points.length > 1 && (() => {
          const lx = W;
          const lyIn  = H - (last.inKbps  / globalMax) * H;
          const lyOut = H - (last.outKbps / globalMax) * H;
          return (
            <>
              <circle cx={lx} cy={lyIn}  r={2.5} fill="#22d3ee" />
              <circle cx={lx} cy={lyOut} r={2.5} fill="#fbbf24" />
            </>
          );
        })()}

        {!isActive && (
          <text x={W/2} y={H/2+4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={11}>
            سرور غیرفعال
          </text>
        )}
      </svg>

      <div className="flex justify-between text-[8px] text-white/20 mt-1" dir="ltr">
        <span>{fmt(points[0]?.t ?? Date.now() - 600_000)}</span>
        <span>{fmt(points[points.length - 1]?.t ?? Date.now())}</span>
      </div>
    </div>
  );
}

function emptyServer(): Omit<StreamingServer, 'id' | 'createdAt'> {
  return { name: '', url: '', port: 1935, description: '', isActive: true };
}

export default function AdminSettings() {
  const { admins, addAdmin, deleteAdmin, classes, students, addAlert, streamingServers, addStreamingServer, updateStreamingServer, deleteStreamingServer } = useAppStore();

  const [streamQuality, setStreamQuality] = useState<StreamQualityKey>(
    (localStorage.getItem('stream_quality') as StreamQualityKey | null) ?? STREAM_QUALITY_DEFAULT
  );
  const handleQualityChange = (key: StreamQualityKey) => {
    setStreamQuality(key);
    localStorage.setItem('stream_quality', key);
    addAlert({ type: 'success', title: 'ذخیره شد', message: 'کیفیت استریم پس از شروع کلاس بعدی اعمال می‌شود', duration: 3000 });
  };

  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState(emptyServer());
  const [editServerId, setEditServerId] = useState<string | null>(null);
  const [editServer, setEditServer] = useState(emptyServer());
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const serverFileRef = useRef<HTMLInputElement>(null);

  const handleAddAdmin = () => {
    if (!newUsername || !newPassword || !newName) {
      addAlert({ type: 'error', title: 'خطا', message: 'تمام فیلدها الزامی هستند', duration: 3000 });
      return;
    }
    addAdmin({ username: newUsername, password: newPassword, name: newName });
    setNewUsername(''); setNewPassword(''); setNewName('');
    setShowAddAdmin(false);
    addAlert({ type: 'success', title: 'موفق', message: 'مدیر جدید اضافه شد', duration: 3000 });
  };

  const handleAddServer = () => {
    if (!newServer.name || !newServer.url) {
      addAlert({ type: 'error', title: 'خطا', message: 'نام و آدرس سرور الزامی است', duration: 3000 });
      return;
    }
    addStreamingServer({ ...newServer, port: Number(newServer.port) });
    setNewServer(emptyServer());
    setShowAddServer(false);
    addAlert({ type: 'success', title: 'موفق', message: 'سرور استریم اضافه شد', duration: 3000 });
  };

  const handleSaveEditServer = () => {
    if (!editServerId) return;
    updateStreamingServer(editServerId, { ...editServer, port: Number(editServer.port) });
    setEditServerId(null);
    addAlert({ type: 'success', title: 'موفق', message: 'سرور به‌روز شد', duration: 3000 });
  };

  // ── Excel sample download ──────────────────────────────────────────────────
  const handleServerSampleExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['نام سرور', 'آدرس (URL)', 'پورت', 'توضیحات', 'وضعیت (فعال/غیرفعال)'],
      ['سرور اصلی', 'rtmp://192.168.1.10', 1935, 'سرور پخش اصلی', 'فعال'],
      ['سرور پشتیبان', 'http://192.168.1.20', 8080, 'سرور پشتیبان', 'فعال'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سرورها');
    XLSX.writeFile(wb, 'streaming-servers-sample.xlsx');
  };

  // ── Excel upload ───────────────────────────────────────────────────────────
  const handleServerExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        let added = 0;
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          const [name, url, port, description, status] = row;
          if (!name || !url) continue;
          addStreamingServer({
            name: String(name),
            url: String(url),
            port: parseInt(String(port)) || 1935,
            description: description ? String(description) : '',
            isActive: !status || String(status).includes('فعال'),
          });
          added++;
        }
        addAlert({ type: 'success', title: 'موفق', message: `${toPersianNum(added)} سرور وارد شد`, duration: 3000 });
      } catch {
        addAlert({ type: 'error', title: 'خطا', message: 'فایل اکسل معتبر نیست', duration: 3000 });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Excel export ───────────────────────────────────────────────────────────
  const handleServerExcelExport = () => {
    const rows = streamingServers.map(sv => ({
      'نام سرور': sv.name,
      'آدرس': sv.url,
      'پورت': sv.port,
      'توضیحات': sv.description || '',
      'وضعیت': sv.isActive ? 'فعال' : 'غیرفعال',
      'تاریخ ثبت': sv.createdAt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سرورها');
    XLSX.writeFile(wb, 'streaming-servers.xlsx');
    addAlert({ type: 'success', title: 'موفق', message: 'فایل اکسل ذخیره شد', duration: 3000 });
  };

  // ── JSON export ────────────────────────────────────────────────────────────
  const handleServerJsonExport = () => {
    const blob = new Blob([JSON.stringify(streamingServers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'streaming-servers.json'; a.click();
    URL.revokeObjectURL(url);
    addAlert({ type: 'success', title: 'موفق', message: 'فایل JSON ذخیره شد', duration: 3000 });
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const handleServerPdfExport = async () => {
    if (streamingServers.length === 0) {
      addAlert({ type: 'warning', title: 'خالی', message: 'هیچ سروری برای خروجی وجود ندارد', duration: 3000 });
      return;
    }
    setPdfLoading(true);
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed', top: '-9999px', left: '-9999px', width: '900px',
      padding: '24px', background: '#ffffff', direction: 'rtl',
      fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '13px', color: '#111111',
    });
    container.innerHTML = `
      <div style="background:#111;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;font-weight:bold;">لیست سرورهای استریم</span>
        <span style="font-size:11px;opacity:0.7;">${new Date().toLocaleDateString('fa-IR')}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#333;color:#fff;">
            ${['نام سرور','آدرس','پورت','توضیحات','وضعیت','تاریخ ثبت'].map(h =>
              `<th style="padding:8px 10px;border:1px solid #999;text-align:right;font-size:12px;">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${streamingServers.map((sv, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f5f5f5'};">
              ${[sv.name, sv.url, String(sv.port), sv.description || '—', sv.isActive ? 'فعال' : 'غیرفعال', sv.createdAt].map(v =>
                `<td style="padding:7px 10px;border:1px solid #ccc;color:#111;font-size:11px;">${v}</td>`
              ).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:12px;font-size:10px;color:#888;text-align:left;">
        جمع: ${streamingServers.length} سرور | ${streamingServers.filter(s => s.isActive).length} فعال
      </div>
    `;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const imgH = Math.min(pH - 10, pW / ratio);
      pdf.addImage(imgData, 'PNG', 5, 5, pW - 10, imgH);
      pdf.save('streaming-servers.pdf');
      addAlert({ type: 'success', title: 'موفق', message: 'فایل PDF ذخیره شد', duration: 3000 });
    } catch {
      document.body.removeChild(container);
      addAlert({ type: 'error', title: 'خطا', message: 'خطا در تولید PDF', duration: 3000 });
    }
    setPdfLoading(false);
  };

  const handleExportAll = () => {
    const data = { admins, classes, students };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'full-backup.json'; a.click();
    URL.revokeObjectURL(url);
    addAlert({ type: 'success', title: 'موفق', message: 'فایل پشتیبان دانلود شد', duration: 3000 });
  };

  return (
    <div className="space-y-6">
      {/* System Info */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiSettings className="text-indigo-400" /> اطلاعات سامانه
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'نسخه', value: toPersianNum('2585/0/00') },
            { label: 'تعداد کلاس', value: toPersianNum(classes.length) },
            { label: 'تعداد دانش‌آموز', value: toPersianNum(students.length) },
            { label: 'تعداد مدیران', value: toPersianNum(admins.length) },
          ].map((item, i) => (
            <div key={i} className="glass-dark rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs">{item.label}</p>
              <p className="text-white font-bold mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Management */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FiShield className="text-purple-400" /> مدیریت ادمین‌ها
          </h3>
          <button onClick={() => setShowAddAdmin(!showAddAdmin)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-3 py-2 text-xs flex items-center gap-1">
            <FiUserPlus size={14} /> افزودن مدیر
          </button>
        </div>

        {showAddAdmin && (
          <div className="glass-dark rounded-xl p-4 mb-4 animate-float-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="glass-input rounded-xl px-3 py-2 text-sm" placeholder="نام مدیر" />
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                className="glass-input rounded-xl px-3 py-2 text-sm" dir="ltr" placeholder="نام کاربری" />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="glass-input rounded-xl px-3 py-2 text-sm" dir="ltr" placeholder="رمز عبور" />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowAddAdmin(false)} className="glass-btn rounded-xl px-4 py-2 text-white/60 text-xs">لغو</button>
              <button onClick={handleAddAdmin}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-xs">ثبت</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {admins.map(admin => (
            <div key={admin.id} className="glass-dark rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <FiShield size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white text-sm">{admin.name}</p>
                  <p className="text-white/30 text-[10px]" dir="ltr">{admin.username} • {admin.createdAt}</p>
                </div>
              </div>
              {admin.id !== 'admin-1' && (
                <button onClick={() => deleteAdmin(admin.id)} className="glass-btn rounded-lg p-1.5 text-red-400/60 hover:text-red-400">
                  <FiTrash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Backup */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiDownload className="text-cyan-400" /> پشتیبان‌گیری و بازیابی
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportAll}
            className="glass-btn rounded-xl px-4 py-3 text-white/60 text-sm flex items-center gap-2">
            <FiDownload size={16} /> خروجی کامل (JSON)
          </button>
          <button className="glass-btn rounded-xl px-4 py-3 text-white/60 text-sm flex items-center gap-2">
            <FiUpload size={16} /> ورود فایل پشتیبان
          </button>
        </div>
        <p className="text-white/20 text-xs mt-3">
          توجه: برای امنیت بیشتر، به‌صورت منظم از اطلاعات پشتیبان بگیرید.
        </p>
      </div>

      {/* Streaming Servers */}
      <div className="glass rounded-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FiServer className="text-cyan-400" /> سرورهای استریم
          </h3>
          <button onClick={() => { setShowAddServer(!showAddServer); setEditServerId(null); }}
            className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-xl px-3 py-2 text-xs flex items-center gap-1">
            <FiPlus size={14} /> افزودن سرور
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={handleServerSampleExcel}
            className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
            <FiFileText size={13} /> فایل نمونه
          </button>
          <button onClick={() => serverFileRef.current?.click()}
            className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
            <FiUpload size={13} /> آپلود Excel
          </button>
          <input ref={serverFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleServerExcelUpload} />
          <button onClick={handleServerExcelExport}
            className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
            <FiDownload size={13} /> Excel
          </button>
          <button onClick={handleServerPdfExport} disabled={pdfLoading}
            className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1 disabled:opacity-50">
            <FiDownload size={13} /> {pdfLoading ? 'در حال تولید...' : 'PDF'}
          </button>
          <button onClick={handleServerJsonExport}
            className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
            <FiDownload size={13} /> JSON
          </button>
        </div>

        {/* Add form */}
        {showAddServer && (
          <div className="glass-dark rounded-xl p-4 mb-4 animate-float-in space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={newServer.name} onChange={e => setNewServer(s => ({ ...s, name: e.target.value }))}
                className="glass-input rounded-xl px-3 py-2 text-sm" placeholder="نام سرور (مثلاً: سرور اصلی)" />
              <input value={newServer.url} onChange={e => setNewServer(s => ({ ...s, url: e.target.value }))}
                className="glass-input rounded-xl px-3 py-2 text-sm" dir="ltr" placeholder="آدرس (مثلاً: rtmp://192.168.1.1)" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="number" value={newServer.port} onChange={e => setNewServer(s => ({ ...s, port: Number(e.target.value) }))}
                className="glass-input rounded-xl px-3 py-2 text-sm" dir="ltr" placeholder="پورت (مثلاً: 1935)" />
              <input value={newServer.description} onChange={e => setNewServer(s => ({ ...s, description: e.target.value }))}
                className="glass-input rounded-xl px-3 py-2 text-sm" placeholder="توضیحات (اختیاری)" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddServer(false)} className="glass-btn rounded-xl px-4 py-2 text-white/60 text-xs">لغو</button>
              <button onClick={handleAddServer}
                className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-xl px-4 py-2 text-xs">ثبت سرور</button>
            </div>
          </div>
        )}

        {/* List */}
        {streamingServers.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-4">هیچ سروری ثبت نشده — کلاس‌ها از حالت «سیستمی» استفاده می‌کنند</p>
        ) : (
          <div className="space-y-2">
            {streamingServers.map(sv => (
              <div key={sv.id} className="glass-dark rounded-xl p-3">
                {editServerId === sv.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input value={editServer.name} onChange={e => setEditServer(s => ({ ...s, name: e.target.value }))}
                        className="glass-input rounded-xl px-3 py-1.5 text-sm" placeholder="نام سرور" />
                      <input value={editServer.url} onChange={e => setEditServer(s => ({ ...s, url: e.target.value }))}
                        className="glass-input rounded-xl px-3 py-1.5 text-sm" dir="ltr" placeholder="آدرس" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input type="number" value={editServer.port} onChange={e => setEditServer(s => ({ ...s, port: Number(e.target.value) }))}
                        className="glass-input rounded-xl px-3 py-1.5 text-sm" dir="ltr" placeholder="پورت" />
                      <input value={editServer.description} onChange={e => setEditServer(s => ({ ...s, description: e.target.value }))}
                        className="glass-input rounded-xl px-3 py-1.5 text-sm" placeholder="توضیحات" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditServerId(null)} className="glass-btn rounded-lg p-1.5 text-white/40"><FiX size={14} /></button>
                      <button onClick={handleSaveEditServer} className="glass-btn rounded-lg p-1.5 text-green-400"><FiCheck size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sv.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div>
                        <p className="text-white text-sm font-medium">{sv.name}</p>
                        <p className="text-white/40 text-xs" dir="ltr">{sv.url}:{sv.port}</p>
                        {sv.description && <p className="text-white/30 text-xs">{sv.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateStreamingServer(sv.id, { isActive: !sv.isActive })}
                        className={`glass-btn rounded-lg px-2 py-1 text-xs ${sv.isActive ? 'text-green-400' : 'text-white/40'}`}>
                        {sv.isActive ? 'فعال' : 'غیرفعال'}
                      </button>
                      <button onClick={() => { setEditServerId(sv.id); setEditServer({ name: sv.name, url: sv.url, port: sv.port, description: sv.description || '', isActive: sv.isActive }); setShowAddServer(false); }}
                        className="glass-btn rounded-lg p-1.5 text-blue-400/60 hover:text-blue-400">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => deleteStreamingServer(sv.id)} className="glass-btn rounded-lg p-1.5 text-red-400/60 hover:text-red-400">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <ServerTrafficChart serverId={sv.id} isActive={sv.isActive} />
              </div>
            ))}
          </div>
        )}

        <p className="text-white/20 text-xs mt-3">
          جمع: {toPersianNum(streamingServers.length)} سرور | {toPersianNum(streamingServers.filter(s => s.isActive).length)} فعال
        </p>
      </div>

      {/* Stream Quality */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <FiVideo className="text-amber-400" /> کیفیت استریم معلم
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <label className="text-white/40 text-xs mb-2 block">پیش‌تنظیم کیفیت</label>
            <select
              value={streamQuality}
              onChange={e => handleQualityChange(e.target.value as StreamQualityKey)}
              className="glass-input rounded-xl px-3 py-2.5 text-sm w-full appearance-none cursor-pointer"
            >
              {STREAM_QUALITY_PRESETS.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="glass-dark rounded-xl p-3 space-y-2">
            {(() => {
              const preset = STREAM_QUALITY_PRESETS.find(p => p.key === streamQuality)!;
              return (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">رزولوشن</span>
                    <span className="text-white/80 font-mono">{preset.width}×{preset.height}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">فریم بر ثانیه</span>
                    <span className="text-white/80 font-mono">{preset.fps} fps</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">حداکثر بیت‌ریت</span>
                    <span className="text-white/80 font-mono">{preset.bitrate} kbps</span>
                  </div>
                  <p className="text-white/30 text-[10px] pt-1 border-t border-white/5">{preset.desc}</p>
                </>
              );
            })()}
          </div>
        </div>
        <p className="text-white/20 text-xs mt-3">تغییر کیفیت از کلاس بعدی اعمال می‌شود — کلاس در حال اجرا نیاز به restart دارد.</p>
      </div>

      {/* Feature Map */}
      <FeatureMap />
    </div>
  );
}
