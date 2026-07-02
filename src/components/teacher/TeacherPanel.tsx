import { useAppStore } from '../../store/appStore';
import TeacherPreClass from './TeacherPreClass';
import TeacherLiveClass from './TeacherLiveClass';

export default function TeacherPanel() {
  const { isClassLive, activeClassId, classes } = useAppStore();
  const cls = classes.find(c => c.id === activeClassId);
  
  if (!cls) return <div className="min-h-screen flex items-center justify-center text-white">کلاس یافت نشد</div>;

  if (!isClassLive) {
    return <TeacherPreClass classData={cls} />;
  }

  return <TeacherLiveClass classData={cls} />;
}
