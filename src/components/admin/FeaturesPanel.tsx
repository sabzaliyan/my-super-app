import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FiWifi, FiUsers, FiTrash2, FiDownload, FiChevronDown, FiChevronUp,
  FiX, FiRefreshCw, FiClock, FiCalendar, FiArchive, FiAlertTriangle, FiCheck
} from 'react-icons/fi';
import { useAppStore } from '../../store/appStore';
import { toPersianNum } from '../../utils/persian';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';

function formatTime(val: any): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {}
  return String(val).slice(0, 5);
}

function formatDate(val: any): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('fa-IR');
  } catch {}
  return String(val).slice(0, 10);
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
interface ConfirmState { message: string; onConfirm: () => void; }

function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="glass rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <FiAlertTriangle className="text-red-400" size={18} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1">تأیید عملیات</p>
            <p className="text-white/60 text-sm leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="glass-btn rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white">
            انصراف
          </button>
          <button onClick={() => { state.onConfirm(); onClose(); }}
            className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl px-4 py-2 text-sm text-red-400 flex items-center gap-1.5 transition-all">
            <FiCheck size={14} /> تأیید
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const confirm = useCallback((message: string, onConfirm: () => void) => {
    setState({ message, onConfirm });
  }, []);
  const modal = state ? <ConfirmModal state={state} onClose={() => setState(null)} /> : null;
  return { confirm, modal };
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportJSON(data: any[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${filename}.json`; a.click();
}
function exportExcel(data: any[], headers: string[], keys: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data.map(r => keys.map(k => r[k] ?? ''))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
async function exportPDF(data: any[], headers: string[], keys: string[], title: string, filename: string) {
  // Build an off-screen HTML table with Persian text and capture it
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
  data.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.style.background = i % 2 === 0 ? '#fff' : '#f5f5f5';
    keys.forEach(k => {
      const td = document.createElement('td');
      td.textContent = String(r[k] ?? '');
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
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()));
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}

function ExportBar({ data, headers, keys, filename, onClear }: {
  data: any[]; headers: string[]; keys: string[]; filename: string; onClear: () => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button onClick={() => exportJSON(data, filename)}
        className="glass-btn rounded-lg px-2 py-1 text-xs text-blue-400 flex items-center gap-1">
        <FiDownload size={11} /> JSON
      </button>
      <button onClick={() => exportExcel(data, headers, keys, filename)}
        className="glass-btn rounded-lg px-2 py-1 text-xs text-green-400 flex items-center gap-1">
        <FiDownload size={11} /> Excel
      </button>
      <button onClick={() => void exportPDF(data, headers, keys, filename, filename)}
        className="glass-btn rounded-lg px-2 py-1 text-xs text-orange-400 flex items-center gap-1">
        <FiDownload size={11} /> PDF
      </button>
      {data.length > 0 && (
        <button onClick={onClear}
          className="glass-btn rounded-lg px-2 py-1 text-xs text-red-400 flex items-center gap-1">
          <FiTrash2 size={11} /> پاک کردن همه
        </button>
      )}
    </div>
  );
}

// ─── Card 1: Live Tables ──────────────────────────────────────────────────────
function LiveTablesCard() {
  const { authToken, addAlert } = useAppStore();
  const { confirm, modal } = useConfirm();
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [liveStu, setLiveStu] = useState<any[]>([]);
  const [loadingCls, setLoadingCls] = useState(false);
  const [loadingStu, setLoadingStu] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentsMap, setStudentsMap] = useState<Record<string, any[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setLoadingCls(true);
    try {
      const r = await fetch(`${API_URL}/api/features/class-live-sessions`, { headers: { Authorization: `Bearer ${authToken}` } });
      setLiveClasses(await r.json());
    } catch {}
    setLoadingCls(false);
  }, [authToken]);

  const loadStudents = useCallback(async () => {
    setLoadingStu(true);
    try {
      const r = await fetch(`${API_URL}/api/features/student-live-sessions`, { headers: { Authorization: `Bearer ${authToken}` } });
      setLiveStu(await r.json());
    } catch {}
    setLoadingStu(false);
  }, [authToken]);

  useEffect(() => { loadClasses(); loadStudents(); }, [loadClasses, loadStudents]);

  const toggleStudents = async (classId: string) => {
    if (expandedId === classId) { setExpandedId(null); return; }
    setExpandedId(classId);
    if (studentsMap[classId]) return;
    setLoadingExpand(classId);
    try {
      const r = await fetch(`${API_URL}/api/features/live-classes/${classId}/students`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await r.json();
      setStudentsMap(m => ({ ...m, [classId]: data }));
    } catch {}
    setLoadingExpand(null);
  };

  const endClass = (sessionId: string) => {
    confirm('کلاس بسته و به بایگانی منتقل می‌شود. این عمل برگشت‌پذیر نیست.', async () => {
      try {
        await fetch(`${API_URL}/api/features/live-classes/${sessionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        addAlert({ type: 'success', title: 'موفق', message: 'کلاس بسته و بایگانی شد', duration: 3000 });
        setExpandedId(null);
        loadClasses(); loadStudents();
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const removeStudent = (attendanceId: string, classId: string, name: string) => {
    confirm(`دانش‌آموز «${name}» از کلاس خارج و به بایگانی حضور منتقل می‌شود.`, async () => {
      try {
        await fetch(`${API_URL}/api/features/live-students/${attendanceId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        addAlert({ type: 'success', title: 'موفق', message: `${name} خارج شد`, duration: 3000 });
        const r = await fetch(`${API_URL}/api/features/live-classes/${classId}/students`, { headers: { Authorization: `Bearer ${authToken}` } });
        const data = await r.json();
        setStudentsMap(m => ({ ...m, [classId]: data }));
        loadClasses(); loadStudents();
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const clearAllClasses = () => {
    confirm(`${toPersianNum(liveClasses.length)} رکورد کلاس آنلاین پاک و به بایگانی منتقل می‌شود.`, async () => {
      try {
        await fetch(`${API_URL}/api/features/class-live-sessions`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        addAlert({ type: 'success', title: 'موفق', message: 'جدول کلاس‌های آنلاین پاک شد', duration: 3000 });
        loadClasses();
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const clearAllStudents = () => {
    confirm(`${toPersianNum(liveStu.length)} رکورد دانش‌آموز آنلاین پاک و به بایگانی منتقل می‌شود.`, async () => {
      try {
        await fetch(`${API_URL}/api/features/student-live-sessions`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        addAlert({ type: 'success', title: 'موفق', message: 'جدول دانش‌آموزان آنلاین پاک شد', duration: 3000 });
        loadStudents();
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const clsMapped = liveClasses.map(r => ({ ...r, date: formatDate(r.date), start_time: formatTime(r.start_time), end_time: formatTime(r.end_time) }));
  const stuMapped = liveStu.map(r => ({ ...r, date: formatDate(r.date), start_time: formatTime(r.start_time) }));

  return (
    <>
      {modal}
      <div className="glass rounded-2xl p-4 space-y-5">
        <div className="flex items-center gap-2">
          <FiWifi className="text-green-400" size={18} />
          <h3 className="text-white font-bold">جداول آنلاین</h3>
          <span className="text-white/30 text-xs">(class_live_sessions + student_live_sessions)</span>
        </div>

        {/* Section A: class_live_sessions */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm font-semibold">کلاس‌های آنلاین</span>
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">{toPersianNum(liveClasses.length)} رکورد</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={loadClasses} disabled={loadingCls} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
                <FiRefreshCw size={13} className={loadingCls ? 'animate-spin' : ''} />
              </button>
              <ExportBar data={clsMapped} headers={['کلاس','معلم','درس','تاریخ','شروع','پایان']} keys={['name','teacher_name','course_name','date','start_time','end_time']} filename="class-live-sessions" onClear={clearAllClasses} />
            </div>
          </div>
          {liveClasses.length === 0 ? (
            <p className="text-white/20 text-xs text-center py-3">هیچ کلاس آنلاینی وجود ندارد</p>
          ) : (
            <div className="space-y-2">
              {liveClasses.map(cls => (
                <div key={cls.session_id} className="glass-dark rounded-xl overflow-hidden">
                  <div className="p-3 flex items-center gap-2 flex-wrap">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{cls.name}</p>
                      <p className="text-white/40 text-[10px]">{cls.teacher_name} • {cls.course_name}</p>
                    </div>
                    <span className="text-white/40 text-[10px] flex items-center gap-1"><FiClock size={9}/>{formatTime(cls.start_time)}</span>
                    <span className="text-white/40 text-[10px] flex items-center gap-1"><FiCalendar size={9}/>{formatDate(cls.date)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => toggleStudents(cls.id)} className="glass-btn rounded px-2 py-1 text-[10px] text-indigo-400 flex items-center gap-1">
                        <FiUsers size={10}/>{expandedId === cls.id ? <FiChevronUp size={10}/> : <FiChevronDown size={10}/>}
                      </button>
                      <button onClick={() => endClass(cls.session_id)} className="glass-btn rounded px-2 py-1 text-[10px] text-red-400 flex items-center gap-1">
                        <FiX size={10}/> بستن
                      </button>
                    </div>
                  </div>
                  {expandedId === cls.id && (
                    <div className="border-t border-white/5 px-3 pb-3 mt-1">
                      {loadingExpand === cls.id ? (
                        <p className="text-white/30 text-[10px] text-center py-2">بارگذاری...</p>
                      ) : !studentsMap[cls.id]?.length ? (
                        <p className="text-white/20 text-[10px] text-center py-2">دانش‌آموز آنلاینی ندارد</p>
                      ) : (
                        <div className="space-y-1 mt-2">
                          {studentsMap[cls.id].map(st => (
                            <div key={st.attendance_id} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2 py-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span className="text-white/70 text-[11px] flex-1">{st.name}</span>
                              <span className="text-white/30 text-[10px]">{formatTime(st.start_time)}</span>
                              <span className="text-white/30 text-[10px]">{formatDate(st.date)}</span>
                              <button onClick={() => removeStudent(st.attendance_id, cls.id, st.name)}
                                className="glass-btn rounded px-1.5 py-0.5 text-[10px] text-red-400">خروج اجباری</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/5" />

        {/* Section B: student_live_sessions */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm font-semibold">دانش‌آموزان آنلاین</span>
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full">{toPersianNum(liveStu.length)} رکورد</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={loadStudents} disabled={loadingStu} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
                <FiRefreshCw size={13} className={loadingStu ? 'animate-spin' : ''} />
              </button>
              <ExportBar data={stuMapped} headers={['دانش‌آموز','کلاس','معلم','تاریخ','ورود']} keys={['student_name','class_name','teacher_name','date','start_time']} filename="student-live-sessions" onClear={clearAllStudents} />
            </div>
          </div>
          {liveStu.length === 0 ? (
            <p className="text-white/20 text-xs text-center py-3">هیچ دانش‌آموز آنلاینی وجود ندارد</p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-xs text-right" style={{ minWidth: 480 }}>
                <thead>
                  <tr className="text-white/30 border-b border-white/5">
                    <th className="pb-2 font-normal">دانش‌آموز</th><th className="pb-2 font-normal">کلاس</th>
                    <th className="pb-2 font-normal">معلم</th><th className="pb-2 font-normal">تاریخ</th>
                    <th className="pb-2 font-normal">ورود</th><th className="pb-2 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {liveStu.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-white/[0.03]">
                      <td className="py-1.5 text-white/80">{r.student_name}</td>
                      <td className="py-1.5 text-white/50">{r.class_name}</td>
                      <td className="py-1.5 text-white/50">{r.teacher_name}</td>
                      <td className="py-1.5 text-white/40">{formatDate(r.date)}</td>
                      <td className="py-1.5 text-green-400/70">{formatTime(r.start_time)}</td>
                      <td className="py-1.5">
                        <button
                          onClick={() => removeStudent(r.id, r.class_id, r.student_name)}
                          className="glass-btn-del glass-btn rounded px-2 py-0.5 text-[10px] text-red-400 flex items-center gap-1 transition-opacity">
                          <FiX size={10}/> بستن
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Card 2: Session History ──────────────────────────────────────────────────
function SessionHistoryCard() {
  const { authToken, addAlert } = useAppStore();
  const { confirm, modal } = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/features/session-history`, { headers: { Authorization: `Bearer ${authToken}` } });
      setRows(await r.json());
    } catch {}
    setLoading(false);
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const deleteRow = (id: string, label: string) => {
    confirm(`رکورد جلسه «${label}» حذف شود؟`, async () => {
      try {
        await fetch(`${API_URL}/api/features/session-history/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        setRows(r => r.filter(x => x.id !== id));
        addAlert({ type: 'success', title: 'حذف شد', message: label, duration: 2500 });
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const clearAll = () => {
    confirm(`${toPersianNum(rows.length)} رکورد بایگانی جلسات برای همیشه حذف شود؟`, async () => {
      try {
        await fetch(`${API_URL}/api/features/session-history`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        setRows([]);
        addAlert({ type: 'success', title: 'موفق', message: 'بایگانی جلسات پاک شد', duration: 3000 });
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const headers = ['کلاس','معلم','درس','تاریخ','شروع','پایان'];
  const keys = ['class_name','teacher_name','course_name','date','start_time','end_time'];
  const mapped = rows.map(r => ({ ...r, date: formatDate(r.date), start_time: formatTime(r.start_time), end_time: formatTime(r.end_time) }));

  return (
    <>
      {modal}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FiArchive className="text-indigo-400" size={18} />
            <h3 className="text-white font-bold">بایگانی جلسات</h3>
            <span className="text-white/30 text-xs">(session_history)</span>
            <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{toPersianNum(rows.length)} رکورد</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={load} disabled={loading} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <ExportBar data={mapped} headers={headers} keys={keys} filename="session-history" onClear={clearAll} />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">بایگانی خالی است</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-xs text-right" style={{ minWidth: 520 }}>
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  {headers.map(h => <th key={h} className="pb-2 font-normal">{h}</th>)}
                  <th className="pb-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 text-white/80">{r.class_name}</td>
                    <td className="py-2 text-white/50">{r.teacher_name}</td>
                    <td className="py-2 text-white/50">{r.course_name}</td>
                    <td className="py-2 text-white/40">{formatDate(r.date)}</td>
                    <td className="py-2 text-green-400/70">{formatTime(r.start_time)}</td>
                    <td className="py-2 text-red-400/70">{formatTime(r.end_time)}</td>
                    <td className="py-2">
                      <button onClick={() => deleteRow(r.id, `${r.class_name} — ${formatDate(r.date)}`)}
                        className="glass-btn-del glass-btn rounded p-1 text-red-400 transition-opacity">
                        <FiTrash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Card 3: Student Attendance ───────────────────────────────────────────────
function StudentAttendanceCard() {
  const { authToken, addAlert } = useAppStore();
  const { confirm, modal } = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/features/student-attendance`, { headers: { Authorization: `Bearer ${authToken}` } });
      setRows(await r.json());
    } catch {}
    setLoading(false);
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const deleteRow = (id: string, label: string) => {
    confirm(`رکورد حضور «${label}» حذف شود؟`, async () => {
      try {
        await fetch(`${API_URL}/api/features/student-attendance/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        setRows(r => r.filter(x => x.id !== id));
        addAlert({ type: 'success', title: 'حذف شد', message: label, duration: 2500 });
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const clearAll = () => {
    confirm(`${toPersianNum(rows.length)} رکورد بایگانی حضور برای همیشه حذف شود؟`, async () => {
      try {
        await fetch(`${API_URL}/api/features/student-attendance`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
        setRows([]);
        addAlert({ type: 'success', title: 'موفق', message: 'بایگانی حضور پاک شد', duration: 3000 });
      } catch { addAlert({ type: 'error', title: 'خطا', message: 'عملیات ناموفق', duration: 3000 }); }
    });
  };

  const headers = ['دانش‌آموز','کلاس','معلم','تاریخ','ورود','خروج'];
  const keys = ['student_name','class_name','teacher_name','date','start_time','end_time'];
  const mapped = rows.map(r => ({ ...r, date: formatDate(r.date), start_time: formatTime(r.start_time), end_time: formatTime(r.end_time) }));

  return (
    <>
      {modal}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FiUsers className="text-purple-400" size={18} />
            <h3 className="text-white font-bold">بایگانی حضور دانش‌آموزان</h3>
            <span className="text-white/30 text-xs">(student_attendance)</span>
            <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{toPersianNum(rows.length)} رکورد</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={load} disabled={loading} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <ExportBar data={mapped} headers={headers} keys={keys} filename="student-attendance" onClear={clearAll} />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">بایگانی خالی است</p>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-xs text-right" style={{ minWidth: 560 }}>
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  {headers.map(h => <th key={h} className="pb-2 font-normal">{h}</th>)}
                  <th className="pb-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 text-white/80">{r.student_name}</td>
                    <td className="py-2 text-white/50">{r.class_name}</td>
                    <td className="py-2 text-white/50">{r.teacher_name}</td>
                    <td className="py-2 text-white/40">{formatDate(r.date)}</td>
                    <td className="py-2 text-green-400/70">{formatTime(r.start_time)}</td>
                    <td className="py-2 text-red-400/70">{formatTime(r.end_time)}</td>
                    <td className="py-2">
                      <button onClick={() => deleteRow(r.id, `${r.student_name} — ${formatDate(r.date)}`)}
                        className="glass-btn-del glass-btn rounded p-1 text-red-400 transition-opacity">
                        <FiTrash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FeaturesPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <FiAlertTriangle className="text-yellow-400 flex-shrink-0" size={13} />
        <p className="text-white/30 text-xs">
          عملیات بستن/خروج اجباری برای مواردی است که مرورگر بسته شده و رکورد آنلاین باقی مانده — رکوردها قبل از حذف به بایگانی منتقل می‌شوند
        </p>
      </div>
      <LiveTablesCard />
      <SessionHistoryCard />
      <StudentAttendanceCard />
    </div>
  );
}
