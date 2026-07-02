import { FiArrowRight, FiClock, FiUsers, FiCalendar, FiDownload, FiCopy, FiCheck, FiServer, FiBook, FiToggleRight, FiToggleLeft } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/appStore';
import { toPersianNum } from '../../utils/persian';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface Props {
  classId: string;
  onBack: () => void;
}

export default function ClassDetails({ classId, onBack }: Props) {
  const { classes, students, streamingServers } = useAppStore();
  const cls = classes.find(c => c.id === classId);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!cls) return null;

  const classStudents = students.filter(s => (cls.students || []).includes(s.id));
  const onlineCount = classStudents.filter(s => s.isOnline).length;
  const remainingHours = (cls.totalHours || 0) - (cls.usedHours || 0);
  const totalSessionMinutes = (cls.sessionHistory || []).reduce((sum, s) => sum + s.duration, 0);
  const streamServer = cls.streamingServerId ? streamingServers.find(sv => sv.id === cls.streamingServerId) : null;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportJson = () => {
    const data = { class: cls, students: classStudents.map(s => ({ name: s.name, description: s.description, isOnline: s.isOnline })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `class-${cls.code}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // شیت اطلاعات کلاس
    const infoRows = [
      ['کد کلاس', cls.code],
      ['نام کلاس', cls.name],
      ['نام درس', cls.courseName || ''],
      ['نام معلم', cls.teacherName || ''],
      ['رمز معلم', cls.teacherPassword || ''],
      ['وضعیت', cls.isActive ? 'فعال' : 'غیرفعال'],
      ['ظرفیت', cls.capacity],
      ['تاریخ شروع', cls.startDate || ''],
      ['ساعت شروع', cls.startTime || ''],
      ['تاریخ پایان', cls.endDate || ''],
      ['ساعت پایان', cls.endTime || ''],
      ['روزهای برگزاری', (cls.scheduleDays || []).join('، ')],
      ['ساعت کل', cls.totalHours || 0],
      ['ساعت برگزار شده', cls.usedHours || 0],
      ['ساعت باقیمانده', (cls.totalHours || 0) - (cls.usedHours || 0)],
      ['سرور استریم', streamServer ? `${streamServer.name} (${streamServer.url}:${streamServer.port})` : 'سیستمی'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), 'اطلاعات کلاس');

    // شیت دانش‌آموزان
    const stuRows = [['نام', 'توضیحات', 'وضعیت آنلاین', 'جلسات حاضر', 'درصد حضور']];
    classStudents.forEach(s => {
      const attended = (cls.sessionHistory || []).filter(ses => ses.attendees.includes(s.id)).length;
      const total = (cls.sessionHistory || []).length;
      stuRows.push([s.name, s.description || '', s.isOnline ? 'آنلاین' : 'آفلاین', String(attended), total > 0 ? `${Math.round((attended / total) * 100)}%` : '0%']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stuRows), 'دانش‌آموزان');

    // شیت تاریخچه جلسات
    const sesRows = [['شماره', 'تاریخ', 'شروع', 'پایان', 'مدت (دقیقه)', 'تعداد حاضر']];
    (cls.sessionHistory || []).forEach((s, i) => {
      sesRows.push([String(i + 1), s.date, s.startTime, s.endTime, String(s.duration), String(s.attendees.length)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sesRows), 'جلسات');

    XLSX.writeFile(wb, `class-${cls.code}.xlsx`);
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed', top: '-9999px', left: '-9999px', width: '900px',
      padding: '28px', background: '#ffffff', direction: 'rtl',
      fontFamily: 'Vazir, Tahoma, Arial, sans-serif', fontSize: '13px', color: '#111111',
    });

    const cell = (v: string, bg = '#fff', bold = false) =>
      `<td style="padding:6px 10px;border:1px solid #ccc;background:${bg};color:#111;font-size:11px;${bold ? 'font-weight:bold;' : ''}">${v}</td>`;

    const infoTable = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${[
          ['کد کلاس', cls.code, 'نام کلاس', cls.name],
          ['نام درس', cls.courseName || '—', 'نام معلم', cls.teacherName || '—'],
          ['رمز معلم', cls.teacherPassword || '—', 'وضعیت', cls.isActive ? 'فعال' : 'غیرفعال'],
          ['تاریخ شروع', `${cls.startDate || '—'} ${cls.startTime || ''}`, 'تاریخ پایان', `${cls.endDate || '—'} ${cls.endTime || ''}`],
          ['ظرفیت', `${classStudents.length}/${cls.capacity} نفر`, 'سرور استریم', streamServer ? `${streamServer.name}` : 'سیستمی'],
          ['ساعت کل', `${cls.totalHours || 0}`, 'ساعت باقیمانده', `${(cls.totalHours || 0) - (cls.usedHours || 0)}`],
          ['روزهای برگزاری', (cls.scheduleDays || []).join('، ') || '—', '', ''],
        ].map(([l1, v1, l2, v2]) => `<tr>${cell(l1, '#f0f0f0', true)}${cell(v1)}${l2 ? cell(l2, '#f0f0f0', true) : '<td></td>'}${v2 !== undefined ? cell(v2) : '<td></td>'}</tr>`).join('')}
      </table>`;

    const stuTable = classStudents.length > 0 ? `
      <p style="font-weight:bold;margin:12px 0 6px;font-size:13px;">دانش‌آموزان (${classStudents.length} نفر)</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>${['نام', 'توضیحات', 'وضعیت', 'جلسات حاضر', 'درصد حضور'].map(h => cell(h, '#111111')).join('').replace(/color:#111/g, 'color:#fff')}</tr>
        ${classStudents.map((s, i) => {
          const attended = (cls.sessionHistory || []).filter(ses => ses.attendees.includes(s.id)).length;
          const total = (cls.sessionHistory || []).length;
          const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
          return `<tr>${cell(s.name, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(s.description || '—', i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(s.isOnline ? 'آنلاین' : 'آفلاین', i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(`${attended}/${total}`, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(`${pct}%`, i % 2 === 0 ? '#fff' : '#f9f9f9')}</tr>`;
        }).join('')}
      </table>` : '';

    const sesTable = (cls.sessionHistory || []).length > 0 ? `
      <p style="font-weight:bold;margin:12px 0 6px;font-size:13px;">تاریخچه جلسات</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>${['#', 'تاریخ', 'شروع', 'پایان', 'مدت', 'حاضر'].map(h => cell(h, '#111111')).join('').replace(/color:#111/g, 'color:#fff')}</tr>
        ${(cls.sessionHistory || []).map((s, i) => `<tr>${cell(String(i + 1), i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(s.date, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(s.startTime, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(s.endTime, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(`${s.duration} دقیقه`, i % 2 === 0 ? '#fff' : '#f9f9f9')}${cell(String(s.attendees.length), i % 2 === 0 ? '#fff' : '#f9f9f9')}</tr>`).join('')}
      </table>` : '';

    container.innerHTML = `
      <div style="background:#111;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;font-weight:bold;">جزئیات کلاس: ${cls.name}</span>
        <span style="font-size:11px;opacity:0.7;">کد: ${cls.code} | ${new Date().toLocaleDateString('fa-IR')}</span>
      </div>
      ${infoTable}${stuTable}${sesTable}`;

    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const imgW = pW - 10;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 5;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 5, y, imgW, imgH);
        remaining -= (pH - 10);
        if (remaining > 0) { pdf.addPage(); y = 5 - (imgH - remaining); }
      }
      pdf.save(`class-${cls.code}.pdf`);
    } catch {
      document.body.removeChild(container);
    }
    setPdfLoading(false);
  };

  return (
    <div className="space-y-4 animate-float-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="glass-btn rounded-lg p-2 text-white/60"><FiArrowRight size={18} /></button>
          <h2 className="text-white font-bold text-lg">جزئیات کلاس: {cls.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1">
            <FiDownload size={13} /> Excel
          </button>
          <button onClick={exportPdf} disabled={pdfLoading} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1 disabled:opacity-50">
            <FiDownload size={13} /> {pdfLoading ? 'در حال تولید...' : 'PDF'}
          </button>
          <button onClick={exportJson} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs flex items-center gap-1">
            <FiDownload size={13} /> JSON
          </button>
          <button onClick={() => setShowQR(!showQR)} className="glass-btn rounded-xl px-3 py-2 text-white/60 text-xs">
            {showQR ? 'بستن QR' : 'QR Code'}
          </button>
        </div>
      </div>

      {/* اطلاعات اصلی کلاس */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FiBook className="text-indigo-400" /> اطلاعات کلاس
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* کد کلاس */}
          <div className="glass-dark rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs mb-1">کد کلاس</p>
              <p className="text-white font-bold font-mono" dir="ltr">{cls.code}</p>
            </div>
            <button onClick={() => copy(cls.code, 'code')} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
              {copied === 'code' ? <FiCheck size={14} className="text-green-400" /> : <FiCopy size={14} />}
            </button>
          </div>

          {/* نام کلاس */}
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">نام کلاس</p>
            <p className="text-white font-semibold">{cls.name}</p>
          </div>

          {/* نام درس */}
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">نام درس / دوره</p>
            <p className="text-white">{cls.courseName || '—'}</p>
          </div>

          {/* معلم */}
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">نام معلم</p>
            <p className="text-white">{cls.teacherName || '—'}</p>
          </div>

          {/* رمز معلم */}
          <div className="glass-dark rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs mb-1">رمز معلم</p>
              <p className="text-white font-mono" dir="ltr">{cls.teacherPassword || '—'}</p>
            </div>
            {cls.teacherPassword && (
              <button onClick={() => copy(cls.teacherPassword, 'pass')} className="glass-btn rounded-lg p-1.5 text-white/40 hover:text-white">
                {copied === 'pass' ? <FiCheck size={14} className="text-green-400" /> : <FiCopy size={14} />}
              </button>
            )}
          </div>

          {/* وضعیت */}
          <div className="glass-dark rounded-xl p-3 flex items-center gap-3">
            {cls.isActive
              ? <FiToggleRight size={20} className="text-emerald-400" />
              : <FiToggleLeft size={20} className="text-white/30" />}
            <div>
              <p className="text-white/40 text-xs mb-0.5">وضعیت</p>
              <p className={`text-sm font-semibold ${cls.isActive ? 'text-emerald-400' : 'text-white/40'}`}>
                {cls.isActive ? 'کلاس فعال' : 'کلاس غیرفعال'}
              </p>
            </div>
          </div>

          {/* ظرفیت */}
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">ظرفیت</p>
            <p className="text-white">{toPersianNum(classStudents.length)} / {toPersianNum(cls.capacity)} نفر</p>
          </div>

          {/* سرور استریم */}
          <div className="glass-dark rounded-xl p-3 flex items-center gap-2">
            <FiServer size={14} className="text-cyan-400 flex-shrink-0" />
            <div>
              <p className="text-white/40 text-xs mb-0.5">سرور استریم</p>
              {streamServer ? (
                <>
                  <p className="text-white text-sm">{streamServer.name}</p>
                  <p className="text-white/40 text-xs" dir="ltr">{streamServer.url}:{streamServer.port}</p>
                </>
              ) : (
                <p className="text-white/50 text-sm">سیستمی (خودکار)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* آمار */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ساعت کل', value: `${toPersianNum(cls.totalHours || 0)} ساعت`, color: 'text-blue-400' },
          { label: 'برگزار شده', value: `${toPersianNum(cls.usedHours || 0)} ساعت`, color: 'text-amber-400' },
          { label: 'باقیمانده', value: `${toPersianNum(remainingHours)} ساعت`, color: 'text-red-400' },
          { label: 'جلسات', value: toPersianNum((cls.sessionHistory || []).length), color: 'text-purple-400' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-3 text-center">
            <p className="text-white/40 text-xs mb-1">{stat.label}</p>
            <p className={`font-bold text-sm ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="glass rounded-2xl p-6 text-center animate-float-in">
          <h3 className="text-white font-semibold mb-4">QR Code ورود به کلاس</h3>
          <div className="inline-block bg-white p-4 rounded-2xl">
            <QRCodeSVG value={`classroom://${cls.code}`} size={200} />
          </div>
          <p className="text-white/40 text-xs mt-3">کد کلاس: <span dir="ltr">{cls.code}</span></p>
        </div>
      )}

      {/* برنامه زمانی */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FiCalendar className="text-indigo-400" /> برنامه زمانی
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">تاریخ شروع</p>
            <p className="text-white">{cls.startDate || '—'}</p>
          </div>
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">ساعت شروع</p>
            <p className="text-white">{cls.startTime || '—'}</p>
          </div>
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">تاریخ پایان</p>
            <p className="text-white">{cls.endDate || '—'}</p>
          </div>
          <div className="glass-dark rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">ساعت پایان</p>
            <p className="text-white">{cls.endTime || '—'}</p>
          </div>
        </div>
        {(cls.scheduleDays || []).length > 0 && (
          <div className="mt-3">
            <p className="text-white/40 text-xs mb-2">روزهای برگزاری</p>
            <div className="flex flex-wrap gap-1">
              {(cls.scheduleDays || []).map(d => (
                <span key={d} className="bg-indigo-500/20 text-indigo-300 rounded-md px-2 py-0.5 text-xs">{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* تاریخچه جلسات */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FiClock className="text-cyan-400" /> تاریخچه جلسات
          <span className="text-white/30 text-xs">(مجموع: {toPersianNum(totalSessionMinutes)} دقیقه)</span>
        </h3>
        {(cls.sessionHistory || []).length > 0 ? (
          <div className="space-y-2">
            {(cls.sessionHistory || []).map((session, i) => (
              <div key={i} className="glass-dark rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-500/20 text-indigo-300 rounded-lg w-8 h-8 flex items-center justify-center text-xs font-bold">
                    {toPersianNum(i + 1)}
                  </span>
                  <div>
                    <p className="text-white text-sm">{session.date}</p>
                    <p className="text-white/40 text-xs">{session.startTime} - {session.endTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span>{toPersianNum(session.duration)} دقیقه</span>
                  <span className="flex items-center gap-1"><FiUsers size={10} /> {toPersianNum(session.attendees.length)} حاضر</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-4">هنوز جلسه‌ای برگزار نشده است</p>
        )}
      </div>

      {/* وضعیت حضور دانش‌آموزان */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FiUsers className="text-emerald-400" /> دانش‌آموزان ({toPersianNum(classStudents.length)} نفر)
        </h3>
        {classStudents.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-4">دانش‌آموزی در این کلاس ثبت نشده</p>
        ) : (
          <div className="space-y-2">
            {classStudents.map(student => {
              const attended = (cls.sessionHistory || []).filter(s => s.attendees.includes(student.id)).length;
              const total = (cls.sessionHistory || []).length;
              const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
              return (
                <div key={student.id} className="glass-dark rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${student.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                  <span className="text-white text-sm flex-1">{student.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/40">{toPersianNum(attended)}/{toPersianNum(total)} جلسه</span>
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white/30 w-8 text-left">{toPersianNum(pct)}٪</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
