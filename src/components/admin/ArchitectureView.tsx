import { useState } from 'react';
import { FiServer, FiDatabase, FiMonitor, FiCloud, FiUsers, FiVideo, FiHardDrive, FiBell, FiDisc, FiZap, FiLock, FiFileText, FiDownload, FiChevronDown, FiChevronLeft } from 'react-icons/fi';
import { toPersianNum } from '../../utils/persian';

interface ArchNode {
  code: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  status: 'active' | 'planned' | 'partial';
}

interface ModuleNode {
  code: string;
  title: string;
  status: 'done' | 'partial' | 'planned';
  features?: { code: string; title: string; status: 'done' | 'partial' | 'planned' }[];
}

const architectureNodes: ArchNode[] = [
  { code: 'ARC-01', title: 'Streaming Server', icon: <FiVideo />, color: 'from-red-500 to-rose-600', status: 'planned' },
  { code: 'ARC-02', title: 'API Server', icon: <FiServer />, color: 'from-blue-500 to-indigo-600', status: 'planned' },
  { code: 'ARC-03', title: 'Client Application', icon: <FiMonitor />, color: 'from-emerald-500 to-teal-600', status: 'active' },
  { code: 'ARC-04', title: 'Media Storage', icon: <FiHardDrive />, color: 'from-amber-500 to-orange-600', status: 'planned' },
  { code: 'ARC-05', title: 'Notification Engine', icon: <FiBell />, color: 'from-purple-500 to-violet-600', status: 'partial' },
  { code: 'ARC-06', title: 'Recording Service', icon: <FiDisc />, color: 'from-pink-500 to-rose-600', status: 'planned' },
  { code: 'ARC-07', title: 'Realtime Socket', icon: <FiZap />, color: 'from-cyan-500 to-blue-600', status: 'planned' },
  { code: 'ARC-08', title: 'Auth Server', icon: <FiLock />, color: 'from-green-500 to-emerald-600', status: 'partial' },
  { code: 'ARC-09', title: 'Report Engine', icon: <FiFileText />, color: 'from-indigo-500 to-purple-600', status: 'partial' },
  { code: 'ARC-10', title: 'Backup Engine', icon: <FiDownload />, color: 'from-slate-500 to-gray-600', status: 'partial' },
];

