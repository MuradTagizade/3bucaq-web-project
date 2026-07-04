import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#060a13', color: '#e8eefc', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 56, fontWeight: 800, color: '#3cedeb' }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Səhifə tapılmadı</h1>
      <p style={{ opacity: 0.7, maxWidth: 420, margin: 0 }}>
        Axtardığınız səhifə mövcud deyil və ya köçürülüb.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8, padding: '12px 28px', borderRadius: 12,
          background: '#3cedeb', color: '#04141a', fontWeight: 700, fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Ana səhifəyə qayıt
      </Link>
    </div>
  );
}
