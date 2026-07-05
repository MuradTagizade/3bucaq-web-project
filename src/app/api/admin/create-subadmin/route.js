import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Yalnız bu icazə açarları qəbul edilir (payload-dakı yad açarlar atılır)
const ALLOWED_PERMISSION_KEYS = ['superadmin', 'users', 'kyc', 'claims', 'finance', 'logs'];

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authorization token missing' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error (missing envs)' }, { status: 500 });
    }

    // 1. Verify caller user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !callerUser) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // 2. Verify caller has Super Admin privileges
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, admin_permissions')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (callerProfile.role !== 'admin' || !callerProfile.admin_permissions?.superadmin) {
      return NextResponse.json({ error: 'Access denied: Super Admin permission is required for this operation' }, { status: 403 });
    }

    // 3. Parse and validate new sub-admin data
    const body = await req.json();
    const { email, password, login, fullName, phone, country, city, permissions } = body;

    if (!email || !password || !login) {
      return NextResponse.json({ error: 'Email, login and password are required' }, { status: 400 });
    }

    // Server tərəfi doğrulama (validators.js qaydaları route içində təkrarlanır — client kodu import edilmir)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const trimmedLogin = String(login).trim();
    if (trimmedLogin.length < 3) {
      return NextResponse.json({ error: 'Login must be at least 3 characters' }, { status: 400 });
    }
    if (trimmedLogin.length > 20) {
      return NextResponse.json({ error: 'Login can be at most 20 characters' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedLogin)) {
      return NextResponse.json({ error: 'Login can only contain letters, numbers and underscore (_)' }, { status: 400 });
    }

    // İcazə açarlarını whitelist et, dəyərləri boolean-a çevir
    const safePermissions = {};
    for (const key of ALLOWED_PERMISSION_KEYS) {
      safePermissions[key] = Boolean(permissions && permissions[key]);
    }

    // 4. Create the new user in Supabase Auth
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_login: trimmedLogin,
        full_name: fullName || trimmedLogin,
        country: country || 'Azerbaijan',
        city: city || 'Baku',
        phone: phone || '',
      }
    });

    if (createError || !authData?.user) {
      console.error('create-subadmin createUser error:', createError?.message);
      return NextResponse.json({ error: 'User could not be created (this email may already be in use)' }, { status: 400 });
    }

    // 5. Update user profile to set admin role and permissions.
    // handle_new_user trigger'inin yaratdığı profil sətri hələ mövcud olmaya bilər —
    // boş nəticə retry sayılır: 5 cəhdə qədər, cəhdlər arası 500ms fasilə.
    let profileUpdated = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { data: updatedRows, error: updateError } = await adminClient
        .from('profiles')
        .update({
          role: 'admin',
          admin_permissions: safePermissions,
          display_login: trimmedLogin,
        })
        .eq('id', authData.user.id)
        .select('id');

      if (updateError) {
        console.error(`create-subadmin profile update error (attempt ${attempt}):`, updateError.message);
      } else if (updatedRows && updatedRows.length > 0) {
        profileUpdated = true;
        break;
      }

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!profileUpdated) {
      // Cleanup: yarımçıq (admin olmayan) hesab qalmasın deyə auth istifadəçisini sil
      try {
        await adminClient.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupErr) {
        console.error('create-subadmin cleanup deleteUser error:', cleanupErr?.message);
      }
      return NextResponse.json({ error: 'Admin profile could not be created. Please try again.' }, { status: 500 });
    }

    // 6. Log the action to admin_logs
    await adminClient.from('admin_logs').insert({
      admin_uid: callerUser.id,
      action: 'create_subadmin',
      target_uid: authData.user.id,
      details: `New sub-admin created. Login: ${trimmedLogin}, Email: ${email}, Permissions: ${JSON.stringify(safePermissions)}`
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        login: trimmedLogin,
      }
    });

  } catch (error) {
    console.error('create-subadmin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
