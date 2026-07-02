# 🐳 راهنمای نصب و اجرای Docker در ویندوز

## 📋 پیش‌نیازها

### ۱. نصب Docker Desktop

1. به آدرس زیر بروید:
   ```
   https://www.docker.com/products/docker-desktop/
   ```

2. نسخه Windows را دانلود و نصب کنید

3. پس از نصب، کامپیوتر را Restart کنید

4. Docker Desktop را اجرا کنید و منتظر بمانید تا سبز شود

### ۲. بررسی نصب صحیح

در PowerShell یا CMD اجرا کنید:

```powershell
docker --version
docker-compose --version
```

---

## 🚀 اجرای سرویس‌ها

### روش ۱: اجرای سریع (توصیه شده)

در پوشه پروژه، PowerShell را باز کنید و اجرا کنید:

```powershell
# ساخت و اجرای همه سرویس‌ها
docker-compose up --build
```

### روش ۲: اجرا در پس‌زمینه

```powershell
# اجرا در پس‌زمینه
docker-compose up -d --build

# مشاهده لاگ‌ها
docker-compose logs -f
```

---

## 🔗 آدرس سرویس‌ها

پس از اجرا، سرویس‌ها در آدرس‌های زیر در دسترس هستند:

| سرویس | آدرس | توضیح |
|-------|------|-------|
| **Streaming** | `http://localhost:3001` | سرور WebRTC |
| **API** | `http://localhost:3002` | سرور API داده‌ها |
| **PostgreSQL** | `localhost:5432` | دیتابیس |
| **Redis** | `localhost:6379` | Cache |

---

## ✅ تست سرویس‌ها

### بررسی Health سرویس‌ها:

```powershell
# Health Check API
curl http://localhost:3002/health

# Health Check Streaming
curl http://localhost:3001/health
```

### یا در مرورگر:

- `http://localhost:3002/health` → باید `{"status":"ok","service":"api"}` نمایش دهد
- `http://localhost:3001/health` → باید `{"status":"ok","service":"streaming"}` نمایش دهد

---

## 🛠️ دستورات مفید

### مشاهده وضعیت کانتینرها:
```powershell
docker-compose ps
```

### مشاهده لاگ یک سرویس خاص:
```powershell
docker-compose logs api
docker-compose logs streaming
```

### توقف همه سرویس‌ها:
```powershell
docker-compose down
```

### توقف و حذف کامل (با دیتا):
```powershell
docker-compose down -v
```

### Restart یک سرویس:
```powershell
docker-compose restart api
```

---

## ⚙️ تنظیمات

### تغییر IP برای دسترسی از شبکه:

فایل `docker-compose.yml` را ویرایش کنید:

```yaml
streaming:
  environment:
    - MEDIASOUP_ANNOUNCED_IP=192.168.1.100  # IP کامپیوتر شما
```

---

## 🔧 عیب‌یابی

### خطای Port در حال استفاده:

```powershell
# بررسی پورت‌های در حال استفاده
netstat -ano | findstr :3001
netstat -ano | findstr :3002

# توقف پروسس با PID
taskkill /PID <PID> /F
```

### خطای WSL:

اگر خطای WSL دیدید:

1. PowerShell را به عنوان Administrator باز کنید
2. اجرا کنید:
```powershell
wsl --install
wsl --update
```
3. کامپیوتر را Restart کنید

### خطای Build:

```powershell
# پاک کردن Cache و ساخت مجدد
docker-compose build --no-cache
docker-compose up
```

---

## 📁 ساختار فایل‌ها

```
project/
├── docker-compose.yml          # تنظیمات Docker Compose
├── backend/
│   ├── api/
│   │   ├── Dockerfile          # Docker سرور API
│   │   ├── package.json
│   │   ├── server.js           # کد سرور API
│   │   └── init.sql           # ساختار دیتابیس
│   └── streaming/
│       ├── Dockerfile          # Docker سرور استریم
│       ├── package.json
│       └── server.js           # کد سرور WebRTC
└── src/                        # کد کلاینت React
```

---

## 🔌 اتصال کلاینت به سرورها

در کد React، از آدرس‌های زیر استفاده کنید:

```javascript
// API Server
const API_URL = 'http://localhost:3002';

// Streaming Server (Socket.IO)
const STREAMING_URL = 'http://localhost:3001';
```

---

## 💾 بکاپ دیتابیس

```powershell
# بکاپ گرفتن
docker exec glassclass-postgres pg_dump -U glassclass glassclass > backup.sql

# بازیابی
docker exec -i glassclass-postgres psql -U glassclass glassclass < backup.sql
```

---

## 🎉 آماده!

پس از اجرای موفق، می‌توانید:

1. اپلیکیشن React را اجرا کنید: `npm run dev`
2. به `http://localhost:5173` بروید
3. با اطلاعات زیر وارد شوید:
   - **مدیر:** `admin` / `admin1234`
   - **معلم:** `CLS-A1B2C3` / `teach123`
   - **دانش‌آموز:** `CLS-A1B2C3` / `sara1234`