const modules: ModuleNode[] = [
  { code: 'MOD-01', title: 'احراز هویت', status: 'done', features: [
    { code: 'AUTH-01', title: 'ورود مدیر', status: 'done' },
    { code: 'AUTH-02', title: 'ورود معلم', status: 'done' },
    { code: 'AUTH-03', title: 'ورود دانش‌آموز', status: 'done' },
    { code: 'AUTH-04', title: 'ورود با شماره کلاس', status: 'done' },
    { code: 'AUTH-05', title: 'ورود با رمز', status: 'done' },
    { code: 'AUTH-06', title: 'بررسی اعتبار کلاس', status: 'done' },
    { code: 'AUTH-07', title: 'بررسی پایان کلاس', status: 'done' },
    { code: 'AUTH-08', title: 'هشدار خطا', status: 'done' },
    { code: 'AUTH-09', title: 'مدیریت نشست', status: 'partial' },
    { code: 'AUTH-10', title: 'جلوگیری از Login همزمان', status: 'planned' },
  ]},
  { code: 'MOD-02', title: 'مدیریت کلاس', status: 'done', features: [
    { code: 'CLS-01', title: 'ایجاد کلاس', status: 'done' },
    { code: 'CLS-02', title: 'حذف کلاس', status: 'done' },
    { code: 'CLS-03', title: 'ویرایش کلاس', status: 'done' },
    { code: 'CLS-04', title: 'انتصاب دانش‌آموز', status: 'done' },
    { code: 'CLS-05', title: 'مشاهده جزئیات', status: 'done' },
    { code: 'CLS-06', title: 'مشاهده تاریخچه', status: 'done' },
    { code: 'CLS-07', title: 'وضعیت آنلاین', status: 'done' },
    { code: 'CLS-08', title: 'مشاهده ظرفیت', status: 'done' },
    { code: 'CLS-09', title: 'بررسی اعتبار', status: 'done' },
    { code: 'CLS-10', title: 'گزارش ساعات', status: 'done' },
  ]},
  { code: 'MOD-03', title: 'مدیریت دانش‌آموز', status: 'done', features: [
    { code: 'STU-01', title: 'افزودن دستی', status: 'done' },
    { code: 'STU-02', title: 'آپلود Excel', status: 'partial' },
    { code: 'STU-03', title: 'رمز خودکار', status: 'done' },
    { code: 'STU-04', title: 'تغییر رمز', status: 'done' },
    { code: 'STU-05', title: 'توضیحات دانش‌آموز', status: 'done' },
    { code: 'STU-06', title: 'وضعیت آنلاین', status: 'done' },
    { code: 'STU-07', title: 'سوابق کلاس‌ها', status: 'done' },
    { code: 'STU-08', title: 'QR اختصاصی', status: 'done' },
    { code: 'STU-09', title: 'دانلود PDF', status: 'partial' },
    { code: 'STU-10', title: 'اخراج از کلاس', status: 'done' },
  ]},
  { code: 'MOD-04', title: 'مدیریت معلم', status: 'partial' },
  { code: 'MOD-05', title: 'استریم زنده', status: 'partial', features: [
    { code: 'STR-01', title: 'استریم WebRTC', status: 'planned' },
    { code: 'STR-02', title: 'Multi Scene', status: 'done' },
    { code: 'STR-03', title: 'Multi Layout', status: 'done' },
    { code: 'STR-04', title: 'Auto Rotate', status: 'done' },
    { code: 'STR-05', title: 'Stream Queue', status: 'done' },
    { code: 'STR-06', title: 'Stream Pagination', status: 'done' },
    { code: 'STR-07', title: 'Scene Replace', status: 'done' },
    { code: 'STR-08', title: 'Screen Share', status: 'partial' },
    { code: 'STR-09', title: 'Audio Stream', status: 'partial' },
    { code: 'STR-10', title: 'Whiteboard Stream', status: 'partial' },
  ]},
  { code: 'MOD-06', title: 'چت زنده', status: 'done', features: [
    { code: 'CHAT-01', title: 'پیام متنی', status: 'done' },
    { code: 'CHAT-02', title: 'استیکر', status: 'partial' },
    { code: 'CHAT-03', title: 'ثبت رویدادها', status: 'done' },
    { code: 'CHAT-04', title: 'ذخیره PDF', status: 'partial' },
    { code: 'CHAT-05', title: 'جستجو', status: 'planned' },
    { code: 'CHAT-06', title: 'دانلود تاریخچه', status: 'partial' },
  ]},
  { code: 'MOD-07', title: 'مدیریت رسانه', status: 'partial', features: [
    { code: 'MED-01', title: 'آپلود ویدیو', status: 'partial' },
    { code: 'MED-02', title: 'آپلود صوت', status: 'partial' },
    { code: 'MED-03', title: 'آپلود پاورپوینت', status: 'partial' },
    { code: 'MED-04', title: 'تبدیل اسلاید', status: 'planned' },
    { code: 'MED-05', title: 'ساخت SlideShow', status: 'done' },
    { code: 'MED-06', title: 'YouTube Embed', status: 'done' },
    { code: 'MED-07', title: 'مدیریت فایل', status: 'partial' },
    { code: 'MED-08', title: 'حذف فایل', status: 'done' },
  ]},
  { code: 'MOD-08', title: 'ضبط کلاس', status: 'partial', features: [
    { code: 'REC-01', title: 'ضبط MP4', status: 'planned' },
    { code: 'REC-02', title: 'انتخاب کیفیت', status: 'planned' },
    { code: 'REC-03', title: 'Pause', status: 'planned' },
    { code: 'REC-04', title: 'Resume', status: 'planned' },
    { code: 'REC-05', title: 'دانلود نهایی', status: 'planned' },
    { code: 'REC-06', title: 'ارسال به دانش‌آموز', status: 'planned' },
    { code: 'REC-07', title: 'آرشیو', status: 'planned' },
    { code: 'REC-08', title: 'ضبط Scene فعال', status: 'planned' },
  ]},
  { code: 'MOD-09', title: 'گزارشات', status: 'partial', features: [
    { code: 'REP-01', title: 'گزارش حضور', status: 'done' },
    { code: 'REP-02', title: 'گزارش غیاب', status: 'done' },
    { code: 'REP-03', title: 'گزارش کلاس', status: 'done' },
    { code: 'REP-04', title: 'گزارش ضبط', status: 'planned' },
    { code: 'REP-05', title: 'گزارش اخراج', status: 'done' },
    { code: 'REP-06', title: 'گزارش مصرف ساعت', status: 'done' },
  ]},
  { code: 'MOD-10', title: 'خروجی PDF/Excel', status: 'partial', features: [
    { code: 'EXP-01', title: 'خروجی Excel', status: 'partial' },
    { code: 'EXP-02', title: 'خروجی PDF', status: 'partial' },
    { code: 'EXP-03', title: 'خروجی JSON', status: 'done' },
    { code: 'EXP-04', title: 'خروجی ZIP', status: 'planned' },
    { code: 'EXP-05', title: 'بکاپ کامل', status: 'partial' },
  ]},
  { code: 'MOD-11', title: 'اعلان‌ها', status: 'done', features: [
    { code: 'ALT-01', title: 'پایان زمان', status: 'done' },
    { code: 'ALT-02', title: 'کلاس منقضی', status: 'done' },
    { code: 'ALT-03', title: 'رمز اشتباه', status: 'done' },
    { code: 'ALT-04', title: 'قطع اینترنت', status: 'planned' },
    { code: 'ALT-05', title: 'پر شدن ظرفیت', status: 'planned' },
    { code: 'ALT-06', title: 'پایان ضبط', status: 'planned' },
    { code: 'ALT-07', title: 'پایان کلاس', status: 'done' },
    { code: 'ALT-08', title: 'کمبود زمان', status: 'done' },
    { code: 'ALT-09', title: 'هشدار اتصال', status: 'planned' },
    { code: 'ALT-10', title: 'تایمر دایره‌ای', status: 'done' },
  ]},
  { code: 'MOD-12', title: 'QRCode', status: 'done', features: [
    { code: 'QR-01', title: 'QR کلاس', status: 'done' },
    { code: 'QR-02', title: 'QR دانش‌آموز', status: 'partial' },
    { code: 'QR-03', title: 'خروجی PDF', status: 'partial' },
    { code: 'QR-04', title: 'تولید گروهی', status: 'partial' },
    { code: 'QR-05', title: 'لینک ورود سریع', status: 'done' },
  ]},
  { code: 'MOD-13', title: 'بکاپ و بازیابی', status: 'partial', features: [
    { code: 'BCK-01', title: 'بکاپ کامل', status: 'partial' },
    { code: 'BCK-02', title: 'بکاپ کلاس', status: 'partial' },
    { code: 'BCK-03', title: 'Restore', status: 'planned' },
    { code: 'BCK-04', title: 'زمان‌بندی بکاپ', status: 'planned' },
    { code: 'BCK-05', title: 'دانلود ZIP', status: 'planned' },
  ]},
  { code: 'MOD-14', title: 'مانیتورینگ آنلاین', status: 'done', features: [
    { code: 'MON-01', title: 'آنلاین بودن', status: 'done' },
    { code: 'MON-02', title: 'وضعیت دوربین', status: 'done' },
    { code: 'MON-03', title: 'وضعیت میکروفون', status: 'done' },
    { code: 'MON-04', title: 'وضعیت اینترنت', status: 'planned' },
    { code: 'MON-05', title: 'وضعیت استریم', status: 'partial' },
    { code: 'MON-06', title: 'Ping Monitoring', status: 'planned' },
  ]},
  { code: 'MOD-15', title: 'پنل تنظیمات', status: 'done' },
];

