import { useAppStore } from '../store/appStore';
import GlassAlert from './GlassAlert';

export default function AlertContainer() {
  const { alerts, removeAlert } = useAppStore();
  
  if (alerts.length === 0) return null;
  
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 items-center">
      {alerts.map(alert => (
        <GlassAlert
          key={alert.id}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          duration={alert.duration || 5000}
          showTimer={alert.showTimer}
          onClose={() => removeAlert(alert.id)}
        />
      ))}
    </div>
  );
}
