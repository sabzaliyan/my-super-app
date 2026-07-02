import { useState, useRef, useEffect } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiUsers, FiEye, FiToggleLeft, FiToggleRight,
  FiDownload, FiUpload, FiCopy, FiCheck, FiX, FiCalendar, FiClock,
  FiRefreshCw, FiFileText, FiWifiOff, FiWifi, FiAlertCircle,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, generatePassword, toEnglishNum } from '../../utils/persian';
import type { ClassSession } from '../../store/types';
import { FiServer } from 'react-icons/fi';
import ClassStudents from './ClassStudents';
import ClassDetails from './ClassDetails';

// ── شمسی+ساعت → Date ──────────────────────────────────────────────────
function shamsiToDate(dateStr: string, timeStr: string): Date | null {
  try {
    const d = toEnglishNum(dateStr).replace(/[^0-9/]/g, '');
    const t = toEnglishNum(timeStr || '00:00').replace(/[^0-9:]/g, '');
    const [jY, jM, jD] = d.split('/').map(Number);
    const [h, m] = (t || '00:00').split(':').map(Number);
    if (!jY || !jM || !jD) return null;
    const gY = jY + 621;
    let days = 0;
    for (let i = 1; i < jM; i++) days += i <= 6 ? 31 : 30;
    days += jD - 1;
    return new Date(new Date(gY, 2, 20, h || 0, m || 0).getTime() + days * 86400000);
  } catch { return null; }
}

// ── Date → شمسی ───────────────────────────────────────────────────────
function dateToShamsi(date: Date): { dateStr: string; timeStr: string } {
  const gY = date.getFullYear(), gM = date.getMonth() + 1, gD = date.getDate();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const gDIM = [0,31,59,90,120,151,181,212,243,273,304,334];
  const gy2 = gM > 2 ? gY + 1 : gY;
  let days = 355666 + 365*gY + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) + gD + gDIM[gM-1];
  let jY = -1595 + 33*Math.floor(days/12053); days %= 12053;
  jY += 4*Math.floor(days/1461); days %= 1461;
  if (days > 365) { jY += Math.floor((days-1)/365); days = (days-1)%365; }
  let jM2: number, jD2: number;
  if (days < 186) { jM2 = 1+Math.floor(days/31); jD2 = 1+(days%31); }
  else { jM2 = 7+Math.floor((days-186)/30); jD2 = 1+((days-186)%30); }
  const ds = `${jY}/${String(jM2).padStart(2,'0')}/${String(jD2).padStart(2,'0')}`;
  return { dateStr: toPersianNum(ds), timeStr: toPersianNum(`${h}:${min}`) };
}

function todayTehranShamsi(): string {
  return dateToShamsi(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }))).dateStr;
}

function defaultForm() {
  const today = todayTehranShamsi();
  return {
    name: '', teacherName: '', teacherPassword: generatePassword(), courseName: '',
    startDate: today, startTime: toPersianNum('00:00'),
    endDate: today,  endTime: toPersianNum('14:00'),
    scheduleDays: [] as string[], capacity: 5, totalHours: 14, isActive: true,
    streamingServerId: null as string | null,
  };
}

const API_URL_CM = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';

async function buildPDF(title: string, headers: string[], rows: string[][], filename: string) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;padding:20px;font-family:Vazirmatn,Tahoma,Arial;direction:rtl;width:900px;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'color:#111;font-size:16px;font-weight:bold;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:6px;';
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.cssText = 'background:#222;color:#fff;padding:8px 10px;border:1px solid #999;text-align:right;';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.style.background = i % 2 === 0 ? '#fff' : '#f5f5f5';
    r.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.cssText = 'color:#111;padding:7px 10px;border:1px solid #ccc;text-align:right;';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, Math.min(h, pdf.internal.pageSize.getHeight()));
    pdf.save(`${filename}.pdf`);
  } finally { document.body.removeChild(wrapper); }
}

