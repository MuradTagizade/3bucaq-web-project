'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import Spinner from '@/components/ui/Spinner';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/verify'];
const ADMIN_ROUTES = ['/admin'];

export default function AuthGuard({ children }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r);
  const isAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }

    if (user && (pathname === '/login' || pathname === '/register')) {
      router.replace('/dashboard');
      return;
    }

    if (isAdmin && user?.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
  }, [user, loading, isPublic, isAdmin, pathname, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (isAdmin && user?.role !== 'admin') return null;

  return children;
}
