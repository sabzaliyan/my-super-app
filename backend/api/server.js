/**
 * ═══════════════════════════════════════════════════════════════════
 * GlassClass API Server
 * ═══════════════════════════════════════════════════════════════════
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'glassclass-secret-key-2024';

// ═══════════════════════════════════════════════════════════════════
// PostgreSQL Pool
// ═══════════════════════════════════════════════════════════════════
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: false,
});

// ═══════════════════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════
// Auth Middleware
// ═══════════════════════════════════════════════════════════════════
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'توکن احراز هویت یافت نشد' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'توکن نامعتبر است' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
function generateClassCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = 'CLS-';
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function gregorianToShamsiStr(gY, gM, gD) {
  const gDIM = [0,31,59,90,120,151,181,212,243,273,304,334];
  const gy2 = gM > 2 ? gY + 1 : gY;
  let days = 355666 + 365*gY + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) + gD + gDIM[gM-1];
  let jY = -1595 + 33*Math.floor(days/12053);
  days %= 12053;
  jY += 4*Math.floor(days/1461);
  days %= 1461;
  if (days > 365) { jY += Math.floor((days-1)/365); days = (days-1)%365; }
  let jM, jD;
  if (days < 186) { jM = 1+Math.floor(days/31); jD = 1+(days%31); }
  else { jM = 7+Math.floor((days-186)/30); jD = 1+((days-186)%30); }
  return `${jY}/${String(jM).padStart(2,'0')}/${String(jD).padStart(2,'0')}`;
}

function getTehranShamsiToday() {
  const tehran = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = tehran.split('-').map(Number);
  return gregorianToShamsiStr(y, m, d);
}

function getTehranTimeStr() {
  const t = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false });
  const normalized = (t.length === 5 ? t : t.padStart(5, '0'));
  // Handle midnight edge case: "24:xx" → "00:xx"
  return normalized.startsWith('24') ? '00' + normalized.slice(2) : normalized;
}

// Convert Persian/Arabic digits to Latin digits
function toLatinDigits(str) {
  if (!str) return str;
  return String(str)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - '۰'.charCodeAt(0))
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - '٠'.charCodeAt(0));
}

// Compare two Shamsi date strings "YYYY/MM/DD" — returns negative/0/positive
function shamsiStrCompare(a, b) {
  return a.replace(/\//g,'').localeCompare(b.replace(/\//g,''));
}

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

// ═══════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {}
  res.json({ status: 'ok', service: 'api', db: dbStatus, timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════
// AUTH Routes
// ═══════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { role, code, password } = req.body;

  if (role === 'admin') {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM admins WHERE username = $1 AND deleted_at IS NULL',
        [code]
      );
      const admin = rows[0];
      if (!admin || !bcrypt.compareSync(password, admin.password)) {
        // log failed attempt
        try {
          await pool.query(
            'INSERT INTO admin_audit_logs (admin_id, username, action, ip_address, user_agent, success) VALUES ($1,$2,$3,$4,$5,$6)',
            [admin?.id || null, code, 'login', req.ip, req.headers['user-agent'] || null, false]
          );
        } catch {}
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور مدیریت اشتباه است' });
      }
      const token = jwt.sign({ id: admin.id, role: 'admin', username: admin.username, name: admin.username }, JWT_SECRET, { expiresIn: '24h' });
      // log successful login
      try {
        await pool.query(
          'INSERT INTO admin_audit_logs (admin_id, username, action, ip_address, user_agent, success) VALUES ($1,$2,$3,$4,$5,$6)',
          [admin.id, admin.username, 'login', req.ip, req.headers['user-agent'] || null, true]
        );
      } catch {}
      return res.json({ token, user: { id: admin.id, username: admin.username, name: admin.username, role: 'admin' } });
    } catch (err) {
      console.error('admin login error:', err);
      return res.status(500).json({ error: 'خطای سرور' });
    }
  }

  if (role === 'teacher') {
    try {
      // 1. Check code exists
      const codeRes = await pool.query('SELECT * FROM classes WHERE code = $1 AND deleted_at IS NULL', [code]);
      const cls = codeRes.rows[0];
      if (!cls) return res.status(401).json({ error: 'کد کلاس اشتباه است', field: 'code' });
      // 2. Check password
      if (cls.teacher_password !== password) return res.status(401).json({ error: 'رمز عبور معلم اشتباه است', field: 'password' });
      // 3. Check active
      if (!cls.is_active) return res.status(401).json({ error: 'این کلاس غیرفعال شده است', field: 'schedule' });
      // 4. Check endDate not passed
      const todayShamsi = getTehranShamsiToday();
      if (cls.end_date && shamsiStrCompare(todayShamsi, cls.end_date) > 0) {
        return res.status(401).json({ error: `کلاس‌های شما تا تاریخ ${cls.end_date} مجاز به تشکیل است`, field: 'schedule' });
      }
      // 5. Check current Tehran time within class hours
      const nowTime = getTehranTimeStr();
      const clsStart = toLatinDigits(cls.start_time);
      const clsEnd = toLatinDigits(cls.end_time);
      if (clsStart && clsEnd && (nowTime < clsStart || nowTime > clsEnd)) {
        return res.status(401).json({ error: `ورود خارج از ساعت مجاز است — ساعت کلاس: ${cls.start_time} تا ${cls.end_time}`, field: 'schedule' });
      }
      // Check/create class_live_sessions record
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
      const classEndTime = cls.end_time ? new Date(`${todayDate}T${cls.end_time}:00`) : null;
      const { rows: liveRows } = await pool.query(
        'SELECT * FROM class_live_sessions WHERE class_id=$1 LIMIT 1', [cls.id]
      );
      let sessionId;
      if (liveRows.length > 0) {
        const rec = liveRows[0];
        const recDate = rec.date instanceof Date ? rec.date.toISOString().slice(0,10) : String(rec.date).slice(0,10);
        if (recDate === todayDate) {
          sessionId = rec.id; // same day — reuse
        } else {
          // different day — archive and create new
          await pool.query(
            'INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)',
            [cls.id, rec.date, rec.start_time, rec.end_time]
          );
          await pool.query('DELETE FROM class_live_sessions WHERE id=$1', [rec.id]);
          const { rows: newRows } = await pool.query(
            "INSERT INTO class_live_sessions (class_id, date, start_time, end_time) VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Tehran'),$3) RETURNING id",
            [cls.id, todayDate, classEndTime]
          );
          sessionId = newRows[0].id;
        }
      } else {
        const { rows: newRows } = await pool.query(
          "INSERT INTO class_live_sessions (class_id, date, start_time, end_time) VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Tehran'),$3) RETURNING id",
          [cls.id, todayDate, classEndTime]
        );
        sessionId = newRows[0].id;
      }

      const token = jwt.sign({ classId: cls.id, role: 'teacher', name: cls.teacher_name }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, user: { classId: cls.id, name: cls.teacher_name, role: 'teacher', className: cls.name }, sessionId });
    } catch (err) {
      console.error('teacher login error:', err);
      return res.status(500).json({ error: 'خطای سرور' });
    }
  }

  if (role === 'student') {
    try {
      const clsRes = await pool.query('SELECT * FROM classes WHERE code = $1 AND deleted_at IS NULL', [code]);
      const cls = clsRes.rows[0];
      if (!cls) return res.status(401).json({ error: 'کد کلاس اشتباه است', field: 'code' });
      if (!cls.is_active) return res.status(401).json({ error: 'این کلاس غیرفعال شده است', field: 'schedule' });
      // Check startDate — skip if class is currently live (teacher already started it)
      const { rows: liveCheck } = await pool.query(
        "SELECT id FROM class_live_sessions WHERE class_id=$1 AND end_time > NOW() LIMIT 1", [cls.id]
      );
      if (liveCheck.length === 0) {
        const todayShamsi = getTehranShamsiToday();
        if (cls.start_date && shamsiStrCompare(todayShamsi, cls.start_date) < 0) {
          return res.status(401).json({ error: `کلاس هنوز شروع نشده است — تاریخ شروع: ${cls.start_date}`, field: 'schedule' });
        }
      }

      const stdRes = await pool.query(
        `SELECT s.* FROM students s
         JOIN class_students cs ON cs.student_id = s.id
         WHERE cs.class_id = $1 AND s.password = $2 AND s.deleted_at IS NULL`,
        [cls.id, password]
      );
      const student = stdRes.rows[0];
      if (!student) return res.status(401).json({ error: 'رمز عبور اشتباه است یا در این کلاس ثبت‌نام نشده‌اید', field: 'password' });

      const token = jwt.sign({ studentId: student.id, classId: cls.id, role: 'student', name: student.name }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, isClassLive: liveCheck.length > 0, user: { studentId: student.id, classId: cls.id, name: student.name, role: 'student', className: cls.name } });
    } catch (err) {
      console.error('student login error:', err);
      return res.status(500).json({ error: 'خطای سرور' });
    }
  }

  res.status(400).json({ error: 'نقش نامعتبر' });
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  if (req.user.role === 'student') {
    // is_online حذف شد — وضعیت از student_live_sessions خوانده می‌شود
  }
  if (req.user.role === 'admin') {
    await pool.query(
      'INSERT INTO admin_audit_logs (admin_id, username, action, ip_address, user_agent, success) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, req.user.username, 'logout', req.ip, req.headers['user-agent'] || null, true]
    );
  }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// ADMINS Routes
// ═══════════════════════════════════════════════════════════════════
// Admin dashboard live stats
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    // Live classes count (Table 2)
    const { rows: liveRows } = await pool.query(
      "SELECT COUNT(*) as cnt FROM class_live_sessions WHERE end_time > NOW()"
    );
    // Students currently in a live class (no left_at yet)
    const { rows: attRows } = await pool.query(
      "SELECT COUNT(*) as cnt FROM student_attendance WHERE left_at IS NULL"
    );
    // Online = teachers (1 per live class) + students in attendance
    const liveClasses = parseInt(liveRows[0].cnt);
    const studentsInClass = parseInt(attRows[0].cnt);
    res.json({
      liveClasses,
      onlineCount: liveClasses + studentsInClass,
    });
  } catch (err) { console.error(err); res.status(500).json({ liveClasses: 0, onlineCount: 0 }); }
});

app.get('/api/admins', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const { rows } = await pool.query(
    'SELECT id, username, mobile, created_at, updated_at FROM admins WHERE deleted_at IS NULL ORDER BY created_at'
  );
  res.json(rows);
});

app.post('/api/admins', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const { username, password, mobile } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO admins (username, password, mobile) VALUES ($1, $2, $3) RETURNING id, username, mobile, created_at',
      [username, hashed, mobile || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
    res.status(500).json({ error: 'خطای سرور' });
  }
});

app.put('/api/admins/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const { username, password, mobile } = req.body;
  const updates = [];
  const values = [];
  let i = 1;
  if (username) { updates.push(`username = $${i++}`); values.push(username); }
  if (password) { updates.push(`password = $${i++}`); values.push(bcrypt.hashSync(password, 10)); }
  if (mobile !== undefined) { updates.push(`mobile = $${i++}`); values.push(mobile); }
  if (!updates.length) return res.status(400).json({ error: 'هیچ فیلدی برای بروزرسانی ارسال نشد' });
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING id, username, mobile, created_at, updated_at`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'ادمین یافت نشد' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
    res.status(500).json({ error: 'خطای سرور' });
  }
});

app.delete('/api/admins/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'نمی‌توانید ادمین خودتان را حذف کنید' });
  await pool.query(
    'UPDATE admins SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    [req.params.id]
  );
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// ADMIN AUDIT LOG Routes
// ═══════════════════════════════════════════════════════════════════
app.get('/api/admins/audit-logs', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const limit = parseInt(req.query.limit) || 200;
  const { rows } = await pool.query(
    `SELECT id, admin_id, username, action, ip_address, user_agent, success, created_at
     FROM admin_audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════════
// CLASSES Routes
// ═══════════════════════════════════════════════════════════════════

// تبدیل snake_case دیتابیس → camelCase فرانت
function mapClass(row) {
  return {
    id:              row.id,
    code:            row.code,
    name:            row.name || '',
    teacherName:     row.teacher_name || '',
    teacherPassword: row.teacher_password || '',
    courseName:      row.course_name || '',
    startDate:       row.start_date || '',
    startTime:       row.start_time || '',
    endDate:         row.end_date || '',
    endTime:         row.end_time || '',
    scheduleDays:    row.schedule_days || [],
    capacity:        row.capacity || 5,
    isActive:        row.is_active !== false,
    totalHours:        row.total_hours || 0,
    usedHours:         row.used_hours || 0,
    streamingServerId: row.streaming_server_id || null,
    students:          [],
    sessionHistory:    [],
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

app.get('/api/classes', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COALESCE(json_agg(cs.student_id) FILTER (WHERE cs.student_id IS NOT NULL), '[]') AS student_ids,
        EXISTS(SELECT 1 FROM class_live_sessions ls WHERE ls.class_id=c.id AND ls.end_time > NOW()) AS is_live,
        (SELECT COUNT(*) FROM student_live_sessions sls WHERE sls.class_id=c.id) AS online_student_count,
        (SELECT COUNT(*) FROM session_history sh WHERE sh.class_id=c.id) AS session_count
      FROM classes c
      LEFT JOIN class_students cs ON cs.class_id = c.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows.map(r => ({
      ...mapClass(r),
      students: r.student_ids || [],
      isLive: r.is_live,
      onlineStudentCount: parseInt(r.online_student_count) || 0,
      sessionCount: parseInt(r.session_count) || 0,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

app.get('/api/classes/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM classes WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'کلاس یافت نشد' });
    res.json(mapClass(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

app.post('/api/classes', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  try {
    const { name, teacherName, teacherPassword, courseName, startDate, startTime, endDate, endTime, scheduleDays, capacity, totalHours, isActive, streamingServerId } = req.body;
    const code = generateClassCode();
    const { rows } = await pool.query(
      `INSERT INTO classes (code, name, teacher_name, teacher_password, course_name, start_date, start_time, end_date, end_time, schedule_days, capacity, total_hours, is_active, streaming_server_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [code, name, teacherName, teacherPassword, courseName,
       startDate || '', startTime || '', endDate || '', endTime || '',
       scheduleDays || [], capacity || 5, totalHours || 0, isActive !== false, streamingServerId || null]
    );
    const mapped = mapClass(rows[0]);
    io.emit('class:created', mapped);
    res.status(201).json(mapped);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور: ' + err.message }); }
});

app.put('/api/classes/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  try {
    const { name, teacherName, teacherPassword, courseName, startDate, startTime, endDate, endTime, scheduleDays, capacity, totalHours, isActive, streamingServerId } = req.body;
    const { rows } = await pool.query(
      `UPDATE classes SET
         name=$1, teacher_name=$2, teacher_password=$3, course_name=$4,
         start_date=$5, start_time=$6, end_date=$7, end_time=$8,
         schedule_days=$9, capacity=$10, total_hours=$11, is_active=$12,
         streaming_server_id=$13, updated_at=NOW()
       WHERE id=$14 AND deleted_at IS NULL RETURNING *`,
      [name, teacherName, teacherPassword, courseName,
       startDate || '', startTime || '', endDate || '', endTime || '',
       scheduleDays || [], capacity || 5, totalHours || 0,
       isActive !== undefined ? isActive : true, streamingServerId || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'کلاس یافت نشد' });
    const mapped = mapClass(rows[0]);
    io.emit('class:updated', mapped);
    res.json(mapped);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور: ' + err.message }); }
});

app.delete('/api/classes/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  try {
    await pool.query('UPDATE classes SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [req.params.id]);
    io.emit('class:deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

app.patch('/api/classes/:id/toggle-active', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE classes SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'کلاس یافت نشد' });
    const mapped = mapClass(rows[0]);
    io.emit('class:updated', mapped);
    res.json(mapped);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ═══════════════════════════════════════════════════════════════════
// STUDENTS Routes
// ═══════════════════════════════════════════════════════════════════
app.get('/api/students', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.*,
      EXISTS(SELECT 1 FROM student_live_sessions sls WHERE sls.student_id=s.id) AS is_online
    FROM students s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC
  `);
  res.json(rows);
});

app.get('/api/classes/:classId/students', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*,
      EXISTS(SELECT 1 FROM student_live_sessions sls WHERE sls.student_id=s.id AND sls.class_id=$1) AS is_online
     FROM students s
     JOIN class_students cs ON cs.student_id = s.id
     WHERE cs.class_id = $1 AND s.deleted_at IS NULL`,
    [req.params.classId]
  );
  res.json(rows);
});

app.post('/api/students', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  const password = generatePassword();
  const { rows } = await pool.query(
    'INSERT INTO students (name, description, password) VALUES ($1,$2,$3) RETURNING *',
    [name, description || null, password]
  );
  io.emit('student:created', rows[0]);
  res.status(201).json(rows[0]);
});

app.post('/api/classes/:classId/students', authMiddleware, async (req, res) => {
  const { studentIds } = req.body;
  for (const sid of studentIds) {
    await pool.query(
      'INSERT INTO class_students (class_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.classId, sid]
    );
  }
  const { rows } = await pool.query('SELECT * FROM classes WHERE id=$1', [req.params.classId]);
  io.emit('class:updated', rows[0]);
  res.json({ success: true });
});

app.delete('/api/classes/:classId/students/:studentId', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM class_students WHERE class_id=$1 AND student_id=$2', [req.params.classId, req.params.studentId]);
    io.emit('student:removed', { classId: req.params.classId, studentId: req.params.studentId });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور: ' + err.message }); }
});

app.put('/api/students/:id', authMiddleware, async (req, res) => {
  const { name, description, password } = req.body;
  const updates = [];
  const values = [];
  let i = 1;
  if (name) { updates.push(`name=$${i++}`); values.push(name); }
  if (description !== undefined) { updates.push(`description=$${i++}`); values.push(description); }
  if (password) { updates.push(`password=$${i++}`); values.push(password); }
  updates.push('updated_at=NOW()');
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE students SET ${updates.join(',')} WHERE id=$${i} AND deleted_at IS NULL RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'دانش‌آموز یافت نشد' });
  io.emit('student:updated', rows[0]);
  res.json(rows[0]);
});

app.delete('/api/students/:id', authMiddleware, async (req, res) => {
  await pool.query('UPDATE students SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [req.params.id]);
  io.emit('student:deleted', { id: req.params.id });
  res.json({ success: true });
});

app.post('/api/classes/:classId/kick/:studentId', authMiddleware, async (req, res) => {
  const { classId, studentId } = req.params;
  const reason = req.body.reason || 'بدون دلیل';
  const teacherName = req.user.name || req.user.username || 'معلم';
  await pool.query(
    'INSERT INTO kick_logs (class_id, student_id, teacher_name, reason) VALUES ($1,$2,$3,$4)',
    [classId, studentId, teacherName, reason]
  );
  await pool.query('DELETE FROM class_students WHERE class_id=$1 AND student_id=$2', [classId, studentId]);
  await pool.query('UPDATE students SET is_online=FALSE, updated_at=NOW() WHERE id=$1', [studentId]);
  io.to(`class:${classId}`).emit('student:kicked', { studentId, reason });
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// SESSION Routes
// ═══════════════════════════════════════════════════════════════════

// Helper: build a TIMESTAMP for today + a time string like '18:30'
function todayAtTime(timeStr, dateStr) {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`);
}

// Helper: archive class_live_sessions row → session_history
async function archiveClassSession(live, classId) {
  await pool.query(
    'INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)',
    [classId, live.date, live.start_time, live.end_time]
  );
  await pool.query('DELETE FROM class_live_sessions WHERE id=$1', [live.id]);
}

// Helper: archive student_live_sessions row → student_attendance
async function archiveStudentSession(sls) {
  await pool.query(
    'INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
    [sls.class_id, sls.date, sls.start_time, sls.end_time, sls.student_id]
  );
  await pool.query('DELETE FROM student_live_sessions WHERE id=$1', [sls.id]);
}

// POST /api/classes/:classId/sessions/start  — teacher starts class
app.post('/api/classes/:classId/sessions/start', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const classId = req.params.classId;
  try {
    const { rows: clsRows } = await pool.query('SELECT * FROM classes WHERE id=$1', [classId]);
    if (!clsRows.length) return res.status(404).json({ error: 'کلاس یافت نشد' });
    const cls = clsRows[0];

    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
    const classEndTime = todayAtTime(cls.end_time, todayDate); // e.g. 18:30 today

    const { rows: existing } = await pool.query(
      'SELECT * FROM class_live_sessions WHERE class_id=$1 LIMIT 1',
      [classId]
    );

    if (existing.length > 0) {
      const rec = existing[0];
      const recDate = rec.date instanceof Date ? rec.date.toISOString().slice(0,10) : String(rec.date);

      if (recDate === todayDate) {
        // Same day — return existing, no new record
        return res.json({ sessionId: rec.id, startTime: rec.start_time, resumed: true });
      }
      // Different day — archive old, create new below
      await archiveClassSession(rec, classId);
    }

    // New record: end_time = scheduled class end time for today
    const { rows } = await pool.query(
      "INSERT INTO class_live_sessions (class_id, date, start_time, end_time) VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Tehran'),$3) RETURNING *",
      [classId, todayDate, classEndTime]
    );
    res.json({ sessionId: rows[0].id, startTime: rows[0].start_time, resumed: false });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/classes/:classId/live  — student checks if class is live
app.get('/api/classes/:classId/live', authMiddleware, async (req, res) => {
  try {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
    const { rows } = await pool.query(
      'SELECT * FROM class_live_sessions WHERE class_id=$1 AND date=$2 LIMIT 1',
      [req.params.classId, todayDate]
    );
    res.json({ isLive: rows.length > 0, sessionId: rows[0]?.id || null, startTime: rows[0]?.start_time || null });
  } catch { res.json({ isLive: false }); }
});

// PUT /api/classes/:classId/sessions/:sessionId/end  — teacher ends class manually
app.put('/api/classes/:classId/sessions/:sessionId/end', authMiddleware, async (req, res) => {
  const { classId, sessionId } = req.params;
  try {
    const { rows: liveRows } = await pool.query(
      'SELECT * FROM class_live_sessions WHERE id=$1 AND class_id=$2 LIMIT 1',
      [sessionId, classId]
    );
    if (!liveRows.length) return res.json({ success: true });
    const live = liveRows[0];
    const endTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));

    // Update used_hours
    const durationMin = Math.round((endTime - new Date(live.start_time)) / 60000);
    if (durationMin > 0) {
      await pool.query(
        'UPDATE classes SET used_hours = COALESCE(used_hours,0) + $1 WHERE id=$2',
        [durationMin / 60, classId]
      );
    }

    // Archive student_live_sessions → student_attendance
    const { rows: slsRows } = await pool.query(
      'SELECT * FROM student_live_sessions WHERE class_id=$1 AND date=$2',
      [classId, live.date]
    );
    for (const sls of slsRows) {
      await pool.query(
        'INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [sls.class_id, sls.date, sls.start_time, endTime, sls.student_id]
      );
    }
    await pool.query('DELETE FROM student_live_sessions WHERE class_id=$1 AND date=$2', [classId, live.date]);

    // Archive class_live_sessions → session_history
    await pool.query(
      'INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)',
      [classId, live.date, live.start_time, endTime]
    );
    await pool.query('DELETE FROM class_live_sessions WHERE id=$1', [sessionId]);

    // Kick all students out via socket
    io.to(`class:${classId}`).emit('class:ended', { classId });
    io.emit('class:online:update', { classId, onlineStudentCount: 0 });

    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// POST /api/classes/:classId/sessions/student-join  — student enters live class
app.post('/api/classes/:classId/sessions/student-join', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'دسترسی غیرمجاز' });
  const classId = req.params.classId;
  try {
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });

    // Check class is live today
    const { rows: liveRows } = await pool.query(
      'SELECT * FROM class_live_sessions WHERE class_id=$1 AND date=$2 LIMIT 1',
      [classId, todayDate]
    );
    if (!liveRows.length) return res.status(403).json({ error: 'کلاس در حال برگزاری نیست' });

    const classEndTime = liveRows[0].end_time; // inherit from class_live_sessions
    const studentId = req.user.studentId || req.user.id;

    // Check existing student session
    const { rows: existingSls } = await pool.query(
      'SELECT * FROM student_live_sessions WHERE class_id=$1 AND student_id=$2 LIMIT 1',
      [classId, studentId]
    );

    if (existingSls.length > 0) {
      const sls = existingSls[0];
      const slsDate = sls.date instanceof Date ? sls.date.toISOString().slice(0,10) : String(sls.date);

      if (slsDate === todayDate) {
        // Same day — return existing
        return res.json({ attendanceId: sls.id });
      }
      // Different day — archive old
      await archiveStudentSession(sls);
    }

    // New student session: end_time = class scheduled end time
    const { rows } = await pool.query(
      "INSERT INTO student_live_sessions (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Tehran'),$3,$4) RETURNING id",
      [classId, todayDate, classEndTime, studentId]
    );
    // Count online students for this class
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM student_live_sessions WHERE class_id=$1', [classId]
    );
    const onlineStudentCount = parseInt(countRows[0].cnt) || 0;

    // Notify teacher (room) and admin (global)
    io.to(`class:${classId}`).emit('student:joined', { studentId, joinTime: new Date().toISOString() });
    io.emit('student:online', { studentId, classId });
    io.emit('class:online:update', { classId, onlineStudentCount });
    res.json({ attendanceId: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// PUT /api/classes/:classId/sessions/student-leave/:attendanceId
app.put('/api/classes/:classId/sessions/student-leave/:attendanceId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM student_live_sessions WHERE id=$1', [req.params.attendanceId]
    );
    if (!rows.length) return res.json({ success: true });
    const sls = rows[0];
    const leaveTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));

    // Archive to student_attendance
    await pool.query(
      'INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [sls.class_id, sls.date, sls.start_time, leaveTime, sls.student_id]
    );
    await pool.query('DELETE FROM student_live_sessions WHERE id=$1', [req.params.attendanceId]);

    // Count remaining online students
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM student_live_sessions WHERE class_id=$1', [sls.class_id]
    );
    const onlineStudentCount = parseInt(countRows[0].cnt) || 0;

    // Notify globally
    io.emit('student:offline', { studentId: sls.student_id, classId: sls.class_id });
    io.emit('class:online:update', { classId: sls.class_id, onlineStudentCount });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/classes/:classId/sessions  — history list
app.get('/api/classes/:classId/sessions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM session_history WHERE class_id=$1 ORDER BY start_time DESC',
      [req.params.classId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// ═══════════════════════════════════════════════════════════════════
// CHAT Routes
// ═══════════════════════════════════════════════════════════════════
app.get('/api/classes/:classId/chat', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM chat_messages WHERE class_id=$1 ORDER BY created_at ASC',
    [req.params.classId]
  );
  res.json(rows);
});

app.post('/api/classes/:classId/chat', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'INSERT INTO chat_messages (class_id, sender_id, sender_name, sender_role, message, message_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.params.classId, req.user.id || req.user.studentId || null, req.user.name || req.user.username, req.user.role, req.body.message, req.body.type || 'text']
  );
  io.to(`class:${req.params.classId}`).emit('chat:message', rows[0]);
  res.status(201).json(rows[0]);
});

// ═══════════════════════════════════════════════════════════════════
// Features Panel APIs
// ═══════════════════════════════════════════════════════════════════

// GET /api/features/live-classes — all currently live classes with student count
app.get('/api/features/live-classes', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cls.id, cls.name, cls.teacher_name, cls.course_name,
             cls.start_time AS scheduled_start, cls.end_time AS scheduled_end,
             live.id AS session_id, live.date, live.start_time, live.end_time,
             (SELECT COUNT(*) FROM student_live_sessions sls WHERE sls.class_id=cls.id) AS online_count
      FROM class_live_sessions live
      JOIN classes cls ON cls.id = live.class_id
      WHERE cls.deleted_at IS NULL
      ORDER BY live.start_time DESC
    `);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/features/live-classes/:classId/students — online students for a class
app.get('/api/features/live-classes/:classId/students', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sls.id AS attendance_id, sls.start_time, sls.date,
             s.id AS student_id, s.name, s.description
      FROM student_live_sessions sls
      JOIN students s ON s.id = sls.student_id
      WHERE sls.class_id = $1
      ORDER BY sls.start_time DESC
    `, [req.params.classId]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/live-students/:attendanceId — force remove student from live
app.delete('/api/features/live-students/:attendanceId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM student_live_sessions WHERE id=$1', [req.params.attendanceId]);
    if (!rows.length) return res.json({ success: true });
    const sls = rows[0];
    const leaveTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    await pool.query(
      'INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [sls.class_id, sls.date, sls.start_time, leaveTime, sls.student_id]
    );
    await pool.query('DELETE FROM student_live_sessions WHERE id=$1', [req.params.attendanceId]);
    const { rows: cnt } = await pool.query('SELECT COUNT(*) AS c FROM student_live_sessions WHERE class_id=$1', [sls.class_id]);
    io.emit('student:offline', { studentId: sls.student_id, classId: sls.class_id });
    io.emit('class:online:update', { classId: sls.class_id, onlineStudentCount: parseInt(cnt[0].c) || 0 });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/features/class-live-sessions — raw table data
app.get('/api/features/class-live-sessions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cls.id, cls.name, cls.teacher_name, cls.course_name,
             live.id AS session_id, live.date, live.start_time, live.end_time
      FROM class_live_sessions live
      JOIN classes cls ON cls.id = live.class_id
      ORDER BY live.date DESC, live.start_time DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/class-live-sessions — clear all (archive first)
app.delete('/api/features/class-live-sessions', authMiddleware, async (req, res) => {
  try {
    const endTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    const { rows } = await pool.query('SELECT * FROM class_live_sessions');
    for (const live of rows) {
      await pool.query('INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)',
        [live.class_id, live.date, live.start_time, endTime]);
      io.to(`class:${live.class_id}`).emit('class:ended', { classId: live.class_id });
      io.emit('class:online:update', { classId: live.class_id, onlineStudentCount: 0 });
    }
    await pool.query('DELETE FROM class_live_sessions');
    res.json({ success: true, archived: rows.length });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/features/student-live-sessions — raw table data
app.get('/api/features/student-live-sessions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sls.id, sls.date, sls.start_time, sls.end_time,
             s.name AS student_name, s.description AS student_desc,
             c.name AS class_name, c.teacher_name
      FROM student_live_sessions sls
      JOIN students s ON s.id = sls.student_id
      JOIN classes c ON c.id = sls.class_id
      ORDER BY sls.date DESC, sls.start_time DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/student-live-sessions — clear all (archive first)
app.delete('/api/features/student-live-sessions', authMiddleware, async (req, res) => {
  try {
    const endTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    const { rows } = await pool.query('SELECT * FROM student_live_sessions');
    for (const sls of rows) {
      await pool.query('INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [sls.class_id, sls.date, sls.start_time, endTime, sls.student_id]);
      io.emit('student:offline', { studentId: sls.student_id, classId: sls.class_id });
    }
    await pool.query('DELETE FROM student_live_sessions');
    res.json({ success: true, archived: rows.length });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/live-classes/:sessionId — force end a live class
app.delete('/api/features/live-classes/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM class_live_sessions WHERE id=$1', [req.params.sessionId]);
    if (!rows.length) return res.json({ success: true });
    const live = rows[0];
    const endTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    // Archive all students first
    const { rows: stds } = await pool.query('SELECT * FROM student_live_sessions WHERE class_id=$1', [live.class_id]);
    for (const sls of stds) {
      await pool.query('INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [sls.class_id, sls.date, sls.start_time, endTime, sls.student_id]);
    }
    await pool.query('DELETE FROM student_live_sessions WHERE class_id=$1', [live.class_id]);
    await pool.query('INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)',
      [live.class_id, live.date, live.start_time, endTime]);
    await pool.query('DELETE FROM class_live_sessions WHERE id=$1', [req.params.sessionId]);
    io.to(`class:${live.class_id}`).emit('class:ended', { classId: live.class_id });
    io.emit('class:online:update', { classId: live.class_id, onlineStudentCount: 0 });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/features/session-history — archived sessions
app.get('/api/features/session-history', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sh.*, c.name AS class_name, c.teacher_name, c.course_name
      FROM session_history sh
      JOIN classes c ON c.id = sh.class_id
      ORDER BY sh.date DESC, sh.start_time DESC
    `);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/session-history/:id — delete single record
app.delete('/api/features/session-history/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM session_history WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/session-history — clear all session history
app.delete('/api/features/session-history', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM session_history');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// GET /api/features/student-attendance — archived student attendance
app.get('/api/features/student-attendance', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sa.*, s.name AS student_name, s.description AS student_desc,
             c.name AS class_name, c.teacher_name
      FROM student_attendance sa
      JOIN students s ON s.id = sa.student_id
      JOIN classes c ON c.id = sa.class_id
      ORDER BY sa.date DESC, sa.start_time DESC
    `);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/student-attendance/:id — delete single record
app.delete('/api/features/student-attendance/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM student_attendance WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// DELETE /api/features/student-attendance — clear all student attendance
app.delete('/api/features/student-attendance', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM student_attendance');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ═══════════════════════════════════════════════════════════════════
// Socket.IO
// ═══════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  socket.on('join:class', async ({ classId, userId, role }) => {
    socket.join(`class:${classId}`);
    if (role === 'student') {
      io.to(`class:${classId}`).emit('student:online', { studentId: userId });
    }
  });

  socket.on('leave:class', async ({ classId, userId, role }) => {
    socket.leave(`class:${classId}`);
    if (role === 'student') {
      io.to(`class:${classId}`).emit('student:offline', { studentId: userId });
    }
  });

  socket.on('speak:request', ({ classId, studentId, studentName }) => {
    io.to(`class:${classId}`).emit('speak:request', { studentId, studentName, timestamp: new Date().toISOString() });
  });

  socket.on('speak:approve', ({ classId, studentId }) => {
    io.to(`class:${classId}`).emit('speak:approved', { studentId });
  });

  socket.on('speak:reject', ({ classId, studentId }) => {
    io.to(`class:${classId}`).emit('speak:rejected', { studentId });
  });

  socket.on('class:start', ({ classId }) => {
    io.to(`class:${classId}`).emit('class:started', { timestamp: new Date().toISOString() });
  });

  socket.on('class:end', ({ classId }) => {
    io.to(`class:${classId}`).emit('class:ended', { timestamp: new Date().toISOString() });
  });

  // Stream layout sync: teacher → all students in room
  socket.on('stream:layout', ({ classId, activeItems, mediaItems }) => {
    socket.to(`class:${classId}`).emit('stream:layout', { activeItems, mediaItems });
  });

  // WebRTC signaling relay (per-student peer connections)
  socket.on('webrtc:request', ({ classId }) => {
    // Include requester's socketId so teacher can create a dedicated PC for this student
    socket.to(`class:${classId}`).emit('webrtc:request', { studentSocketId: socket.id });
  });
  socket.on('webrtc:offer', ({ classId, offer, targetSocketId }) => {
    if (targetSocketId) {
      // Send offer to a specific student socket
      io.to(targetSocketId).emit('webrtc:offer', { offer });
    } else {
      socket.to(`class:${classId}`).emit('webrtc:offer', { offer });
    }
  });
  socket.on('webrtc:answer', ({ classId, answer }) => {
    // Include answerer's socketId so teacher routes it to the right PC
    socket.to(`class:${classId}`).emit('webrtc:answer', { answer, studentSocketId: socket.id });
  });
  socket.on('webrtc:ice', ({ classId, candidate, role, targetSocketId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:ice', { candidate, role });
    } else {
      socket.to(`class:${classId}`).emit('webrtc:ice', { candidate, role, studentSocketId: socket.id });
    }
  });

  // Student → Teacher WebRTC relay
  socket.on('webrtc:student-offer', ({ classId, offer, studentId }) => {
    socket.to(`class:${classId}`).emit('webrtc:student-offer', { offer, studentId });
  });
  socket.on('webrtc:student-answer', ({ classId, answer, studentId }) => {
    socket.to(`class:${classId}`).emit('webrtc:student-answer', { answer, studentId });
  });
  socket.on('webrtc:student-ice', ({ classId, candidate, studentId }) => {
    socket.to(`class:${classId}`).emit('webrtc:student-ice', { candidate, studentId });
  });

  // Auto-archive stale student sessions when teacher disconnects
  socket.on('disconnect', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const cutoffDate = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
      // Archive student_live_sessions older than today
      const { rows: staleStudents } = await pool.query(
        'SELECT * FROM student_live_sessions WHERE date < $1', [cutoffDate]
      );
      for (const sls of staleStudents) {
        await pool.query(
          'INSERT INTO student_attendance (class_id, date, start_time, end_time, student_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [sls.class_id, sls.date, sls.start_time, sls.end_time, sls.student_id]
        );
      }
      if (staleStudents.length > 0) {
        await pool.query('DELETE FROM student_live_sessions WHERE date < $1', [cutoffDate]);
      }
      // Archive class_live_sessions older than today
      const { rows: staleClasses } = await pool.query(
        'SELECT * FROM class_live_sessions WHERE date < $1', [cutoffDate]
      );
      for (const cls of staleClasses) {
        await pool.query(
          'INSERT INTO session_history (class_id, date, start_time, end_time) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [cls.class_id, cls.date, cls.start_time, cls.end_time]
        );
      }
      if (staleClasses.length > 0) {
        await pool.query('DELETE FROM class_live_sessions WHERE date < $1', [cutoffDate]);
      }
    } catch {}
  });
});

// ═══════════════════════════════════════════════════════════════════
// Startup: connect DB → create tables → seed default admin
// ═══════════════════════════════════════════════════════════════════
async function bootstrap() {
  // wait for postgres to be ready (retry up to 30 times, 2s apart)
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ PostgreSQL connected');
      break;
    } catch (err) {
      if (attempt === 30) { console.error('❌ PostgreSQL unreachable after 30 attempts'); process.exit(1); }
      console.log(`⏳ Waiting for PostgreSQL... (${attempt}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // create tables (idempotent)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username   VARCHAR(100) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      mobile     VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP DEFAULT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code             VARCHAR(20) UNIQUE NOT NULL,
      name             VARCHAR(200) NOT NULL,
      teacher_name     VARCHAR(200) NOT NULL,
      teacher_password VARCHAR(100) NOT NULL,
      course_name      VARCHAR(200) NOT NULL,
      start_date       TEXT NOT NULL DEFAULT '',
      start_time       TEXT NOT NULL DEFAULT '',
      end_date         TEXT NOT NULL DEFAULT '',
      end_time         TEXT NOT NULL DEFAULT '',
      schedule_days    TEXT[] DEFAULT '{}',
      capacity         INTEGER DEFAULT 30,
      is_active        BOOLEAN DEFAULT TRUE,
      total_hours      INTEGER DEFAULT 40,
      used_hours       INTEGER DEFAULT 0,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at       TIMESTAMP DEFAULT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name           VARCHAR(200) NOT NULL,
      description    TEXT,
      password       VARCHAR(100) NOT NULL,
      is_online      BOOLEAN DEFAULT FALSE,
      camera_enabled BOOLEAN DEFAULT FALSE,
      mic_enabled    BOOLEAN DEFAULT FALSE,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at     TIMESTAMP DEFAULT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_students (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
      student_id UUID REFERENCES students(id) ON DELETE CASCADE,
      joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, student_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_history (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
      start_time TIMESTAMP NOT NULL,
      end_time   TIMESTAMP,
      duration   INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
      sender_id    UUID,
      sender_name  VARCHAR(200) NOT NULL,
      sender_role  VARCHAR(20) NOT NULL,
      message      TEXT NOT NULL,
      message_type VARCHAR(20) DEFAULT 'text',
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kick_logs (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
      student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
      teacher_name VARCHAR(200) NOT NULL,
      reason       TEXT,
      kicked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
      username    VARCHAR(100) NOT NULL,
      action      VARCHAR(20) NOT NULL CHECK (action IN ('login','logout')),
      ip_address  VARCHAR(64),
      user_agent  TEXT,
      success     BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_time  ON admin_audit_logs(created_at DESC)`);

  // ── migrations: add missing columns to existing tables ──────────
  const migrations = [
    `ALTER TABLE classes  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP DEFAULT NULL`,
    `ALTER TABLE classes  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE classes ALTER COLUMN start_date TYPE TEXT USING start_date::TEXT`,
    `ALTER TABLE classes ALTER COLUMN start_time TYPE TEXT USING start_time::TEXT`,
    `ALTER TABLE classes ALTER COLUMN end_date   TYPE TEXT USING end_date::TEXT`,
    `ALTER TABLE classes ALTER COLUMN end_time   TYPE TEXT USING end_time::TEXT`,
    `ALTER TABLE classes ALTER COLUMN start_date DROP NOT NULL`,
    `ALTER TABLE classes ALTER COLUMN start_time DROP NOT NULL`,
    `ALTER TABLE classes ALTER COLUMN end_date   DROP NOT NULL`,
    `ALTER TABLE classes ALTER COLUMN end_time   DROP NOT NULL`,
    `ALTER TABLE classes ALTER COLUMN start_date SET DEFAULT ''`,
    `ALTER TABLE classes ALTER COLUMN start_time SET DEFAULT ''`,
    `ALTER TABLE classes ALTER COLUMN end_date   SET DEFAULT ''`,
    `ALTER TABLE classes ALTER COLUMN end_time   SET DEFAULT ''`,
    `ALTER TABLE classes ADD COLUMN IF NOT EXISTS streaming_server_id TEXT DEFAULT NULL`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP DEFAULT NULL`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS mic_enabled    BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE classes  ADD COLUMN IF NOT EXISTS used_hours NUMERIC DEFAULT 0`,
    `ALTER TABLE session_history ADD COLUMN IF NOT EXISTS date TEXT`,
  ];
  for (const m of migrations) {
    try { await pool.query(m); } catch {}
  }
  console.log('✅ Migrations applied');

  // seed default admin if table is empty
  const { rows } = await pool.query('SELECT COUNT(*) FROM admins WHERE deleted_at IS NULL');
  if (parseInt(rows[0].count) === 0) {
    const hashed = bcrypt.hashSync('123456', 10);
    await pool.query(
      'INSERT INTO admins (username, password) VALUES ($1, $2)',
      ['saam', hashed]
    );
    console.log('✅ Default admin created: saam / 123456');
  } else {
    console.log(`✅ Admins table has ${rows[0].count} record(s) — skipping seed`);
  }

  httpServer.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                                                                   ║
  ║   GlassClass API Server                                           ║
  ║                                                                   ║
  ║   Port   : ${PORT}                                                   ║
  ║   Health : http://localhost:${PORT}/health                           ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
    `);
  });
}

bootstrap();



