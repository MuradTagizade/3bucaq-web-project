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

export async function registerUser(email, password, { fullName, login, country, city, phone, referralCode }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        display_login: login,
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

  // 1. Check if email exists in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error('Xəta baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin.');
  }

  if (!profile) {
    throw new Error('Bu email ünvanı sistemdə tapılmadı. Keçərli bir email daxil edin.');
  }

  // 2. Call resetPasswordForEmail
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/login`,
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
