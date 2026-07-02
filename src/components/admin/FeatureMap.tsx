import { FiChevronDown, FiChevronLeft, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi';
import { useState } from 'react';
import { toPersianNum } from '../../utils/persian';

interface Feature {
  code: string;
  title: string;
  status: 'done' | 'partial' | 'planned';
  children?: Feature[];
}

// Teacher Panel Bars
const teacherPanelBars: Feature[] = [
  { code: 'BAR-01', title: 'هدر اصلی', status: 'done', children: [
    { code: 'HDR-01', title: 'نام سامانه', status: 'done' },
    { code: 'HDR-02', title: 'نسخه', status: 'done' },
    { code: 'HDR-03', title: 'تایمر کلاس', status: 'done' },
    { code: 'HDR-04', title: 'تعداد آنلاین', status: 'done' },
    { code: 'HDR-05', title: 'نام کلاس', status: 'done' },
    { code: 'HDR-06', title: 'نام معلم', status: 'done' },
    { code: 'HDR-07', title: 'تاریخ شمسی', status: 'done' },
    { code: 'HDR-08', title: 'ساعت تهران', status: 'done' },
    { code: 'HDR-09', title: 'دعوت', status: 'done' },
    { code: 'HDR-10', title: 'پایان کلاس', status: 'done' },
  ]},
  { code: 'BAR-02', title: 'نوار ابزار دوم', status: 'done', children: [
    { code: 'TOOL-ADD-YOUTUBE', title: 'افزودن یوتیوب', status: 'done' },
    { code: 'TOOL-ADD-VIDEO', title: 'افزودن ویدیو', status: 'done' },
    { code: 'TOOL-ADD-SCREEN', title: 'اشتراک صفحه', status: 'partial' },
    { code: 'TOOL-ADD-SLIDE', title: 'افزودن اسلاید', status: 'done' },
    { code: 'TOOL-ADD-AUDIO', title: 'افزودن صوت', status: 'done' },
    { code: 'TOOL-ADD-WHITEBOARD', title: 'وایت‌برد', status: 'done' },
    { code: 'TOOL-CHAT-TOGGLE', title: 'باز/بستن چت', status: 'done' },
    { code: 'TOOL-VOICE-TOGGLE', title: 'باز/بستن صحبت', status: 'done' },
    { code: 'TOOL-RECORD', title: 'رکورد', status: 'partial' },
    { code: 'TOOL-TIMER', title: 'تایمر', status: 'done' },
  ]},
  { code: 'BAR-03', title: 'ستون درخواست صحبت', status: 'done', children: [
    { code: 'SPEAK-LIST', title: 'لیست درخواست‌ها', status: 'done' },
    { code: 'SPEAK-APPROVE', title: 'تأیید درخواست', status: 'done' },
    { code: 'SPEAK-REJECT', title: 'رد درخواست', status: 'done' },
    { code: 'SPEAK-CLEAR', title: 'بستن همه', status: 'done' },
  ]},
  { code: 'BAR-04', title: 'قاب استریم', status: 'done', children: [
    { code: 'LYT-01', title: 'تک تصویر', status: 'done' },
    { code: 'LYT-02', title: 'دو تصویر', status: 'done' },
    { code: 'LYT-03', title: 'سه تصویر', status: 'done' },
    { code: 'LYT-04', title: 'چهار تصویر', status: 'done' },
    { code: 'LYT-09', title: 'نه تصویر', status: 'done' },
    { code: 'LYT-16', title: 'شانزده تصویر', status: 'done' },
    { code: 'LYT-ALL', title: 'همه', status: 'done' },
    { code: 'STR-PAGINATION', title: 'صفحه‌بندی', status: 'done' },
    { code: 'STR-ROTATE', title: 'چرخش خودکار', status: 'done' },
  ]},
  { code: 'BAR-05', title: 'چت', status: 'done', children: [
    { code: 'CHAT-01', title: 'پیام متنی', status: 'done' },
    { code: 'CHAT-02', title: 'استیکر', status: 'partial' },
    { code: 'CHAT-03', title: 'ثبت رویدادها', status: 'done' },
    { code: 'CHAT-04', title: 'ذخیره PDF', status: 'partial' },
  ]},
  { code: 'BAR-06', title: 'نوار تایل‌ها', status: 'done', children: [
    { code: 'TILE-TCH', title: 'دوربین معلم', status: 'done' },
    { code: 'TILE-STU', title: 'دانش‌آموز', status: 'done' },
    { code: 'TILE-YTB', title: 'یوتیوب', status: 'done' },
    { code: 'TILE-VID', title: 'فایل ویدیویی', status: 'done' },
    { code: 'TILE-AUD', title: 'فایل صوتی', status: 'done' },
    { code: 'TILE-SCR', title: 'Screen Share', status: 'partial' },
    { code: 'TILE-WBD', title: 'وایت‌برد', status: 'done' },
    { code: 'TILE-SLD', title: 'اسلاید', status: 'done' },
    { code: 'TILE-ADD', title: 'افزودن به استریم', status: 'done' },
    { code: 'TILE-REMOVE', title: 'حذف', status: 'done' },
    { code: 'TILE-MUTE-AUDIO', title: 'قطع صدا', status: 'done' },
    { code: 'TILE-MUTE-VIDEO', title: 'قطع تصویر', status: 'done' },
    { code: 'TILE-STATUS', title: 'آنلاین/آفلاین', status: 'done' },
    { code: 'TILE-DRAG', title: 'Drag & Drop', status: 'partial' },
  ]},
  { code: 'BAR-07', title: 'نوار ابزار پایانی', status: 'done', children: [
    { code: 'CTRL-MIC', title: 'میکروفون', status: 'done' },
    { code: 'CTRL-SPK', title: 'اسپیکر', status: 'done' },
    { code: 'CTRL-CAM', title: 'دوربین', status: 'done' },
    { code: 'CTRL-SETTINGS', title: 'تنظیمات', status: 'done' },
    { code: 'CTRL-ALL-STU', title: 'همه دانش‌آموزان', status: 'done' },
    { code: 'CTRL-ONLINE-STU', title: 'دانش‌آموزان آنلاین', status: 'done' },
    { code: 'CTRL-OFFLINE-STU', title: 'دانش‌آموزان آفلاین', status: 'done' },
    { code: 'CTRL-ALL-YTB', title: 'همه یوتیوب‌ها', status: 'done' },
    { code: 'CTRL-ALL-VID', title: 'همه ویدیوها', status: 'done' },
    { code: 'CTRL-ALL-AUD', title: 'همه صوت‌ها', status: 'done' },
    { code: 'CTRL-ALL-WBD', title: 'همه وایت‌بردها', status: 'done' },
  ]},
];

// Student Panel Features
const studentPanelFeatures: Feature[] = [
  { code: 'STP-01', title: 'نمایش/مخفی چت', status: 'done' },
  { code: 'STP-02', title: 'دست بلند کردن', status: 'done' },
  { code: 'STP-03', title: 'دوربین شناور', status: 'done' },
  { code: 'STP-04', title: 'تغییر سایز دوربین', status: 'done' },
  { code: 'STP-05', title: 'ارسال فایل', status: 'partial' },
  { code: 'STP-06', title: 'ارسال صوت', status: 'partial' },
  { code: 'STP-07', title: 'ارسال ویدیو', status: 'partial' },
  { code: 'STP-08', title: 'ارسال اسلاید', status: 'partial' },
];

// Kick System
const kickFeatures: Feature[] = [
  { code: 'KICK-01', title: 'اخراج دانش‌آموز', status: 'done' },
  { code: 'KICK-02', title: 'ثبت دلیل', status: 'done' },
  { code: 'KICK-03', title: 'ثبت زمان', status: 'done' },
  { code: 'KICK-04', title: 'ثبت معلم', status: 'done' },
  { code: 'KICK-05', title: 'پیام شیشه‌ای', status: 'done' },
  { code: 'KICK-06', title: 'حذف تایل', status: 'done' },
  { code: 'KICK-07', title: 'بستن پنل', status: 'done' },
];

// Security Features
const securityFeatures: Feature[] = [
  { code: 'SEC-01', title: 'JWT', status: 'planned' },
  { code: 'SEC-02', title: 'Refresh Token', status: 'planned' },
  { code: 'SEC-03', title: 'HTTPS', status: 'planned' },
  { code: 'SEC-04', title: 'Anti DDOS', status: 'planned' },
  { code: 'SEC-05', title: 'Rate Limit', status: 'planned' },
  { code: 'SEC-06', title: 'File Scan', status: 'planned' },
  { code: 'SEC-07', title: 'Session Control', status: 'partial' },
];

// Storage Rules
const storageRules: Feature[] = [
  { code: 'STRG-01', title: 'عدم ذخیره در مرورگر', status: 'done' },
  { code: 'STRG-02', title: 'عدم استفاده LocalStorage', status: 'done' },
  { code: 'STRG-03', title: 'ذخیره فقط روی سرور', status: 'planned' },
  { code: 'STRG-04', title: 'Session Server Side', status: 'planned' },
  { code: 'STRG-05', title: 'رمزنگاری فایل‌ها', status: 'planned' },
];

// AI Features (Future)
const aiFeatures: Feature[] = [
  { code: 'AI-01', title: 'تشخیص غیبت خودکار', status: 'planned' },
  { code: 'AI-02', title: 'خلاصه هوشمند کلاس', status: 'planned' },
  { code: 'AI-03', title: 'تبدیل صوت به متن', status: 'planned' },
  { code: 'AI-04', title: 'زیرنویس زنده', status: 'planned' },
  { code: 'AI-05', title: 'تشخیص چهره', status: 'planned' },
  { code: 'AI-06', title: 'نمره‌دهی هوشمند', status: 'planned' },
  { code: 'AI-07', title: 'تحلیل کیفیت آموزش', status: 'planned' },
  { code: 'AI-08', title: 'مترجم زنده', status: 'planned' },
];

const sections = [
  { title: 'پنل معلم - ساختار ۷ نواری', features: teacherPanelBars },
  { title: 'پنل دانش‌آموز', features: studentPanelFeatures },
  { title: 'سیستم اخراج', features: kickFeatures },
  { title: 'امنیت سامانه', features: securityFeatures },
  { title: 'قوانین ذخیره‌سازی', features: storageRules },
  { title: 'ویژگی‌های AI (نسخه‌های بعدی)', features: aiFeatures },
];

export default function FeatureMap() {
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  // Calculate stats
  const allFeatures: Feature[] = [];
  const collectFeatures = (features: Feature[]) => {
    features.forEach(f => {
      allFeatures.push(f);
      if (f.children) collectFeatures(f.children);
    });
  };
  sections.forEach(s => collectFeatures(s.features));
  
  const doneCount = allFeatures.filter(f => f.status === 'done').length;
  const partialCount = allFeatures.filter(f => f.status === 'partial').length;
  const plannedCount = allFeatures.filter(f => f.status === 'planned').length;
  const total = allFeatures.length;
  const progress = Math.round(((doneCount + partialCount * 0.5) / total) * 100);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">نقشه فیچرها - GlassClass v1</h3>
          <p className="text-white/40 text-xs mt-1">
            کدگذاری کامل تمام ویژگی‌های سامانه ({toPersianNum(total)} فیچر)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><FiCheck size={10} /> {toPersianNum(doneCount)}</span>
            <span className="flex items-center gap-1 text-amber-400"><FiAlertCircle size={10} /> {toPersianNum(partialCount)}</span>
            <span className="flex items-center gap-1 text-gray-400"><FiClock size={10} /> {toPersianNum(plannedCount)}</span>
          </div>
          <div className="glass-dark rounded-full w-24 h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <span className="text-white/60 text-xs font-bold">{toPersianNum(progress)}٪</span>
        </div>
      </div>

      <div className="space-y-2">
        {sections.map((section, idx) => (
          <div key={idx} className="glass-dark rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
              className="w-full px-4 py-3 flex items-center gap-2 text-right hover:bg-white/5 transition-all"
            >
              {expandedSection === idx ? 
                <FiChevronDown size={14} className="text-white/30" /> : 
                <FiChevronLeft size={14} className="text-white/30" />
              }
              <span className="text-white font-semibold text-sm flex-1">{section.title}</span>
              <span className="text-white/30 text-xs">{toPersianNum(section.features.length)} آیتم</span>
            </button>
            {expandedSection === idx && (
              <div className="px-4 pb-3 animate-float-in border-t border-white/5">
                <div className="space-y-1 pt-2">
                  {section.features.map(f => <FeatureNode key={f.code} feature={f} depth={0} />)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureNode({ feature, depth }: { feature: Feature; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const statusColor = feature.status === 'done' ? 'bg-emerald-400' : feature.status === 'partial' ? 'bg-amber-400' : 'bg-gray-500';
  const hasChildren = feature.children && feature.children.length > 0;

  return (
    <div style={{ marginRight: `${depth * 16}px` }}>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`w-full text-right flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {hasChildren ? (
          open ? <FiChevronDown size={10} className="text-white/30" /> : <FiChevronLeft size={10} className="text-white/30" />
        ) : (
          <span className="w-2.5" />
        )}
        <span className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} />
        <span className="text-indigo-400/60 text-[9px] font-mono flex-shrink-0" style={{ width: hasChildren ? '80px' : '100px' }}>{feature.code}</span>
        <span className="text-white/70 text-xs flex-1">{feature.title}</span>
      </button>
      {open && hasChildren && (
        <div className="animate-float-in">
          {feature.children!.map(child => <FeatureNode key={child.code} feature={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
