import { supabase } from './config';

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function registerUser(email, password, { fullName, country, city, phone, referralCode }) {
  // Kullanıcı adı YOK — user_code trigger tarafından otomatik atanır.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        country: country || null,
        city: city || null,
        phone: phone || null,
        referral_code: referralCode || null,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function resetPassword(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // Kullanıcı sıralaması (enumeration, O-3) önlenir: e-posta var/yok fark etmeksizin
  // aynı akış çalışır. Supabase kayıtlı olmayan adrese e-posta göndermez.
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
  return { success: true };
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  return () => {
    subscription.unsubscribe();
  };
}