const roles = [
  { code: 'ROLE-ADM', title: 'مدیر سامانه', color: 'bg-purple-500' },
  { code: 'ROLE-TCH', title: 'معلم', color: 'bg-cyan-500' },
  { code: 'ROLE-STU', title: 'دانش‌آموز', color: 'bg-emerald-500' },
  { code: 'ROLE-SUP', title: 'اپراتور/ادمین آموزشی', color: 'bg-amber-500' },
];

const uiRules = [
  { code: 'UI-RULE-01', title: 'تمام Alert ها شیشه‌ای باشند' },
  { code: 'UI-RULE-02', title: 'تمام تایمرها Circular باشند' },
  { code: 'UI-RULE-03', title: 'تمام فونت‌ها فارسی باشند' },
  { code: 'UI-RULE-04', title: 'تمام اعداد فارسی باشند' },
  { code: 'UI-RULE-05', title: 'تمام پنل‌ها Responsive باشند' },
  { code: 'UI-RULE-06', title: 'هیچ منوی سنتی وجود نداشته باشد' },
  { code: 'UI-RULE-07', title: 'تمام پنجره‌ها شناور و Adaptive باشند' },
  { code: 'UI-RULE-08', title: 'Dark Theme پیش‌فرض باشد' },
];

const techStack = [
  { label: 'Frontend', value: 'React + Vite + TypeScript' },
  { label: 'UI', value: 'Tailwind + Glass Morphism' },
  { label: 'Realtime', value: 'Socket.IO' },
  { label: 'Streaming', value: 'WebRTC + mediasoup' },
  { label: 'Backend API', value: 'ASP.NET Core' },
  { label: 'Database', value: 'PostgreSQL' },
  { label: 'Cache', value: 'Redis' },
  { label: 'File Storage', value: 'MinIO' },
  { label: 'Docker', value: 'Docker Compose' },
];

