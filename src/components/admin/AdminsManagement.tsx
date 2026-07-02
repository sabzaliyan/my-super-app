import { useState, useEffect, useRef } from 'react';
import {
  FiPlus, FiTrash2, FiDownload, FiUpload, FiUser,
  FiPhone, FiLock, FiAlertCircle, FiCheck, FiFileText, FiX,
  FiClock, FiLogIn, FiLogOut, FiRefreshCw, FiEdit2, FiSave
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi } from '../../utils/persian';

interface Admin {
  id: string;
  username: string;
  mobile?: string;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  admin_id: string | null;
  username: string;
  action: 'login' | 'logout';
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
}

interface AddForm { username: string; password: string; mobile: string; }
interface EditForm { username: string; password: string; mobile: string; }

const API = 'http://localhost:3002';

export default function AdminsManagement() {
  const { authToken } = useAppStore();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AddForm>({ username: '', password: '', mobile: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ username: '', password: '', mobile: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importing, setImporting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'admins' | 'audit'>('admins');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [auditPdfLoading, setAuditPdfLoading] = useState(false);
  const adminsTableRef = useRef<HTMLDivElement>(null);
  const auditTableRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` };

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admins`, { headers });
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch { setAdmins([]); } finally { setLoading(false); }
  }

  async function fetchAuditLogs() {
    setAuditLoading(true);
    try {
      const res = await fetch(`${API}/api/admins/audit-logs?limit=500`, { headers });
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch { setAuditLogs([]); } finally { setAuditLoading(false); }
  }

  useEffect(() => { fetchAdmins(); fetchAuditLogs(); }, []);

  // ─── Add ─────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.username.trim()) return setFormError('نام کاربری الزامی است');
    if (form.password.length < 6) return setFormError('رمز عبور باید حداقل ۶ کاراکتر باشد');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/admins`, {
        method: 'POST', headers,
        body: JSON.stringify({ username: form.username.trim(), password: form.password, mobile: form.mobile.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) return setFormError(data.error || 'خطا در ثبت ادمین');
      setFormSuccess(`ادمین "${form.username}" افزوده شد`);
      setForm({ username: '', password: '', mobile: '' });
      fetchAdmins();
    } catch { setFormError('خطا در اتصال به سرور'); } finally { setSubmitting(false); }
  }

  // ─── Edit ─────────────────────────────────────────────────────────
  function openEdit(admin: Admin) {
    setEditId(admin.id);
    setEditForm({ username: admin.username, password: '', mobile: admin.mobile || '' });
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError('');
    if (!editForm.username.trim()) return setEditError('نام کاربری الزامی است');
    if (editForm.password && editForm.password.length < 6) return setEditError('رمز عبور باید حداقل ۶ کاراکتر باشد');
    setEditSaving(true);
    try {
      const body: Record<string, string> = { username: editForm.username.trim(), mobile: editForm.mobile.trim() };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`${API}/api/admins/${editId}`, {
        method: 'PUT', headers, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) return setEditError(data.error || 'خطا در ویرایش');
      setEditId(null);
      fetchAdmins();
    } catch { setEditError('خطا در اتصال به سرور'); } finally { setEditSaving(false); }
  }

  // ─── Delete ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await fetch(`${API}/api/admins/${id}`, { method: 'DELETE', headers });
      setDeleteId(null); fetchAdmins();
    } catch {}
  }

  // ─── Excel Sample ─────────────────────────────────────────────────
  function downloadSampleExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['نام کاربری', 'رمز عبور', 'موبایل'],
      ['admin2', 'pass1234', '09121234567'],
      ['operator1', 'secure99', '09351234567'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ادمین‌ها');
    XLSX.writeFile(wb, 'sample-admins.xlsx');
  }

  // ─── Excel Import ─────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(''); setImportSuccess(''); setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      const dataRows = rows.slice(1).filter(r => r[0] && r[1]);
      if (!dataRows.length) { setImportError('هیچ ردیف معتبری یافت نشد'); setImporting(false); return; }
      let added = 0, failed = 0;
      for (const row of dataRows) {
        const [username, password, mobile] = row;
        const res = await fetch(`${API}/api/admins`, {
          method: 'POST', headers,
          body: JSON.stringify({ username: String(username).trim(), password: String(password), mobile: mobile ? String(mobile).trim() : undefined })
        });
        if (res.ok) added++; else failed++;
      }
      setImportSuccess(`${toPersianNum(added)} ادمین افزوده شد${failed ? ` — ${toPersianNum(failed)} ردیف خطا` : ''}`);
      fetchAdmins();
    } catch { setImportError('فایل اکسل قابل خواندن نیست'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  // ─── Export Excel ─────────────────────────────────────────────────
  function exportExcel() {
    const rows = admins.map(a => ({
      'نام کاربری': a.username,
      'موبایل': a.mobile || '',
      'تاریخ ایجاد': new Date(a.created_at).toLocaleDateString('fa-IR'),
      'آخرین تغییر': new Date(a.updated_at).toLocaleDateString('fa-IR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مدیران');
    XLSX.writeFile(wb, `admins-${Date.now()}.xlsx`);
  }

  // ─── Export JSON ──────────────────────────────────────────────────
  function exportJSON() {
    const data = admins.map(({ id, username, mobile, created_at, updated_at }) => ({ id, username, mobile, created_at, updated_at }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `admins-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Export PDF — جدول موقت با inline style (بدون oklab) ───────────
  async function exportPDF() {
    setPdfLoading(true);
    try {
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed', top: '-9999px', left: '-9999px',
        width: '900px', padding: '24px',
        background: '#ffffff', direction: 'rtl',
        fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '13px', color: '#111111',
      });

      const title = document.createElement('div');
      Object.assign(title.style, { textAlign: 'center', marginBottom: '4px', fontSize: '16px', fontWeight: 'bold', color: '#111111' });
      title.textContent = 'G-Online-Edu-App — لیست مدیران سامانه';
      container.appendChild(title);

      const subtitle = document.createElement('div');
      Object.assign(subtitle.style, { textAlign: 'center', marginBottom: '16px', fontSize: '11px', color: '#555555' });
      subtitle.textContent = `تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}  |  تعداد مدیران: ${admins.length}`;
      container.appendChild(subtitle);

      const hr = document.createElement('hr');
      Object.assign(hr.style, { border: 'none', borderTop: '2px solid #111111', marginBottom: '16px' });
      container.appendChild(hr);

      const table = document.createElement('table');
      Object.assign(table.style, { width: '100%', borderCollapse: 'collapse' });

      const thead = document.createElement('thead');
      ['#', 'نام کاربری', 'موبایل', 'تاریخ ایجاد', 'آخرین تغییر'].forEach(h => {
        const th = document.createElement('th');
        Object.assign(th.style, { background: '#111111', color: '#ffffff', padding: '9px 12px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #111111' });
        th.textContent = h;
        thead.appendChild(th);
      });
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      admins.forEach((admin, idx) => {
        const tr = document.createElement('tr');
        tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
        [
          String(idx + 1),
          admin.username,
          admin.mobile || '—',
          new Date(admin.created_at).toLocaleDateString('fa-IR'),
          new Date(admin.updated_at).toLocaleDateString('fa-IR'),
        ].forEach(val => {
          const td = document.createElement('td');
          Object.assign(td.style, { padding: '8px 12px', border: '1px solid #cccccc', color: '#111111', direction: 'ltr', textAlign: 'right' });
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { backgroundColor: '#1e1b4b', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);

      const img = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = imgW * (canvas.height / canvas.width);
      doc.addImage(img, 'PNG', 10, 10, imgW, Math.min(imgH, pageH - 20));
      doc.save(`admins-${Date.now()}.pdf`);
    } finally { setPdfLoading(false); }
  }

  // ─── Export Audit Excel ───────────────────────────────────────────
  function exportAuditExcel() {
    const rows = auditLogs.map(l => ({
      'نام کاربری': l.username,
      'عملیات': l.action === 'login' ? 'ورود' : 'خروج',
      'وضعیت': l.success ? 'موفق' : 'ناموفق',
      'IP': l.ip_address || '-',
      'زمان': new Date(l.created_at).toLocaleString('fa-IR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سابقه ورود-خروج');
    XLSX.writeFile(wb, `admin-audit-${Date.now()}.xlsx`);
  }

  // ─── Export Audit JSON ────────────────────────────────────────────
  function exportAuditJSON() {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `admin-audit-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Export Audit PDF — جدول موقت با inline style (بدون oklab) ────
  async function exportAuditPDF() {
    setAuditPdfLoading(true);
    try {
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed', top: '-9999px', left: '-9999px',
        width: '1100px', padding: '24px',
        background: '#ffffff', direction: 'rtl',
        fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '12px', color: '#111111',
      });

      const title = document.createElement('div');
      Object.assign(title.style, { textAlign: 'center', marginBottom: '4px', fontSize: '15px', fontWeight: 'bold', color: '#111111' });
      title.textContent = 'G-Online-Edu-App — سابقه ورود و خروج مدیران';
      container.appendChild(title);

      const subtitle = document.createElement('div');
      Object.assign(subtitle.style, { textAlign: 'center', marginBottom: '16px', fontSize: '11px', color: '#555555' });
      subtitle.textContent = `تاریخ تهیه: ${new Date().toLocaleString('fa-IR')}  |  مجموع: ${auditLogs.length} رکورد`;
      container.appendChild(subtitle);

      const hr = document.createElement('hr');
      Object.assign(hr.style, { border: 'none', borderTop: '2px solid #111111', marginBottom: '16px' });
      container.appendChild(hr);

      const table = document.createElement('table');
      Object.assign(table.style, { width: '100%', borderCollapse: 'collapse' });

      const thead = document.createElement('thead');
      ['#', 'نام کاربری', 'عملیات', 'وضعیت', 'آدرس IP', 'تاریخ و ساعت'].forEach(h => {
        const th = document.createElement('th');
        Object.assign(th.style, { background: '#111111', color: '#ffffff', padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #111111' });
        th.textContent = h;
        thead.appendChild(th);
      });
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      auditLogs.forEach((log, idx) => {
        const tr = document.createElement('tr');
        tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
        const cells = [
          String(idx + 1),
          log.username,
          log.action === 'login' ? 'ورود' : 'خروج',
          log.success ? 'موفق' : 'ناموفق',
          log.ip_address || '—',
          new Date(log.created_at).toLocaleString('fa-IR'),
        ];
        cells.forEach(val => {
          const td = document.createElement('td');
          Object.assign(td.style, { padding: '7px 12px', border: '1px solid #cccccc', color: '#111111', direction: 'ltr', textAlign: 'right' });
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);

      const img = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = imgW * (canvas.height / canvas.width);
      doc.addImage(img, 'PNG', 10, 10, imgW, Math.min(imgH, pageH - 20));
      doc.save(`admin-audit-${Date.now()}.pdf`);
    } finally { setAuditPdfLoading(false); }
  }

  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Section Tabs ──────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('admins')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
            activeSection === 'admins'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'glass-dark text-white/40 hover:text-white/70'
          }`}
        >
          <FiUser size={15} /> مدیریت ادمین‌ها
        </button>
        <button
          onClick={() => { setActiveSection('audit'); fetchAuditLogs(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
            activeSection === 'audit'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'glass-dark text-white/40 hover:text-white/70'
          }`}
        >
          <FiClock size={15} /> سابقه ورود و خروج
          <span className="bg-white/10 text-white/50 text-[10px] rounded-full px-2 py-0.5">
            {toPersianNum(auditLogs.length)}
          </span>
        </button>
      </div>

      {/* ══════════════ ADMINS SECTION ══════════════ */}
      {activeSection === 'admins' && (<>

        {/* ── Add Form ──────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <FiPlus className="text-indigo-400" size={18} /> افزودن ادمین جدید
          </h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">نام کاربری <span className="text-red-400">*</span></label>
              <div className="relative">
                <FiUser size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="مثال: operator1"
                  className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-400" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رمز عبور <span className="text-red-400">*</span></label>
              <div className="relative">
                <FiLock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-400" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">موبایل (اختیاری)</label>
              <div className="relative">
                <FiPhone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="tel" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))}
                  placeholder="09xxxxxxxxx"
                  className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-400" dir="ltr" />
              </div>
            </div>
            <div className="sm:col-span-3 flex items-center gap-3">
              <button type="submit" disabled={submitting}
                className="glass-btn bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-xl px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
                {submitting ? <span className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" /> : <FiPlus size={15} />}
                ثبت ادمین
              </button>
              {formError && <span className="flex items-center gap-1 text-red-400 text-xs"><FiAlertCircle size={13} />{formError}</span>}
              {formSuccess && <span className="flex items-center gap-1 text-emerald-400 text-xs"><FiCheck size={13} />{formSuccess}</span>}
            </div>
          </form>
        </div>

        {/* ── Import / Export Toolbar ───────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-white/40 text-xs ml-2">ورودی:</span>
            <button onClick={downloadSampleExcel} className="glass-btn text-emerald-300 hover:bg-emerald-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
              <FiDownload size={13} /> دانلود فایل نمونه
            </button>
            <label className={`glass-btn text-blue-300 hover:bg-blue-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              {importing ? <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" /> : <FiUpload size={13} />}
              آپلود اکسل
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
            {importError && <span className="text-red-400 text-xs flex items-center gap-1"><FiAlertCircle size={12} />{importError}</span>}
            {importSuccess && <span className="text-emerald-400 text-xs flex items-center gap-1"><FiCheck size={12} />{importSuccess}</span>}
            <div className="flex-1" />
            <span className="text-white/40 text-xs">خروجی:</span>
            <button onClick={exportExcel} className="glass-btn text-emerald-300 hover:bg-emerald-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
              <FiDownload size={13} /> Excel
            </button>
            <button onClick={exportPDF} disabled={pdfLoading} className="glass-btn text-rose-300 hover:bg-rose-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50">
              {pdfLoading ? <span className="w-3 h-3 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" /> : <FiFileText size={13} />} PDF
            </button>
            <button onClick={exportJSON} className="glass-btn text-amber-300 hover:bg-amber-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
              <FiDownload size={13} /> JSON
            </button>
          </div>
        </div>

        {/* ── Admins Table ─────────────────────────────────────────── */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">
              لیست مدیران
              <span className="mr-2 text-white/30 text-xs font-normal">({toPersianNum(admins.length)} نفر)</span>
            </h3>
            {loading && <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
          </div>

          <div ref={adminsTableRef}>
            {!loading && admins.length === 0 ? (
              <div className="py-16 text-center text-white/30 text-sm">هیچ ادمینی یافت نشد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 text-xs">
                      <th className="text-right px-5 py-3 font-normal">#</th>
                      <th className="text-right px-5 py-3 font-normal">نام کاربری</th>
                      <th className="text-right px-5 py-3 font-normal">موبایل</th>
                      <th className="text-right px-5 py-3 font-normal">تاریخ ایجاد</th>
                      <th className="text-right px-5 py-3 font-normal">آخرین تغییر</th>
                      <th className="px-5 py-3 text-center font-normal">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin, idx) => (
                      <tr key={admin.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3 text-white/30 text-xs">{toPersianNum(idx + 1)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                              <FiUser size={12} className="text-indigo-400" />
                            </div>
                            <span className="text-white font-medium" dir="ltr">{admin.username}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-white/60 text-xs" dir="ltr">
                          {admin.mobile || <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-5 py-3 text-white/50 text-xs">{toShamsi(new Date(admin.created_at))}</td>
                        <td className="px-5 py-3 text-white/50 text-xs">{toShamsi(new Date(admin.updated_at))}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            {/* Edit */}
                            <button onClick={() => openEdit(admin)}
                              className="glass-btn text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg p-1.5 transition-colors" title="ویرایش">
                              <FiEdit2 size={14} />
                            </button>
                            {/* Delete */}
                            {deleteId === admin.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-red-400 text-[10px]">حذف؟</span>
                                <button onClick={() => handleDelete(admin.id)}
                                  className="glass-btn bg-red-500/20 text-red-300 rounded-lg px-2 py-0.5 text-[10px] flex items-center gap-1">
                                  <FiCheck size={10} /> بله
                                </button>
                                <button onClick={() => setDeleteId(null)}
                                  className="glass-btn text-white/40 rounded-lg px-2 py-0.5 text-[10px] flex items-center gap-1">
                                  <FiX size={10} /> خیر
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteId(admin.id)}
                                className="glass-btn text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg p-1.5 transition-colors" title="حذف">
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Edit Modal ───────────────────────────────────────────── */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditId(null)}>
            <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <FiEdit2 className="text-blue-400" size={17} /> ویرایش ادمین
                </h3>
                <button onClick={() => setEditId(null)} className="text-white/40 hover:text-white/80 transition-colors">
                  <FiX size={20} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">نام کاربری <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <FiUser size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="text" value={editForm.username} onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
                      className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-blue-400" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">رمز عبور جدید <span className="text-white/30">(خالی = بدون تغییر)</span></label>
                  <div className="relative">
                    <FiLock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="حداقل ۶ کاراکتر"
                      className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-400" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">موبایل</label>
                  <div className="relative">
                    <FiPhone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="tel" value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))}
                      placeholder="09xxxxxxxxx"
                      className="w-full glass-dark rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-400" dir="ltr" />
                  </div>
                </div>
                {editError && <p className="text-red-400 text-xs flex items-center gap-1"><FiAlertCircle size={12} />{editError}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={editSaving}
                    className="flex-1 glass-btn bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {editSaving ? <span className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" /> : <FiSave size={15} />}
                    ذخیره تغییرات
                  </button>
                  <button type="button" onClick={() => setEditId(null)}
                    className="glass-btn text-white/50 hover:text-white/80 rounded-xl px-5 py-2.5 text-sm">
                    انصراف
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </>)}

      {/* ══════════════ AUDIT SECTION ══════════════ */}
      {activeSection === 'audit' && (<>

        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-white/40 text-xs ml-2">خروجی سابقه:</span>
          <button onClick={exportAuditExcel} className="glass-btn text-emerald-300 hover:bg-emerald-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
            <FiDownload size={13} /> Excel
          </button>
          <button onClick={exportAuditPDF} disabled={auditPdfLoading} className="glass-btn text-rose-300 hover:bg-rose-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50">
            {auditPdfLoading ? <span className="w-3 h-3 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" /> : <FiFileText size={13} />} PDF
          </button>
          <button onClick={exportAuditJSON} className="glass-btn text-amber-300 hover:bg-amber-500/20 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
            <FiDownload size={13} /> JSON
          </button>
          <div className="flex-1" />
          <button onClick={fetchAuditLogs} disabled={auditLoading}
            className="glass-btn text-white/50 hover:text-white/80 rounded-xl p-2 transition-colors" title="بروزرسانی">
            <FiRefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">
              سابقه ورود / خروج مدیران
              <span className="mr-2 text-white/30 text-xs font-normal">({toPersianNum(auditLogs.length)} رکورد)</span>
            </h3>
            {auditLoading && <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div ref={auditTableRef}>
            {!auditLoading && auditLogs.length === 0 ? (
              <div className="py-16 text-center text-white/30 text-sm">هیچ رکوردی یافت نشد</div>
            ) : (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-black/30 text-white/40 text-xs">
                      <th className="text-right px-5 py-3 font-normal">#</th>
                      <th className="text-right px-5 py-3 font-normal">نام کاربری</th>
                      <th className="text-right px-5 py-3 font-normal">عملیات</th>
                      <th className="text-right px-5 py-3 font-normal">وضعیت</th>
                      <th className="text-right px-5 py-3 font-normal">آدرس IP</th>
                      <th className="text-right px-5 py-3 font-normal">تاریخ و ساعت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-5 py-2.5 text-white/30 text-xs">{toPersianNum(idx + 1)}</td>
                        <td className="px-5 py-2.5">
                          <span className="text-white/80 font-medium" dir="ltr">{log.username}</span>
                        </td>
                        <td className="px-5 py-2.5">
                          {log.action === 'login'
                            ? <span className="flex items-center gap-1.5 text-emerald-400 text-xs"><FiLogIn size={12} /> ورود</span>
                            : <span className="flex items-center gap-1.5 text-amber-400 text-xs"><FiLogOut size={12} /> خروج</span>}
                        </td>
                        <td className="px-5 py-2.5">
                          {log.success
                            ? <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full px-2 py-0.5"><FiCheck size={10} /> موفق</span>
                            : <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 text-[10px] rounded-full px-2 py-0.5"><FiX size={10} /> ناموفق</span>}
                        </td>
                        <td className="px-5 py-2.5 text-white/40 text-xs font-mono" dir="ltr">{log.ip_address || '—'}</td>
                        <td className="px-5 py-2.5 text-white/50 text-xs">{new Date(log.created_at).toLocaleString('fa-IR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </>)}
    </div>
  );
}
