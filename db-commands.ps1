# ═══════════════════════════════════════════════════════════════
# GlassClass — دستورات مدیریت پایگاه داده و Docker
# ═══════════════════════════════════════════════════════════════

# ── وضعیت containers ──────────────────────────────────────────
# نمایش وضعیت تمام containers (باید healthy باشد)
docker ps --format "{{.Names}} {{.Status}}"

# ── راه‌اندازی / ری‌استارت ────────────────────────────────────
# اجرای تمام سرویس‌ها
docker compose up -d

# فقط API را راه‌اندازی کن
docker compose up -d api

# rebuild کامل API (بعد از تغییر کد)
docker compose build api; docker compose up -d api

# ── لاگ‌ها ────────────────────────────────────────────────────
# لاگ‌های API (۳۰ خط آخر)
docker logs Online-education-api-1 --tail 30

# لاگ‌های API به صورت زنده (follow)
docker logs Online-education-api-1 -f

# ── وضعیت ۴ جدول session ──────────────────────────────────────
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "
SELECT 'class_live_sessions' as tbl, COUNT(*) FROM class_live_sessions
UNION ALL SELECT 'student_live_sessions', COUNT(*) FROM student_live_sessions
UNION ALL SELECT 'session_history', COUNT(*) FROM session_history
UNION ALL SELECT 'student_attendance', COUNT(*) FROM student_attendance;"

# ── مشاهده جزئیات ─────────────────────────────────────────────
# جزئیات کلاس‌های فعال
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "SELECT class_id, date, start_time, end_time FROM class_live_sessions;"

# جزئیات دانش‌آموزان آنلاین
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "SELECT class_id, date, start_time, end_time, student_id FROM student_live_sessions;"

# تاریخچه جلسات
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "SELECT class_id, date, start_time, end_time FROM session_history ORDER BY start_time DESC;"

# حضور و غیاب دانش‌آموزان
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "SELECT class_id, date, start_time, end_time, student_id FROM student_attendance ORDER BY start_time DESC;"

# ── پاک کردن ──────────────────────────────────────────────────
# پاک کردن ۴ جدول session (برای شروع تست تازه)
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "TRUNCATE class_live_sessions, student_live_sessions, session_history, student_attendance CASCADE;"

# ── وضعیت دانش‌آموزان آنلاین ──────────────────────────────────
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "SELECT name, is_online FROM students WHERE deleted_at IS NULL ORDER BY is_online DESC, name;"

# ── ریست is_online همه دانش‌آموزان (بعد از restart) ───────────
docker exec Online-education-api-db-1 psql -U glassclass -d glassclass -c "UPDATE students SET is_online = FALSE;"