export default function ArchitectureView() {
  const [activeTab, setActiveTab] = useState<'arch' | 'modules' | 'roles' | 'ui' | 'tech'>('arch');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const doneCount = modules.filter(m => m.status === 'done').length;
  const partialCount = modules.filter(m => m.status === 'partial').length;
  const plannedCount = modules.filter(m => m.status === 'planned').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-white font-bold text-xl">GlassClass Super App</h2>
            <p className="text-white/40 text-xs mt-1">معماری کلان سامانه کلاس‌های آموزشی سبز</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-dark rounded-xl px-3 py-2 text-center">
              <p className="text-emerald-400 font-bold text-lg">{toPersianNum(doneCount)}</p>
              <p className="text-white/30 text-[10px]">کامل</p>
            </div>
            <div className="glass-dark rounded-xl px-3 py-2 text-center">
              <p className="text-amber-400 font-bold text-lg">{toPersianNum(partialCount)}</p>
              <p className="text-white/30 text-[10px]">جزئی</p>
            </div>
            <div className="glass-dark rounded-xl px-3 py-2 text-center">
              <p className="text-gray-400 font-bold text-lg">{toPersianNum(plannedCount)}</p>
              <p className="text-white/30 text-[10px]">برنامه‌ریزی</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { id: 'arch' as const, label: 'معماری استقرار' },
          { id: 'modules' as const, label: 'ماژول‌ها' },
          { id: 'roles' as const, label: 'نقش‌ها' },
          { id: 'ui' as const, label: 'قوانین UI' },
          { id: 'tech' as const, label: 'تکنولوژی' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-indigo-500 text-white' : 'glass-btn text-white/50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Architecture */}
      {activeTab === 'arch' && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FiServer className="text-indigo-400" /> سرویس‌های اصلی سیستم
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {architectureNodes.map(node => (
              <div key={node.code} className="glass-dark rounded-xl p-3 text-center relative overflow-hidden group">
                <div className={`absolute inset-0 bg-gradient-to-br ${node.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center text-white mb-2`}>
                  {node.icon}
                </div>
                <p className="text-white/30 text-[9px] font-mono">{node.code}</p>
                <p className="text-white text-xs mt-1">{node.title}</p>
                <span className={`inline-block mt-2 w-2 h-2 rounded-full ${
                  node.status === 'active' ? 'bg-emerald-400' : node.status === 'partial' ? 'bg-amber-400' : 'bg-gray-500'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      {activeTab === 'modules' && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FiDatabase className="text-cyan-400" /> ماژول‌های اصلی سامانه ({toPersianNum(modules.length)} ماژول)
          </h3>
          <div className="space-y-2">
            {modules.map(mod => (
              <div key={mod.code} className="glass-dark rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedModule(expandedModule === mod.code ? null : mod.code)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-right hover:bg-white/5 transition-all"
                >
                  {mod.features ? (
                    expandedModule === mod.code ? 
                      <FiChevronDown size={14} className="text-white/30" /> : 
                      <FiChevronLeft size={14} className="text-white/30" />
                  ) : <span className="w-3.5" />}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    mod.status === 'done' ? 'bg-emerald-400' : mod.status === 'partial' ? 'bg-amber-400' : 'bg-gray-500'
                  }`} />
                  <span className="text-indigo-400/60 text-[10px] font-mono w-16 flex-shrink-0">{mod.code}</span>
                  <span className="text-white text-sm flex-1">{mod.title}</span>
                  {mod.features && (
                    <span className="text-white/20 text-[10px]">{toPersianNum(mod.features.length)} فیچر</span>
                  )}
                </button>
                {expandedModule === mod.code && mod.features && (
                  <div className="px-4 pb-3 animate-float-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pt-2 border-t border-white/5">
                      {mod.features.map(f => (
                        <div key={f.code} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            f.status === 'done' ? 'bg-emerald-400' : f.status === 'partial' ? 'bg-amber-400' : 'bg-gray-500'
                          }`} />
                          <span className="text-white/30 text-[9px] font-mono w-16">{f.code}</span>
                          <span className="text-white/60 text-xs">{f.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roles */}
      {activeTab === 'roles' && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FiUsers className="text-emerald-400" /> نقش‌های سیستم
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {roles.map(role => (
              <div key={role.code} className="glass-dark rounded-xl p-4 text-center">
                <div className={`w-12 h-12 mx-auto rounded-full ${role.color} flex items-center justify-center mb-2`}>
                  <FiUsers className="text-white" size={20} />
                </div>
                <p className="text-white/30 text-[9px] font-mono">{role.code}</p>
                <p className="text-white text-sm mt-1">{role.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UI Rules */}
      {activeTab === 'ui' && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FiMonitor className="text-purple-400" /> قوانین طراحی UI
          </h3>
          <div className="grid gap-2">
            {uiRules.map(rule => (
              <div key={rule.code} className="glass-dark rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-indigo-400/60 text-[10px] font-mono w-20">{rule.code}</span>
                <span className="text-white/70 text-sm">{rule.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech Stack */}
      {activeTab === 'tech' && (
        <div className="glass rounded-2xl p-5 animate-float-in">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FiCloud className="text-cyan-400" /> تکنولوژی‌های مورد استفاده
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {techStack.map((tech, i) => (
              <div key={i} className="glass-dark rounded-xl px-4 py-3">
                <p className="text-white/40 text-xs">{tech.label}</p>
                <p className="text-white font-medium text-sm mt-1">{tech.value}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/5">
            <h4 className="text-white/60 text-sm mb-3">ساختار Docker پیشنهادی</h4>
            <div className="glass-dark rounded-xl p-4 font-mono text-xs text-white/50" dir="ltr">
              <pre>{`services:
  api:        # ASP.NET Core API
  web:        # React Client  
  socket:     # Socket.IO Server
  mediasoup:  # WebRTC SFU
  postgres:   # Database
  redis:      # Cache & PubSub
  minio:      # File Storage
  nginx:      # Reverse Proxy`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
