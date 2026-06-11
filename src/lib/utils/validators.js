/**
 * 3bucaq — Form Validators
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

export function validateAmount(amount, balance) {
  if (!amount || isNaN(amount)) return 'Məbləğ daxil edin';
  const num = parseFloat(amount);
  if (num <= 0) return 'Məbləğ müsbət olmalıdır';
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
  if (cleaned.length < 7) return 'Düzgün telefon nömrəsi daxil edin';
  if (!/^\+?[0-9]+$/.test(cleaned)) return 'Telefon nömrəsi yalnız rəqəm olmalıdır';
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
