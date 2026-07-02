import { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiInfo, FiX } from 'react-icons/fi';
import { toPersianNum } from '../utils/persian';

interface GlassAlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  showTimer?: boolean;
  onClose: () => void;
}

export default function GlassAlert({ type, title, message, duration = 5000, showTimer = false, onClose }: GlassAlertProps) {
  const [timeLeft, setTimeLeft] = useState(duration / 1000);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            onClose();
            return 0;
          }
          return prev - 0.1;
        });
        setProgress(prev => {
          const step = (100 / (duration / 100));
          return Math.max(0, prev - step);
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [duration, onClose]);

  const icons = {
    success: <FiCheckCircle className="text-emerald-400" size={24} />,
    error: <FiXCircle className="text-red-400" size={24} />,
    warning: <FiAlertTriangle className="text-amber-400" size={24} />,
    info: <FiInfo className="text-blue-400" size={24} />,
  };

  const borders = {
    success: 'border-emerald-400/30',
    error: 'border-red-400/30',
    warning: 'border-amber-400/30',
    info: 'border-blue-400/30',
  };

  return (
    <div className={`glass-alert rounded-2xl p-4 min-w-[300px] max-w-[420px] animate-float-in ${borders[type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm">{title}</h4>
          <p className="text-white/70 text-xs mt-1 leading-relaxed">{message}</p>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <FiX size={18} />
        </button>
      </div>
      
      {showTimer && (
        <div className="flex items-center gap-3 mt-3">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1'}
                strokeWidth="2"
                strokeDasharray="94.2"
                strokeDashoffset={94.2 * (1 - progress / 100)}
                strokeLinecap="round"
                className="transition-all duration-100"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              {toPersianNum(Math.ceil(timeLeft))}
            </span>
          </div>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
