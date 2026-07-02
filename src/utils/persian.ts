// Persian number converter
const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNum(num: string | number): string {
  return String(num).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

export function toEnglishNum(str: string): string {
  const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianNumbers[i], String(i));
  }
  return result;
}

// Shamsi date converter (simplified)
export function toShamsi(date: Date): string {
  const gY = date.getFullYear();
  const gM = date.getMonth() + 1;
  const gD = date.getDate();
  
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gM > 2) ? (gY + 1) : gY;
  let days = 355666 + (365 * gY) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) + gD + gDaysInMonth[gM - 1];
  let jY = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jY += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jY += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jM, jD;
  if (days < 186) {
    jM = 1 + Math.floor(days / 31);
    jD = 1 + (days % 31);
  } else {
    jM = 7 + Math.floor((days - 186) / 30);
    jD = 1 + ((days - 186) % 30);
  }
  
  return `${toPersianNum(jY)}/${toPersianNum(String(jM).padStart(2, '0'))}/${toPersianNum(String(jD).padStart(2, '0'))}`;
}

export function getPersianWeekDay(date: Date): string {
  const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  return days[date.getDay()];
}

export function getPersianTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${toPersianNum(h)}:${toPersianNum(m)}:${toPersianNum(s)}`;
}

export function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CLS-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${toPersianNum(h)} ساعت و ${toPersianNum(m)} دقیقه`;
  if (h > 0) return `${toPersianNum(h)} ساعت`;
  return `${toPersianNum(m)} دقیقه`;
}
