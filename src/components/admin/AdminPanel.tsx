import { useState, useEffect, useRef } from 'react';
import { FiGrid, FiSettings, FiLogOut, FiBook, FiUserPlus, FiLayers, FiShield, FiZap } from 'react-icons/fi';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi, getPersianWeekDay, getPersianTime } from '../../utils/persian';
import ClassManagement from './ClassManagement';
import AdminSettings from './AdminSettings';
import ArchitectureView from './ArchitectureView';
import AdminsManagement from './AdminsManagement';
import FeaturesPanel from './FeaturesPanel';

type Tab = 'classes' | 'admins' | 'features' | 'architecture' | 'settings';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('classes');
  const [now, setNow] = useState(new Date());
  const { currentUser, logout, classes, students } = useAppStore();
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll active tab into view when tab changes
  useEffect(() => {
    const btn = activeTabRef.current;
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    const btnLeft = btn.offsetLeft;
    const btnWidth = btn.offsetWidth;
    const barWidth = bar.offsetWidth;
    const target = btnLeft - barWidth / 2 + btnWidth / 2;
    bar.scrollTo({ left: target, behavior: 'smooth' });
  }, [activeTab]);

  const tabs = [
    { id: 'classes' as Tab, icon: <FiBook size={18} />, label: 'مدیریت کلاس‌ها', count: classes.length },
    { id: 'admins' as Tab, icon: <FiShield size={18} />, label: 'مدیران سامانه' },
    { id: 'features' as Tab, icon: <FiZap size={18} />, label: 'امکانات' },
    { id: 'architecture' as Tab, icon: <FiLayers size={18} />, label: 'معماری سامانه' },
    { id: 'settings' as Tab, icon: <FiSettings size={18} />, label: 'تنظیمات' },
  ];

  const activeClasses = classes.filter(c => c.isActive).length;
  const liveClasses = classes.filter(c => c.isLive).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Bar 1 */}
      <div className="glass border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Right: Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FiGrid size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">سامانه کلاس‌های آموزشی سبز</h1>
              <p className="text-white/30 text-[10px] leading-tight">G-Online-Edu-App</p>
              <p className="text-white/20 text-[10px] leading-tight">نسخه {toPersianNum('1.0.0')}</p>
            </div>
          </div>

          {/* Center: Stats */}
          <div className="flex items-center gap-4 text-center">
            <div className="glass-dark rounded-xl px-4 py-2">
              <div className="flex items-center gap-4 text-xs text-white/70">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span>آنلاین: {toPersianNum(liveClasses)}</span>
                </div>
                <div>کلاس فعال: {toPersianNum(activeClasses)}</div>
                <div className="flex items-center gap-1">
                  <FiUserPlus size={12} />
                  <span>کل دانش‌آموزان: {toPersianNum(students.length)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Left: Date & User */}
          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-white/60 text-xs">{toShamsi(now)}</p>
              <p className="text-white/40 text-[10px]">{getPersianWeekDay(now)}</p>
              <p className="text-white/50 text-xs font-mono">{getPersianTime(now)}</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs">{currentUser}</span>
              <button onClick={logout} className="glass-btn rounded-lg p-2 text-red-400 hover:text-red-300" title="خروج">
                <FiLogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="glass-dark border-b border-white/5">
        <div
          ref={tabBarRef}
          className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              ref={activeTab === tab.id ? activeTabRef : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white border-b-2 border-indigo-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="bg-white/10 text-white/60 rounded-full px-2 py-0.5 text-[10px]">
                  {toPersianNum(tab.count)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'classes' && <ClassManagement />}
        {activeTab === 'admins' && <AdminsManagement />}
        {activeTab === 'features' && <FeaturesPanel />}
        {activeTab === 'architecture' && <ArchitectureView />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
}
