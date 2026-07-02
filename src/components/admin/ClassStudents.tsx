import { useState, useRef, useEffect } from 'react';
import { FiArrowRight, FiUserPlus, FiTrash2, FiUpload, FiDownload, FiEdit2, FiX, FiZap, FiFileText, FiShield, FiSlash, FiCopy, FiCheck, FiEye, FiEyeOff, FiCalendar, FiClock, FiBarChart2 } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Student } from '../../store/types';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, generatePassword } from '../../utils/persian';

interface Props {
  classId: string;
  onBack: () => void;
}

// وضعیت مجاز/اخراج در localStorage
function getKicked(classId: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(`kicked_${classId}`) || '[]')); } catch { return new Set(); }
}
function saveKicked(classId: string, set: Set<string>) {
  localStorage.setItem(`kicked_${classId}`, JSON.stringify([...set]));
}

// شماره بعدی دانش‌پذیر
function nextStudentIndex(existingNames: string[]): number {
  let max = 0;
  existingNames.forEach(n => {
    const m = n.match(/دانش‌پذیر\s*(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return max + 1;
}

const API_URL_CS = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';

async function exportStudentPDF(student: Student, className: string, attendance: any[]) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;padding:20px;font-family:Vazirmatn,Tahoma,Arial;direction:rtl;width:700px;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'color:#111;font-size:15px;font-weight:bold;margin-bottom:4px;';
  titleEl.textContent = `گزارش دانش‌آموز: ${student.name}`;
  const subEl = document.createElement('div');
  subEl.style.cssText = 'color:#555;font-size:11px;margin-bottom:12px;border-bottom:1px solid #ccc;padding-bottom:6px;';
  subEl.textContent = `کلاس: ${className} | وضعیت: ${student.isOnline ? 'آنلاین' : 'آفلاین'}`;
  wrapper.appendChild(titleEl); wrapper.appendChild(subEl);
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';
  const hRow = document.createElement('tr');
  ['تاریخ','ورود','خروج'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.cssText = 'background:#222;color:#fff;padding:7px 10px;border:1px solid #999;text-align:right;';
    hRow.appendChild(th);
  });
  table.appendChild(hRow);
  attendance.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.style.background = i % 2 === 0 ? '#fff' : '#f5f5f5';
    const fmtDate = (v: any) => { try { return new Date(v).toLocaleDateString('fa-IR'); } catch { return String(v||'').slice(0,10); } };
    const fmtTime = (v: any) => { try { return new Date(v).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch { return String(v||'').slice(0,5); } };
    [fmtDate(a.date), fmtTime(a.start_time), fmtTime(a.end_time)].forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.cssText = 'color:#111;padding:6px 10px;border:1px solid #ccc;text-align:right;';
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  if (!attendance.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.textContent = 'سابقه‌ای ثبت نشده';
    td.style.cssText = 'color:#999;padding:10px;text-align:center;border:1px solid #ccc;';
    tr.appendChild(td); table.appendChild(tr);
  }
  wrapper.appendChild(table);
  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, Math.min(h, pdf.internal.pageSize.getHeight()));
    pdf.save(`student-${student.name}-report.pdf`);
  } finally { document.body.removeChild(wrapper); }
}

export default function ClassStudents({ classId, onBack }: Props) {
  const { classes, students, addStudent, addStudentsToClass, removeStudentFromClass, updateStudent, importStudents, addAlert, authToken } = useAppStore();
  const cls = classes.find(c => c.id === classId);

  // Refresh online status when this panel opens
  useEffect(() => {
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
    fetch(`${API_URL}/api/classes/${classId}/students`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then((fresh: any[]) => {
        if (!Array.isArray(fresh)) return;
        useAppStore.setState(s => ({
          students: s.students.map(st => {
            const f = fresh.find((fs: any) => fs.id === st.id);
            return f ? { ...st, isOnline: !!(f.isOnline ?? f.is_online) } : st;
          }),
        }));
      })
      .catch(() => {});
  }, [classId, authToken]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPwd, setNewPwd] = useState(() => generatePassword());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPwd, setEditPwd] = useState('');
  const [autoLoading, setAutoLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [kicked, setKicked] = useState<Set<string>>(() => getKicked(classId));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState<Set<string>>(new Set());
  const [attendanceStudentId, setAttendanceStudentId] = useState<string | null>(null);
  const [exportingStudent, setExportingStudent] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStudentAttendance = async (studentId: string) => {
    const r = await fetch(`${API_URL_CS}/api/features/student-attendance`, { headers: { Authorization: `Bearer ${authToken}` } });
    const all: any[] = await r.json();
    return all.filter((a: any) => a.student_id === studentId && a.class_id === classId);
  };

  const exportStudent = async (student: Student, format: 'json' | 'excel' | 'pdf') => {
    setExportingStudent(student.id + format);
    try {
      const attendance = await fetchStudentAttendance(student.id);
      const cls = classes.find(c => c.id === classId);
      const fmtDate = (v: any) => { try { return new Date(v).toLocaleDateString('fa-IR'); } catch { return String(v||'').slice(0,10); } };
      const fmtTime = (v: any) => { try { return new Date(v).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch { return String(v||'').slice(0,5); } };

      if (format === 'json') {
        const data = { name: student.name, description: student.description, isOnline: student.isOnline, class: cls?.name, attendance: attendance.map(a => ({ date: fmtDate(a.date), entry: fmtTime(a.start_time), exit: fmtTime(a.end_time) })) };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `student-${student.name}.json`; a.click();
      } else if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['نام', 'توضیحات', 'وضعیت', 'کلاس'],
          [student.name, student.description||'', student.isOnline ? 'آنلاین':'آفلاین', cls?.name||''],
        ]), 'اطلاعات');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['تاریخ','ورود','خروج'],
          ...attendance.map(a => [fmtDate(a.date), fmtTime(a.start_time), fmtTime(a.end_time)]),
        ]), 'سابقه حضور');
        XLSX.writeFile(wb, `student-${student.name}.xlsx`);
      } else {
        await exportStudentPDF(student, cls?.name || '', attendance);
      }
    } catch { addAlert({ type: 'error', title: 'خطا', message: 'خروجی‌گیری ناموفق', duration: 3000 }); }
    setExportingStudent(null);
  };

  if (!cls) return null;

  const classStudents = students.filter(s => (cls.students || []).includes(s.id));
  const availableStudents = students.filter(s => !(cls.students || []).includes(s.id));
  const remaining = cls.capacity - classStudents.length;
  const sessions = cls.sessionHistory || [];

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key); setTimeout(() => setCopiedId(null), 2000);
  };
  const toggleShowPwd = (id: string) => {
    setShowPwd(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleKick = (studentId: string) => {
    const next = new Set(kicked);
    if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
    saveKicked(classId, next);
    setKicked(next);
    const s = classStudents.find(s => s.id === studentId);
    const name = s?.name || '';
    addAlert({ type: next.has(studentId) ? 'warning' : 'success', title: next.has(studentId) ? 'اخراج' : 'بازگشت', message: `${name} ${next.has(studentId) ? 'اخراج شد' : 'به کلاس بازگشت'}`, duration: 2500 });
  };

  // ── تولید خودکار با اسامی دانش‌پذیر۱، ۲، ۳ ─────────────────────────────
  const handleAutoGenerate = () => {
    if (remaining <= 0) {
      addAlert({ type: 'warning', title: 'ظرفیت پر', message: 'کلاس به حداکثر ظرفیت رسیده', duration: 3000 });
      return;
    }
    setAutoLoading(true);
    const allNames = [...students.map(s => s.name), ...classStudents.map(s => s.name)];
    let idx = nextStudentIndex(allNames);
    const generated: { name: string; description: string }[] = [];
    for (let i = 0; i < remaining; i++) {
      generated.push({ name: `دانش‌پذیر ${idx}`, description: 'تولید خودکار' });
      idx++;
    }
    importStudents(generated, classId);
    setAutoLoading(false);
    addAlert({ type: 'success', title: 'موفق', message: `${toPersianNum(generated.length)} دانش‌پذیر اضافه شد`, duration: 3000 });
  };

  // ── افزودن دستی ───────────────────────────────────────────────────────────
  const handleAddStudent = () => {
    if (!newName.trim()) return;
    if (remaining <= 0) {
      addAlert({ type: 'error', title: 'ظرفیت پر', message: 'ظرفیت کلاس تکمیل شده است', duration: 3000 });
      return;
    }
    addStudent({ name: newName, description: newDesc, password: newPwd || generatePassword(), classIds: [classId] });
    setNewName(''); setNewDesc(''); setNewPwd(generatePassword()); setShowAdd(false);
    addAlert({ type: 'success', title: 'موفق', message: `دانش‌آموز "${newName}" اضافه شد`, duration: 3000 });
  };

  // ── آپلود اکسل ────────────────────────────────────────────────────────────
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        const toImport: { name: string; description: string }[] = [];
        const canAdd = Math.min(remaining, data.length - 1);
        for (let i = 1; i <= canAdd; i++) {
          const row = data[i] as any[];
          const name = row[0] ? String(row[0]) : '';
          if (!name) continue;
          toImport.push({ name, description: row[1] ? String(row[1]) : '' });
        }
        if (!toImport.length) { addAlert({ type: 'warning', title: 'خالی', message: 'داده‌ای یافت نشد یا ظرفیت پر است', duration: 3000 }); return; }
        importStudents(toImport, classId);
        addAlert({ type: 'success', title: 'موفق', message: `${toPersianNum(toImport.length)} دانش‌آموز وارد شد`, duration: 3000 });
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'فایل اکسل معتبر نیست', duration: 3000 }); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleSampleExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([['نام دانش‌آموز', 'توضیحات'], ['دانش‌پذیر ۱', 'پایه دهم'], ['دانش‌پذیر ۲', 'پایه یازدهم']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'دانش‌آموزان');
    XLSX.writeFile(wb, 'students-sample.xlsx');
  };

  const statusLabel = (id: string) => kicked.has(id) ? 'اخراج' : 'مجاز';

  const handleExcelExport = () => {
    const rows = [['ردیف', 'نام', 'توضیحات', 'رمز عبور', 'وضعیت آنلاین', 'وضعیت مجاز']];
    classStudents.forEach((s, i) => rows.push([toPersianNum(i + 1), s.name, s.description || '', s.password, s.isOnline ? 'آنلاین' : 'آفلاین', statusLabel(s.id)]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'دانش‌آموزان');
    XLSX.writeFile(wb, `students-${cls.code}.xlsx`);
    addAlert({ type: 'success', title: 'موفق', message: 'فایل اکسل ذخیره شد', duration: 3000 });
  };

  const handleJsonExport = () => {
    const data = classStudents.map(s => ({ name: s.name, description: s.description, password: s.password, isOnline: s.isOnline, status: statusLabel(s.id) }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `students-${cls.code}.json`; a.click();
    URL.revokeObjectURL(url);
    addAlert({ type: 'success', title: 'موفق', message: 'فایل JSON ذخیره شد', duration: 3000 });
  };

  const handlePdfExport = async () => {
    if (!classStudents.length) { addAlert({ type: 'warning', title: 'خالی', message: 'دانش‌آموزی برای خروجی وجود ندارد', duration: 3000 }); return; }
    setPdfLoading(true);
    const container = document.createElement('div');
    Object.assign(container.style, { position: 'fixed', top: '-9999px', left: '-9999px', width: '900px', padding: '28px', background: '#ffffff', direction: 'rtl', fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '13px', color: '#111' });
    const cell = (v: string, bg = '#fff', color = '#111') => `<td style="padding:6px 10px;border:1px solid #ccc;background:${bg};color:${color};font-size:11px;">${v}</td>`;
    container.innerHTML = `
      <div style="background:#111;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;font-weight:bold;">لیست دانش‌آموزان — ${cls.name}</span>
        <span style="font-size:11px;opacity:0.7;">${toPersianNum(classStudents.length)}/${toPersianNum(cls.capacity)} نفر | ${new Date().toLocaleDateString('fa-IR')}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#333;color:#fff;">${['ردیف','نام','توضیحات','رمز عبور','آنلاین','وضعیت مجاز'].map(h=>`<th style="padding:8px 10px;border:1px solid #999;text-align:right;font-size:12px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${classStudents.map((s,i)=>{const bg=i%2===0?'#fff':'#f5f5f5';const isKicked=kicked.has(s.id);return`<tr>${cell(toPersianNum(i+1),bg)}${cell(s.name,bg)}${cell(s.description||'—',bg)}${cell(s.password,bg)}${cell(s.isOnline?'آنلاین':'آفلاین',bg,s.isOnline?'#16a34a':'#dc2626')}${cell(isKicked?'اخراج':'مجاز',bg,isKicked?'#dc2626':'#16a34a')}</tr>`;}).join('')}</tbody>
      </table>
      <div style="margin-top:10px;font-size:10px;color:#888;text-align:left;">جمع: ${classStudents.length} | مجاز: ${classStudents.filter(s=>!kicked.has(s.id)).length} | اخراج: ${classStudents.filter(s=>kicked.has(s.id)).length}</div>`;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth(), pH = pdf.internal.pageSize.getHeight();
      const imgW = pW - 10, imgH = (canvas.height * imgW) / canvas.width;
      let y = 5, rem = imgH;
      while (rem > 0) { pdf.addImage(imgData, 'PNG', 5, y, imgW, imgH); rem -= (pH - 10); if (rem > 0) { pdf.addPage(); y = 5 - (imgH - rem); } }
      pdf.save(`students-${cls.code}.pdf`);
      addAlert({ type: 'success', title: 'موفق', message: 'فایل PDF ذخیره شد', duration: 3000 });
    } catch { document.body.removeChild(container); addAlert({ type: 'error', title: 'خطا', message: 'خطا در تولید PDF', duration: 3000 }); }
    setPdfLoading(false);
  };

  return (
    <div className="space-y-4 animate-float-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="glass-btn rounded-lg p-2 text-white/60"><FiArrowRight size={18} /></button>
          <div>
            <h2 className="text-white font-bold text-lg">دانش‌آموزان کلاس {cls.name}</h2>
            <p className="text-white/40 text-xs">
              ظرفیت: {toPersianNum(classStudents.length)}/{toPersianNum(cls.capacity)} نفر
              {remaining > 0 ? ` | ${toPersianNum(remaining)} جای خالی` : ' | ظرفیت پر'}
              {kicked.size > 0 && <span className="text-red-400"> | {toPersianNum(kicked.size)} اخراج</span>}
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-3 py-2 text-xs flex items-center gap-1">
          <FiUserPlus size={14} /> افزودن دستی
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleAutoGenerate} disabled={autoLoading || remaining <= 0}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl px-3 py-2 text-xs flex items-center gap-1 disabled:opacity-40">
          <FiZap size={13} /> {autoLoading ? 'در حال تولید...' : `تولید خودکار (${toPersianNum(remaining)} نفر)`}
        </button>
        <button onClick={handleSampleExcel} className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
          <FiFileText size={13} /> فایل نمونه
        </button>
        <button onClick={() => fileRef.current?.click()} className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
          <FiUpload size={13} /> آپلود Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
        <button onClick={handleExcelExport} className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
          <FiDownload size={13} /> Excel
        </button>
        <button onClick={handlePdfExport} disabled={pdfLoading} className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1 disabled:opacity-50">
          <FiDownload size={13} /> {pdfLoading ? 'در حال تولید...' : 'PDF'}
        </button>
        <button onClick={handleJsonExport} className="glass-btn rounded-xl px-3 py-1.5 text-white/50 text-xs flex items-center gap-1">
          <FiDownload size={13} /> JSON
        </button>
      </div>

      {/* کد کلاس */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <FiCalendar size={14} className="text-indigo-400 flex-shrink-0" />
        <span className="text-white/40 text-xs">کد کلاس:</span>
        <span className="text-white font-mono font-bold tracking-widest" dir="ltr">{cls.code}</span>
        <button onClick={() => copyText(cls.code, 'cls-code')}
          className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
          {copiedId === 'cls-code' ? <FiCheck size={13} className="text-green-400" /> : <FiCopy size={13} />}
        </button>
        <span className="text-white/20 text-xs mr-2">رمز معلم: <span className="font-mono text-white/40" dir="ltr">{cls.teacherPassword}</span></span>
        <button onClick={() => copyText(cls.teacherPassword, 'cls-pwd')}
          className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
          {copiedId === 'cls-pwd' ? <FiCheck size={13} className="text-green-400" /> : <FiCopy size={13} />}
        </button>
      </div>

      {/* مودال گزارش حضور */}
      {attendanceStudentId && (() => {
        const st = classStudents.find(s => s.id === attendanceStudentId);
        if (!st) return null;
        const present = sessions.filter(s => (s.attendees || []).includes(attendanceStudentId));
        const absent  = sessions.filter(s => !(s.attendees || []).includes(attendanceStudentId));
        const totalMins = present.reduce((sum, s) => sum + (s.duration || 0), 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAttendanceStudentId(null)}>
            <div className="glass rounded-2xl p-5 w-full max-w-xl max-h-[80vh] overflow-y-auto animate-float-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <FiBarChart2 className="text-indigo-400" /> گزارش حضور: {st.name}
                </h3>
                <button onClick={() => setAttendanceStudentId(null)} className="text-white/40 hover:text-white"><FiX /></button>
              </div>

              {/* آمار کلی */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="glass-dark rounded-xl p-3 text-center">
                  <p className="text-green-400 font-bold text-lg">{toPersianNum(present.length)}</p>
                  <p className="text-white/40 text-xs mt-1">حاضر</p>
                </div>
                <div className="glass-dark rounded-xl p-3 text-center">
                  <p className="text-red-400 font-bold text-lg">{toPersianNum(absent.length)}</p>
                  <p className="text-white/40 text-xs mt-1">غایب</p>
                </div>
                <div className="glass-dark rounded-xl p-3 text-center">
                  <p className="text-blue-400 font-bold text-lg">{toPersianNum(totalMins)}</p>
                  <p className="text-white/40 text-xs mt-1">دقیقه حضور</p>
                </div>
              </div>

              {sessions.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">هنوز جلسه‌ای ثبت نشده</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((ses, i) => {
                    const wasPresent = ses.attendees.includes(attendanceStudentId);
                    return (
                      <div key={i} className={`glass-dark rounded-xl p-3 flex items-center gap-3 border ${wasPresent ? 'border-green-500/20' : 'border-red-500/20'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wasPresent ? 'bg-green-400' : 'bg-red-500'}`} />
                        <div className="flex-1">
                          <p className="text-white text-sm">{ses.date}</p>
                          <p className="text-white/40 text-xs flex items-center gap-1">
                            <FiClock size={10} /> شروع کلاس: {ses.startTime} — پایان: {ses.endTime}
                          </p>
                        </div>
                        <div className="text-right">
                          {wasPresent ? (
                            <>
                              <p className="text-green-400 text-xs font-semibold">حاضر</p>
                              <p className="text-white/30 text-[10px]">{toPersianNum(ses.duration)} دقیقه</p>
                            </>
                          ) : (
                            <p className="text-red-400 text-xs font-semibold">غایب</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* درصد حضور */}
              {sessions.length > 0 && (
                <div className="mt-4 glass-dark rounded-xl p-3 flex items-center gap-3">
                  <span className="text-white/50 text-xs">درصد حضور کلی:</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                      style={{ width: `${Math.round((present.length / sessions.length) * 100)}%` }} />
                  </div>
                  <span className="text-white text-sm font-bold">
                    {toPersianNum(Math.round((present.length / sessions.length) * 100))}٪
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* فرم افزودن دستی */}
      {showAdd && (
        <div className="glass rounded-2xl p-4 animate-float-in">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold text-sm">افزودن دانش‌آموز جدید</h3>
            <button onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white/80"><FiX /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm" placeholder="نام دانش‌آموز" />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm" placeholder="توضیحات (اختیاری)" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-sm flex-1 font-mono" dir="ltr" placeholder="رمز عبور" />
            <button type="button" onClick={() => setNewPwd(generatePassword())}
              className="glass-btn rounded-xl px-3 py-2 text-white/50 text-xs flex items-center gap-1">
              <FiZap size={13} /> تولید رمز
            </button>
          </div>
          {availableStudents.length > 0 && (
            <div className="mt-3">
              <p className="text-white/40 text-xs mb-2">یا از دانش‌آموزان موجود انتخاب کنید:</p>
              <div className="flex flex-wrap gap-2">
                {availableStudents.map(s => (
                  <button key={s.id} onClick={() => {
                    if (remaining <= 0) { addAlert({ type: 'error', title: 'ظرفیت پر', message: 'ظرفیت کلاس تکمیل شده است', duration: 3000 }); return; }
                    addStudentsToClass(classId, [s.id]);
                    addAlert({ type: 'success', title: 'موفق', message: `${s.name} به کلاس اضافه شد`, duration: 2000 });
                  }}
                    className="glass-btn rounded-lg px-3 py-1 text-xs text-white/60 flex items-center gap-1">
                    <FiUserPlus size={10} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="glass-btn rounded-xl px-4 py-2 text-white/60 text-xs">انصراف</button>
            <button onClick={handleAddStudent} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-xs">ثبت</button>
          </div>
        </div>
      )}

      {/* لیست دانش‌آموزان */}
      <div className="space-y-2">
        {classStudents.map((student, index) => {
          const isKicked = kicked.has(student.id);
          return (
            <div key={student.id} className={`glass rounded-xl p-3 transition-all ${isKicked ? 'opacity-60 border border-red-500/20' : 'hover:bg-white/[0.06]'}`}>
            <div className="flex items-center gap-3">
              {/* آواتار + نشانگر آنلاین */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold relative flex-shrink-0">
                {toPersianNum(index + 1)}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${student.isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
              </div>

              {/* نام و توضیحات */}
              <div className="flex-1 min-w-0">
                {editingId === student.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="glass-input rounded-lg px-2 py-1 text-xs w-32" placeholder="نام" />
                    <input value={editPwd} onChange={e => setEditPwd(e.target.value)}
                      className="glass-input rounded-lg px-2 py-1 text-xs w-28 font-mono" dir="ltr" placeholder="رمز" />
                    <button type="button" onClick={() => setEditPwd(generatePassword())}
                      className="glass-btn rounded-lg px-2 py-1 text-white/40 text-[10px] flex items-center gap-0.5">
                      <FiZap size={10} /> رمز جدید
                    </button>
                    <button onClick={() => { updateStudent(student.id, { name: editName, password: editPwd || student.password }); setEditingId(null); }}
                      className="text-emerald-400 text-xs">ذخیره</button>
                    <button onClick={() => setEditingId(null)} className="text-white/40 text-xs">لغو</button>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm font-medium ${isKicked ? 'text-white/40 line-through' : 'text-white'}`}>{student.name}</p>
                    <p className="text-white/30 text-[10px]">{student.description}</p>
                  </>
                )}
              </div>

              {/* وضعیت آنلاین */}
              <span className={`text-xs font-semibold flex-shrink-0 ${student.isOnline ? 'text-green-400' : 'text-white/20'}`}>
                {student.isOnline ? '● آنلاین' : '● آفلاین'}
              </span>

              {/* رمز دانش‌آموز: نمایش/پنهان + کپی */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span dir="ltr" className="text-white/30 text-[10px] font-mono w-20 truncate">
                  {showPwd.has(student.id) ? student.password : '••••••'}
                </span>
                <button onClick={() => toggleShowPwd(student.id)} className="glass-btn rounded p-1 text-white/30 hover:text-white/70">
                  {showPwd.has(student.id) ? <FiEyeOff size={11} /> : <FiEye size={11} />}
                </button>
                <button onClick={() => copyText(student.password, `pwd-${student.id}`)} className="glass-btn rounded p-1 text-white/30 hover:text-white/70">
                  {copiedId === `pwd-${student.id}` ? <FiCheck size={11} className="text-green-400" /> : <FiCopy size={11} />}
                </button>
              </div>

              {/* وضعیت مجاز/اخراج */}
              <button onClick={() => toggleKick(student.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all border flex-shrink-0 ${isKicked ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'}`}>
                {isKicked ? <><FiSlash size={11} /> اخراج</> : <><FiShield size={11} /> مجاز</>}
              </button>

              {/* دکمه‌های عملیات */}
              <div className="flex gap-1">
                <button onClick={() => setAttendanceStudentId(student.id)}
                  title="گزارش حضور"
                  className="glass-btn rounded-lg p-1.5 text-indigo-400/60 hover:text-indigo-400">
                  <FiBarChart2 size={12} />
                </button>
                <button onClick={() => { setEditingId(student.id); setEditName(student.name); setEditPwd(student.password); }}
                  className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white/80">
                  <FiEdit2 size={12} />
                </button>
                <button onClick={() => { removeStudentFromClass(classId, student.id); addAlert({ type: 'warning', title: 'حذف', message: `${student.name} از کلاس حذف شد`, duration: 2000 }); }}
                  className="glass-btn rounded-lg p-1.5 text-red-400/60 hover:text-red-400">
                  <FiTrash2 size={12} />
                </button>
              </div>
            </div>

            {/* Export row */}
            <div className="flex items-center gap-1.5 mt-2 pr-11">
              <span className="text-white/20 text-[10px]">گزارش:</span>
              <button onClick={() => exportStudent(student, 'json')} disabled={!!exportingStudent}
                className="glass-btn rounded px-2 py-0.5 text-[10px] text-amber-400 flex items-center gap-1 disabled:opacity-40">
                {exportingStudent === student.id+'json' ? <span className="w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={9}/>} JSON
              </button>
              <button onClick={() => exportStudent(student, 'excel')} disabled={!!exportingStudent}
                className="glass-btn rounded px-2 py-0.5 text-[10px] text-emerald-400 flex items-center gap-1 disabled:opacity-40">
                {exportingStudent === student.id+'excel' ? <span className="w-2 h-2 border border-emerald-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={9}/>} Excel
              </button>
              <button onClick={() => exportStudent(student, 'pdf')} disabled={!!exportingStudent}
                className="glass-btn rounded px-2 py-0.5 text-[10px] text-rose-400 flex items-center gap-1 disabled:opacity-40">
                {exportingStudent === student.id+'pdf' ? <span className="w-2 h-2 border border-rose-400 border-t-transparent rounded-full animate-spin"/> : <FiDownload size={9}/>} PDF
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {classStudents.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <FiUserPlus size={36} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">هنوز دانش‌آموزی به این کلاس اضافه نشده است</p>
          <button onClick={handleAutoGenerate} className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl px-4 py-2 text-xs flex items-center gap-1 mx-auto">
            <FiZap size={13} /> تولید خودکار {toPersianNum(cls.capacity)} دانش‌پذیر
          </button>
        </div>
      )}
    </div>
  );
}
