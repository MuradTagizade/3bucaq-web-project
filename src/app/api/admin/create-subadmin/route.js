import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Avtorizasiya tokeni yoxdur' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server tənzimləmə xətası (missing envs)' }, { status: 500 });
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
      return NextResponse.json({ error: 'Keçərsiz və ya vaxtı keçmiş sessiya' }, { status: 401 });
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
      return NextResponse.json({ error: 'İstifadəçi profili tapılmadı' }, { status: 404 });
    }

    if (callerProfile.role !== 'admin' || !callerProfile.admin_permissions?.superadmin) {
      return NextResponse.json({ error: 'Giriş qadağandır: Bu əməliyyat üçün Super Admin səlahiyyəti lazımdır' }, { status: 403 });
    }

    // 3. Parse and validate new sub-admin data
    const body = await req.json();
    const { email, password, login, fullName, phone, country, city, permissions } = body;

    if (!email || !password || !login) {
      return NextResponse.json({ error: 'Email, login və şifrə daxil edilməlidir' }, { status: 400 });
    }

    // 4. Create the new user in Supabase Auth
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_login: login,
        full_name: fullName || login,
        country: country || 'Azərbaycan',
        city: city || 'Bakı',
        phone: phone || '',
      }
    });

    if (createError || !authData?.user) {
      return NextResponse.json({ error: createError?.message || 'İstifadəçi yaradılarkən xəta baş verdi' }, { status: 400 });
    }

    // Wait a brief moment to ensure trigger handle_new_user finishes execution
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 5. Update user profile to set admin role and permissions
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        role: 'admin',
        admin_permissions: permissions || {},
      })
      .eq('id', authData.user.id);

    if (updateError) {
      // Cleanup: delete the created auth user if profile update fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Profil yenilənərkən xəta: ${updateError.message}` }, { status: 500 });
    }

    // 6. Log the action to admin_logs
    await adminClient.from('admin_logs').insert({
      admin_uid: callerUser.id,
      action: 'create_subadmin',
      target_uid: authData.user.id,
      details: `Yeni alt-admin yaradıldı. Login: ${login}, Email: ${email}, İcazələr: ${JSON.stringify(permissions)}`
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: authData.user.id,
        email: authData.user.email,
        login: login,
      } 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message || 'Daxili server xətası' }, { status: 500 });
  }
}
