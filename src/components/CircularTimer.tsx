import { toPersianNum } from '../utils/persian';

interface CircularTimerProps {
  seconds: number;
  total: number;
  size?: number;
  color?: string;
  label?: string;
}

export default function CircularTimer({ seconds, total, size = 80, color = '#6366f1', label }: CircularTimerProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (seconds / total) : 0;
  const offset = circumference * (1 - progress);
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-sm" style={{ fontSize: size * 0.16 }}>
            {toPersianNum(timeStr)}
          </span>
        </div>
      </div>
      {label && <span className="text-white/50 text-xs">{label}</span>}
    </div>
  );
}