export default function ClassManagement() {
  const { classes, addClass, updateClass, deleteClass, toggleClassActive, students, addAlert, streamingServers, authToken } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [viewStudentsClass, setViewStudentsClass] = useState<string | null>(null);
  const [viewDetailsClass, setViewDetailsClass] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportingClass, setExportingClass] = useState<string | null>(null);

  const exportClassReport = async (cls: ClassSession, format: 'json' | 'excel' | 'pdf') => {
    setExportingClass(cls.id + format);
    try {
      const classStudents = students.filter(s => (cls.students || []).includes(s.id));
      // Fetch session history and online students from API
      const [sessRes, onlineRes] = await Promise.all([
        fetch(`${API_URL_CM}/api/features/session-history`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_URL_CM}/api/features/live-classes/${cls.id}/students`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const allSessions: any[] = await sessRes.json();
      const onlineStudents: any[] = await onlineRes.json().catch(() => []);
      const sessions = allSessions.filter((s: any) => s.class_id === cls.id);

      const fmtDate = (v: any) => { try { return new Date(v).toLocaleDateString('fa-IR'); } catch { return String(v || '—').slice(0,10); } };
      const fmtTime = (v: any) => { try { return new Date(v).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit' }); } catch { return String(v || '—').slice(0,5); } };

      if (format === 'json') {
        const data = {
          class: { name: cls.name, teacher: cls.teacherName, course: cls.courseName, code: cls.code },
          students: classStudents.map(s => ({ name: s.name, desc: s.description, isOnline: s.isOnline })),
          onlineNow: onlineStudents.map(s => ({ name: s.name, since: fmtTime(s.start_time) })),
          sessions: sessions.map(s => ({ date: fmtDate(s.date), start: fmtTime(s.start_time), end: fmtTime(s.end_time) })),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `class-${cls.code}-report.json`; a.click();

      } else if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        // Sheet 1: students
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['نام', 'توضیحات', 'وضعیت'],
          ...classStudents.map(s => [s.name, s.description || '', s.isOnline ? 'آنلاین' : 'آفلاین']),
        ]), 'دانش‌آموزان');
        // Sheet 2: online now
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['نام', 'ساعت ورود', 'تاریخ'],
          ...onlineStudents.map(s => [s.name, fmtTime(s.start_time), fmtDate(s.date)]),
        ]), 'آنلاین اکنون');
        // Sheet 3: sessions
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['تاریخ', 'شروع', 'پایان'],
          ...sessions.map(s => [fmtDate(s.date), fmtTime(s.start_time), fmtTime(s.end_time)]),
        ]), 'جلسات برگزار شده');
        XLSX.writeFile(wb, `class-${cls.code}-report.xlsx`);

      } else {
        // PDF — two sections
        const stuRows = classStudents.map(s => [s.name, s.description || '', s.isOnline ? 'آنلاین' : 'آفلاین']);
        const sesRows = sessions.map(s => [fmtDate(s.date), fmtTime(s.start_time), fmtTime(s.end_time)]);
        const onRows = onlineStudents.map(s => [s.name, fmtTime(s.start_time), fmtDate(s.date)]);
        await buildPDF(
          `گزارش کلاس: ${cls.name} (${cls.code})`,
          ['نام دانش‌آموز', 'توضیحات', 'وضعیت'],
          stuRows,
          `class-${cls.code}-students`
        );
        if (sesRows.length) await buildPDF(`جلسات برگزار شده: ${cls.name}`, ['تاریخ', 'شروع', 'پایان'], sesRows, `class-${cls.code}-sessions`);
        if (onRows.length) await buildPDF(`آنلاین اکنون: ${cls.name}`, ['نام', 'ورود', 'تاریخ'], onRows, `class-${cls.code}-online`);
      }
    } catch { addAlert({ type: 'error', title: 'خطا', message: 'خروجی‌گیری ناموفق بود', duration: 3000 }); }
    setExportingClass(null);
  };

  // Poll live status every 5 seconds and update classes in store
  useEffect(() => {
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
    const refresh = async () => {
      try {
        const res = await fetch(`${API_URL}/api/classes`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) useAppStore.setState({ classes: data });
      } catch {}
    };
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [authToken]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  const resetForm = () => { setForm(defaultForm()); setEditingClass(null); };

  function calcHours(sd: string, st: string, ed: string, et: string, fallback: number): number {
    const s = shamsiToDate(sd, st), e = shamsiToDate(ed, et);
    if (s && e && e > s) return Math.round((e.getTime() - s.getTime()) / 3600000 * 10) / 10;
    return fallback;
  }

  const handleSubmit = () => {
    if (!form.name || !form.teacherName || !form.courseName) {
      addAlert({ type: 'error', title: 'خطا', message: 'لطفاً فیلدهای ضروری را پر کنید', duration: 3000, showTimer: true });
      return;
    }
    if (editingClass) {
      updateClass(editingClass.id, { ...form, students: editingClass.students });
      addAlert({ type: 'success', title: 'موفق', message: 'کلاس بروزرسانی شد', duration: 3000 });
    } else {
      addClass({ ...form, teacherPassword: form.teacherPassword || generatePassword(), students: [] });
      addAlert({ type: 'success', title: 'موفق', message: 'کلاس جدید ایجاد شد', duration: 3000 });
    }
    setShowForm(false); resetForm();
  };

  const handleEdit = (cls: ClassSession) => {
    setForm({
      name: cls.name || '', teacherName: cls.teacherName || '',
      teacherPassword: cls.teacherPassword || generatePassword(),
      courseName: cls.courseName || '', startDate: cls.startDate || '',
      startTime: cls.startTime || '', endDate: cls.endDate || '',
      endTime: cls.endTime || '', scheduleDays: cls.scheduleDays || [],
      capacity: cls.capacity || 5, totalHours: cls.totalHours || 0, isActive: cls.isActive ?? true,
      streamingServerId: cls.streamingServerId || null,
    });
    setEditingClass(cls); setShowForm(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDelete = (cls: ClassSession) => {
    deleteClass(cls.id);
    addAlert({ type: 'warning', title: 'حذف شد', message: `کلاس "${cls.name}" حذف شد`, duration: 3000 });
  };

  // ── Export JSON ──────────────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(classes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `classes-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export Excel ─────────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = classes.map(c => ({
      'کد': c.code,
      'نام کلاس': c.name,
      'معلم': c.teacherName,
      'رمز معلم': c.teacherPassword,
      'درس': c.courseName,
      'تاریخ شروع': c.startDate,
      'ساعت شروع': c.startTime,
      'تاریخ پایان': c.endDate,
      'ساعت پایان': c.endTime,
      'روزها': (c.scheduleDays || []).join('،'),
      'ظرفیت': c.capacity,
      'ساعت کل': c.totalHours,
      'وضعیت': c.isActive ? 'فعال' : 'غیرفعال',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [8,14,14,12,12,14,10,14,10,18,8,8,8].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کلاس‌ها');
    XLSX.writeFile(wb, `classes-${Date.now()}.xlsx`);
  };

  // ── Export PDF (html2canvas با inline style) ─────────────────────────
  const exportPDF = async () => {
    setPdfLoading(true);
    try {
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed', top: '-9999px', left: '-9999px', width: '1050px',
        padding: '28px', background: '#ffffff', direction: 'rtl',
        fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '12px', color: '#111',
      });
      const title = document.createElement('div');
      Object.assign(title.style, { textAlign: 'center', marginBottom: '4px', fontSize: '15px', fontWeight: 'bold' });
      title.textContent = 'G-Online-Edu-App — لیست کلاس‌های آموزشی';
      const sub = document.createElement('div');
      Object.assign(sub.style, { textAlign: 'center', marginBottom: '16px', fontSize: '10px', color: '#555' });
      sub.textContent = `تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}  |  تعداد کلاس: ${classes.length}`;
      const hr = document.createElement('hr');
      Object.assign(hr.style, { border: 'none', borderTop: '2px solid #111', marginBottom: '14px' });
      container.appendChild(title); container.appendChild(sub); container.appendChild(hr);
      const table = document.createElement('table');
      Object.assign(table.style, { width: '100%', borderCollapse: 'collapse' });
      const thead = document.createElement('thead');
      ['کد','نام کلاس','معلم','درس','تاریخ شروع','تاریخ پایان','ظرفیت','ساعت کل','وضعیت'].forEach(h => {
        const th = document.createElement('th');
        Object.assign(th.style, { background: '#111', color: '#fff', padding: '7px 10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #111', fontSize: '11px' });
        th.textContent = h; thead.appendChild(th);
      });
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      classes.forEach((c, i) => {
        const tr = document.createElement('tr');
        tr.style.background = i % 2 === 0 ? '#fff' : '#f5f5f5';
        [c.code, c.name, c.teacherName, c.courseName, c.startDate, c.endDate, String(c.capacity), String(c.totalHours), c.isActive ? 'فعال' : 'غیرفعال'].forEach(v => {
          const td = document.createElement('td');
          Object.assign(td.style, { padding: '7px 10px', border: '1px solid #ccc', color: '#111', direction: 'ltr', textAlign: 'right', fontSize: '11px' });
          td.textContent = v || '—'; tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); container.appendChild(table);
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { backgroundColor: '#fff', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);
      const img = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      const imgW = pw - 20;
      doc.addImage(img, 'PNG', 10, 10, imgW, Math.min(imgW * (canvas.height / canvas.width), ph - 20));
      doc.save(`classes-${Date.now()}.pdf`);
    } finally { setPdfLoading(false); }
  };

  // ── دانلود نمونه Excel ───────────────────────────────────────────────
  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['نام کلاس','نام معلم','رمز معلم','نام درس','تاریخ شروع','ساعت شروع','تاریخ پایان','ساعت پایان','ظرفیت','ساعت کل','روزها'],
      ['ریاضی دهم','استاد رضایی','pass123','ریاضی','1405/04/01','08:00','1405/06/30','10:00','20','80','شنبه،یکشنبه'],
      ['فیزیک یازدهم','استاد احمدی','abc456','فیزیک','1405/04/01','10:00','1405/06/30','12:00','15','60','دوشنبه'],
    ]);
    ws['!cols'] = [14,14,10,12,12,8,12,8,8,8,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
    XLSX.writeFile(wb, 'sample-classes.xlsx');
  };

  // ── آپلود Excel ──────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportError(''); setImportSuccess(''); setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      const data = rows.slice(1).filter(r => r[0] && r[1]);
      if (!data.length) { setImportError('هیچ ردیف معتبری یافت نشد'); setImporting(false); return; }
      let added = 0;
      for (const row of data) {
        const [name, teacherName, teacherPassword, courseName, startDate, startTime, endDate, endTime, capacity, totalHours, daysRaw] = row;
        const scheduleDays = daysRaw ? String(daysRaw).split(/[،,]/).map(d => d.trim()).filter(Boolean) : [];
        try {
          await addClass({
            name: String(name), teacherName: String(teacherName),
            teacherPassword: String(teacherPassword || generatePassword()),
            courseName: String(courseName),
            startDate: String(startDate || ''), startTime: String(startTime || ''),
            endDate: String(endDate || ''), endTime: String(endTime || ''),
            scheduleDays, capacity: parseInt(String(capacity)) || 5,
            totalHours: parseInt(String(totalHours)) || 0,
            isActive: true, students: [],
          });
          added++;
        } catch {}
      }
      setImportSuccess(`${toPersianNum(added)} کلاس افزوده شد`);
    } catch { setImportError('فایل قابل خواندن نیست'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (viewStudentsClass) return <ClassStudents classId={viewStudentsClass} onBack={() => setViewStudentsClass(null)} />;
  if (viewDetailsClass) return <ClassDetails classId={viewDetailsClass} onBack={() => setViewDetailsClass(null)} />;

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <FiCalendar className="text-indigo-400" />
          مدیریت کلاس‌ها
          <span className="text-white/30 text-sm">({toPersianNum(classes.length)} کلاس)</span>
          {classes.filter(c => c.isLive).length > 0 && (
            <span className="flex items-center gap-1 bg-green-500/20 border border-green-400/30 rounded-full px-2.5 py-0.5 text-[10px] text-green-400 font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {toPersianNum(classes.filter(c => c.isLive).length)} کلاس زنده
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          {/* نمونه Excel */}
          <button onClick={downloadSample} className="glass-btn rounded-xl px-3 py-2 text-emerald-300 hover:bg-emerald-500/20 text-xs flex items-center gap-1.5 transition-colors">
            <FiDownload size={13} /> فایل نمونه
          </button>
          {/* آپلود Excel */}
          <label className={`glass-btn rounded-xl px-3 py-2 text-blue-300 hover:bg-blue-500/20 text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" /> : <FiUpload size={13} />}
            آپلود Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          {importError && <span className="text-red-400 text-xs flex items-center gap-1"><FiAlertCircle size={11} />{importError}</span>}
          {importSuccess && <span className="text-emerald-400 text-xs flex items-center gap-1"><FiCheck size={11} />{importSuccess}</span>}
          {/* خروجی */}
          <button onClick={exportExcel} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1.5 hover:text-emerald-300 transition-colors">
            <FiDownload size={13} /> Excel
          </button>
          <button onClick={exportPDF} disabled={pdfLoading} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1.5 hover:text-rose-300 transition-colors disabled:opacity-50">
            {pdfLoading ? <span className="w-3 h-3 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" /> : <FiFileText size={13} />} PDF
          </button>
          <button onClick={exportJSON} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1.5 hover:text-amber-300 transition-colors">
            <FiDownload size={13} /> JSON
          </button>
          {/* کلاس جدید */}
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
            <FiPlus size={16} /> کلاس جدید
          </button>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">{editingClass ? 'ویرایش کلاس' : 'ایجاد کلاس جدید'}</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-white/40 hover:text-white/80"><FiX size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">نام کلاس <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="مثال: ریاضی پایه دهم" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نام معلم <span className="text-red-400">*</span></label>
              <input value={form.teacherName} onChange={e => setForm(f => ({ ...f, teacherName: e.target.value }))}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="نام و نام خانوادگی" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رمز معلم</label>
              <div className="flex gap-2">
                <input value={form.teacherPassword} onChange={e => setForm(f => ({ ...f, teacherPassword: e.target.value }))}
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-sm" dir="ltr" />
                <button type="button" onClick={() => setForm(f => ({ ...f, teacherPassword: generatePassword() }))}
                  className="glass-btn text-indigo-300 hover:bg-indigo-500/20 rounded-xl px-3 transition-colors" title="تولید رمز جدید">
                  <FiRefreshCw size={15} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نام درس <span className="text-red-400">*</span></label>
              <input value={form.courseName} onChange={e => setForm(f => ({ ...f, courseName: e.target.value }))}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="نام درس" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">تاریخ شروع</label>
              <input value={form.startDate}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, startDate: v, totalHours: calcHours(v, f.startTime, f.endDate, f.endTime, f.totalHours) })); }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="۱۴۰۴/۰۴/۰۱" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">ساعت شروع</label>
              <input value={form.startTime}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, startTime: v, totalHours: calcHours(f.startDate, v, f.endDate, f.endTime, f.totalHours) })); }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="۰۰:۰۰" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">تاریخ پایان</label>
              <input value={form.endDate}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, endDate: v, totalHours: calcHours(f.startDate, f.startTime, v, f.endTime, f.totalHours) })); }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="۱۴۰۴/۰۶/۳۱" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">ساعت پایان</label>
              <input value={form.endTime}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, endTime: v, totalHours: calcHours(f.startDate, f.startTime, f.endDate, v, f.totalHours) })); }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="۱۴:۰۰" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">ظرفیت</label>
              <input value={toPersianNum(form.capacity)}
                onChange={e => setForm(f => ({ ...f, capacity: parseInt(toEnglishNum(e.target.value)) || 0 }))}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" placeholder="۵" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block flex items-center gap-2">
                ساعت کل
                {form.startDate && form.endDate && <span className="text-indigo-400 text-[10px]">● خودکار</span>}
              </label>
              <input value={form.totalHours > 0 ? toPersianNum(form.totalHours) : ''}
                placeholder="خودکار محاسبه می‌شود"
                onChange={e => {
                  const totalHours = parseFloat(toEnglishNum(e.target.value)) || 0;
                  setForm(f => {
                    const start = shamsiToDate(f.startDate, f.startTime);
                    if (start && totalHours > 0) {
                      const { dateStr, timeStr } = dateToShamsi(new Date(start.getTime() + totalHours * 3600000));
                      return { ...f, totalHours, endDate: dateStr, endTime: timeStr };
                    }
                    return { ...f, totalHours };
                  });
                }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-white/50 text-xs mb-2 block">روزهای برگزاری</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map(day => (
                  <button key={day} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      scheduleDays: f.scheduleDays.includes(day)
                        ? f.scheduleDays.filter(d => d !== day)
                        : [...f.scheduleDays, day]
                    }))}
                    className={`rounded-lg px-3 py-1.5 text-xs transition-all ${form.scheduleDays.includes(day) ? 'bg-indigo-500 text-white' : 'glass-btn text-white/50'}`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Streaming Server Select */}
          <div className="mt-4">
            <label className="text-white/50 text-xs mb-1 flex items-center gap-1"><FiServer size={12} /> سرور استریم</label>
            <select
              value={form.streamingServerId || ''}
              onChange={e => setForm(f => ({ ...f, streamingServerId: e.target.value || null }))}
              className="glass-input w-full rounded-xl px-3 py-2 text-sm"
            >
              <option value="">سیستمی (انتخاب خودکار)</option>
              {streamingServers.filter(sv => sv.isActive).map(sv => (
                <option key={sv.id} value={sv.id}>{sv.name} — {sv.url}:{sv.port}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-between items-center mt-4">
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all ${form.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'glass-btn text-white/40 border border-white/10'}`}>
              {form.isActive ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
              {form.isActive ? 'کلاس فعال است' : 'کلاس غیرفعال است'}
            </button>
            <div className="flex gap-3">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="glass-btn rounded-xl px-6 py-2 text-white/60 text-sm">انصراف</button>
              <button onClick={handleSubmit} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-6 py-2 text-sm hover:shadow-lg transition-all">
                {editingClass ? 'بروزرسانی' : 'ایجاد کلاس'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Classes List ─────────────────────────────────────────────── */}
      <div ref={listRef} className="grid gap-4">
        {classes.map(cls => {
          const classStudents = students.filter(s => cls.students?.includes(s.id));
          const usedHours = cls.usedHours || 0;
          const totalHours = cls.totalHours || 0;
          const remainingHours = Math.max(0, totalHours - usedHours);
          const sessionCount = (cls.sessionHistory || []).length;
          const days = cls.scheduleDays || [];

          return (
            <div key={cls.id} className="glass rounded-2xl p-4 hover:bg-white/[0.06] transition-all">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Info */}
                <div className="flex flex-col gap-1 min-w-0">
                  {/* خط ۱: کد کلاس + رمز */}
                  <div className="flex items-center gap-2">
                    {cls.isLive && (
                      <span className="flex items-center gap-1 bg-green-500/20 border border-green-400/30 rounded-full px-2 py-0.5 text-[9px] text-green-400 font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> زنده
                      </span>
                    )}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                    <button onClick={() => handleCopyCode(cls.code)}
                      className="flex items-center gap-1 glass-btn rounded-lg px-2 py-0.5 text-[10px] text-indigo-300">
                      {copiedCode === cls.code ? <FiCheck size={10} /> : <FiCopy size={10} />}
                      <span dir="ltr">{cls.code}</span>
                    </button>
                    <button onClick={() => handleCopyCode(cls.teacherPassword)}
                      className="flex items-center gap-1 glass-btn rounded-lg px-2 py-0.5 text-[10px] text-amber-300/70">
                      {copiedCode === cls.teacherPassword ? <FiCheck size={10} /> : <FiCopy size={10} />}
                      <span dir="ltr">{cls.teacherPassword}</span>
                    </button>
                  </div>
                  {/* خط ۲: نام کلاس */}
                  <h3 className="text-white font-semibold text-sm pr-4">{cls.name}</h3>
                </div>

                {/* Stats */}
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  {/* دانش‌آموز */}
                  <div className="glass-dark rounded-xl px-3 py-2 text-center min-w-[56px]">
                    <div className="text-white font-bold text-sm">{toPersianNum(classStudents.length)}/{toPersianNum(cls.capacity)}</div>
                    <div className="text-white/30 text-[10px] mt-0.5">دانش‌آموز</div>
                  </div>

                  {/* دانش‌آموزان آنلاین */}
                  <div className={`glass-dark rounded-xl px-3 py-2 text-center min-w-[56px] border ${cls.onlineStudentCount > 0 ? 'border-green-500/20' : 'border-white/5'}`}>
                    <div className="flex items-center justify-center gap-1">
                      {cls.onlineStudentCount > 0
                        ? <FiWifi size={13} className="text-green-400" />
                        : <FiWifiOff size={13} className="text-white/20" />}
                      <span className={`font-bold text-sm ${cls.onlineStudentCount > 0 ? 'text-green-400' : 'text-white/20'}`}>
                        {toPersianNum(cls.onlineStudentCount || 0)}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${cls.onlineStudentCount > 0 ? 'text-green-400/60' : 'text-white/20'}`}>آنلاین</div>
                  </div>

                  {/* جلسات برگزار شده */}
                  <div className="glass-dark rounded-xl px-3 py-2 text-center min-w-[56px]">
                    <div className="flex items-center justify-center gap-1">
                      <FiCalendar size={12} className="text-indigo-400" />
                      <span className="text-indigo-400 font-bold text-sm">{toPersianNum(cls.sessionCount ?? sessionCount)}</span>
                    </div>
                    <div className="text-indigo-400/60 text-[10px] mt-0.5">جلسات</div>
                  </div>

                  {/* ساعت برگزار شده */}
                  <div className="glass-dark rounded-xl px-3 py-2 text-center min-w-[64px]">
                    <div className="text-violet-400 font-bold text-sm">{toPersianNum(usedHours)}</div>
                    <div className="text-white/30 text-[10px] mt-0.5">ساعت برگزار</div>
                  </div>

                  {/* ساعت باقیمانده */}
                  <div className="glass-dark rounded-xl px-3 py-2 text-center min-w-[64px]">
                    <div className={`font-bold text-sm ${remainingHours > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {toPersianNum(remainingHours)}
                    </div>
                    <div className="text-white/30 text-[10px] mt-0.5">ساعت مانده</div>
                  </div>

                  {/* ساعت کل */}
                  <div className="glass-dark rounded-xl px-3 py-2 text-center min-w-[56px]">
                    <div className="text-white/70 font-bold text-sm">{toPersianNum(totalHours)}</div>
                    <div className="text-white/30 text-[10px] mt-0.5">ساعت کل</div>
                  </div>
                </div>
              </div>

              {/* Actions row 1 */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                <button onClick={() => handleEdit(cls)} className="glass-btn rounded-lg px-3 py-1.5 text-xs text-white/60 flex items-center gap-1">
                  <FiEdit2 size={12} /> ویرایش
                </button>
                <button onClick={() => setViewStudentsClass(cls.id)} className="glass-btn rounded-lg px-3 py-1.5 text-xs text-white/60 flex items-center gap-1">
                  <FiUsers size={12} /> دانش‌آموزان ({toPersianNum(classStudents.length)})
                </button>
                <button onClick={() => setViewDetailsClass(cls.id)} className="glass-btn rounded-lg px-3 py-1.5 text-xs text-white/60 flex items-center gap-1">
                  <FiEye size={12} /> جزئیات
                </button>
                <button onClick={() => toggleClassActive(cls.id)}
                  className={`glass-btn rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 ${cls.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {cls.isActive ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                  {cls.isActive ? 'فعال' : 'غیرفعال'}
                </button>
                <button onClick={() => handleDelete(cls)} className="glass-btn rounded-lg px-3 py-1.5 text-xs text-red-400 flex items-center gap-1">
                  <FiTrash2 size={12} /> حذف
                </button>
              </div>

              {/* Actions row 2: Class report export */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-white/25 text-[10px]">گزارش کلاس:</span>
                <button onClick={() => exportClassReport(cls, 'json')} disabled={!!exportingClass}
                  className="glass-btn rounded-lg px-2 py-1 text-[10px] text-amber-400 flex items-center gap-1 disabled:opacity-40">
                  {exportingClass === cls.id+'json' ? <span className="w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={10}/>} JSON
                </button>
                <button onClick={() => exportClassReport(cls, 'excel')} disabled={!!exportingClass}
                  className="glass-btn rounded-lg px-2 py-1 text-[10px] text-emerald-400 flex items-center gap-1 disabled:opacity-40">
                  {exportingClass === cls.id+'excel' ? <span className="w-2.5 h-2.5 border border-emerald-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={10}/>} Excel
                </button>
                <button onClick={() => exportClassReport(cls, 'pdf')} disabled={!!exportingClass}
                  className="glass-btn rounded-lg px-2 py-1 text-[10px] text-rose-400 flex items-center gap-1 disabled:opacity-40">
                  {exportingClass === cls.id+'pdf' ? <span className="w-2.5 h-2.5 border border-rose-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={10}/>} PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {classes.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <FiCalendar size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/30">هنوز کلاسی تعریف نشده است</p>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-6 py-2 text-sm">
            ایجاد اولین کلاس
          </button>
        </div>
      )}
    </div>
  );
}
