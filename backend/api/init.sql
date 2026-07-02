-- ═══════════════════════════════════════════════════════════════════
-- GlassClass Database Schema
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════
-- Admins Table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admins (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    mobile      VARCHAR(20),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP DEFAULT NULL
);

-- ═══════════════════════════════════════════════════════════════════
-- Classes Table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS classes (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code             VARCHAR(20) UNIQUE NOT NULL,
    name             VARCHAR(200) NOT NULL,
    teacher_name     VARCHAR(200) NOT NULL,
    teacher_password VARCHAR(100) NOT NULL,
    course_name      VARCHAR(200) NOT NULL,
    start_date       DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_date         DATE NOT NULL,
    end_time         TIME NOT NULL,
    schedule_days    TEXT[] DEFAULT '{}',
    capacity         INTEGER DEFAULT 30,
    is_active        BOOLEAN DEFAULT TRUE,
    total_hours      INTEGER DEFAULT 40,
    used_hours       INTEGER DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMP DEFAULT NULL
);

-- ═══════════════════════════════════════════════════════════════════
-- Students Table
-- ═══════════════════════════════════════════════════════════════════
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
);

-- ═══════════════════════════════════════════════════════════════════
-- Class-Student Relationship
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS class_students (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- Table 2: Currently Live Sessions
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS class_live_sessions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    started_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    session_date DATE NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'active',
    started_by   VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_active ON class_live_sessions(class_id) WHERE status='active';

-- ═══════════════════════════════════════════════════════════════════
-- Table 3: Completed Session History
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS session_history (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
    start_time   TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at     TIMESTAMP,
    duration_min INTEGER DEFAULT 0,
    ended_by     VARCHAR(50) DEFAULT 'teacher',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════
-- Student Attendance
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_attendance (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id     UUID NOT NULL,
    student_id   UUID,
    student_name VARCHAR(200),
    joined_at    TIMESTAMPTZ DEFAULT NOW(),
    left_at      TIMESTAMPTZ,
    duration_min INTEGER DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════════
-- Chat Messages
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
    sender_id    UUID,
    sender_name  VARCHAR(200) NOT NULL,
    sender_role  VARCHAR(20) NOT NULL,
    message      TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════
-- Kick Logs
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kick_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_name VARCHAR(200) NOT NULL,
    reason       TEXT,
    kicked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_admins_username     ON admins(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_code        ON classes(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_active      ON classes(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_online     ON students(is_online) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_class_students_cls  ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_class ON chat_messages(class_id);
