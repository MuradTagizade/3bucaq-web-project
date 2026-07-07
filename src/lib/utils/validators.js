/**
 * LEVEL UP — Form Validators
 */

import { PASSWORD_RULES } from './constants';

export function validateEmail(email) {
  if (!email) return 'Email tələb olunur';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Düzgün email daxil edin';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Parol tələb olunur';
  if (password.length < PASSWORD_RULES.minLength) {
    return `Parol minimum ${PASSWORD_RULES.minLength} simvol olmalıdır`;
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Parolda minimum 1 böyük hərf olmalıdır';
  }
  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    return 'Parolda minimum 1 rəqəm olmalıdır';
  }
  return null;
}

export function validateFullName(name) {
  if (!name || !name.trim()) return 'Ad Soyad tələb olunur';
  if (name.trim().length < 3) return 'Ad Soyad minimum 3 simvol olmalıdır';
  return null;
}

export function validateLogin(login) {
  if (!login || !login.trim()) return 'Login tələb olunur';
  if (login.trim().length < 3) return 'Login minimum 3 simvol olmalıdır';
  if (login.trim().length > 20) return 'Login maksimum 20 simvol ola bilər';
  if (!/^[a-zA-Z0-9_]+$/.test(login.trim())) {
    return 'Login yalnız hərf, rəqəm və alt xətt (_) ola bilər';
  }
  return null;
}

// İstifadəçi adı (username): yalnız hərf (A-Z, a-z), 5-20 simvol. Rəqəm/simvol yox.
// Mesaj yerinə KOD qaytarır ('required'|'length'|'chars') — komponent t() ilə göstərir.
export const USERNAME_RE = /^[a-zA-Z]{5,20}$/;
export function validateUsernameCode(username) {
  const u = (username || '').trim();
  if (!u) return 'required';
  if (u.length < 5 || u.length > 20) return 'length';
  if (!USERNAME_RE.test(u)) return 'chars';
  return null;
}

// Ağlabatan üst limit — '1e300', 'Infinity' kimi dəyərləri rədd edir
const MAX_AMOUNT = 1000000;

export function validateAmount(amount, balance, maxAmount = MAX_AMOUNT) {
  if (!amount || isNaN(amount)) return 'Məbləğ daxil edin';
  const num = parseFloat(amount);
  if (!Number.isFinite(num)) return 'Düzgün məbləğ daxil edin';
  if (num <= 0) return 'Məbləğ müsbət olmalıdır';
  if (num > maxAmount) return `Məbləğ maksimum ${maxAmount} ola bilər`;
  if (balance !== undefined && num > balance) return 'Balans kifayət etmir';
  return null;
}

export function validateUSDTAddress(address) {
  if (!address || !address.trim()) return 'USDT ünvanını daxil edin';
  if (address.trim().length < 20) return 'Düzgün USDT ünvanı daxil edin';
  return null;
}

export function validateVerificationCode(code) {
  if (!code) return 'Təsdiq kodunu daxil edin';
  if (!/^\d{6}$/.test(code)) return '6 rəqəmli kod daxil edin';
  return null;
}

export function validatePhone(phone) {
  if (!phone || !phone.trim()) return 'Telefon nömrəsi tələb olunur';
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!/^\+?[0-9]+$/.test(cleaned)) return 'Telefon nömrəsi yalnız rəqəm olmalıdır';
  if (/^\+?994/.test(cleaned)) {
    // Azərbaycan nömrələri: +994-dən sonra düz 9 rəqəm (məs: 501234567)
    const body = cleaned.replace(/^\+?994/, '');
    if (body.length !== 9 || body.startsWith('0')) {
      return 'Azərbaycan nömrəsi +994-dən sonra düz 9 rəqəm olmalıdır (məs: 50 123 45 67)';
    }
  } else if (cleaned.replace(/^\+/, '').length < 7) {
    return 'Düzgün telefon nömrəsi daxil edin';
  }
  return null;
}

export function validateCountry(country) {
  if (!country || !country.trim()) return 'Ölkə tələb olunur';
  if (country.trim().length < 2) return 'Düzgün ölkə adı daxil edin';
  return null;
}

export function validateCity(city) {
  if (!city || !city.trim()) return 'Şəhər tələb olunur';
  if (city.trim().length < 2) return 'Düzgün şəhər adı daxil edin';
  return null;
}

export function validateFirstName(name) {
  if (!name || !name.trim()) return 'Ad tələb olunur';
  if (name.trim().length < 2) return 'Ad minimum 2 simvol olmalıdır';
  return null;
}

export function validateLastName(name) {
  if (!name || !name.trim()) return 'Soyad tələb olunur';
  if (name.trim().length < 2) return 'Soyad minimum 2 simvol olmalıdır';
  return null;
}
