'use client';

// Route-level xəta tutucusu — render xətasında ağ ekran əvəzinə bu göstərilir
export default function Error({ error, reset }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#060a13', color: '#e8eefc', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Nəsə səhv getdi</h1>
      <p style={{ opacity: 0.7, maxWidth: 420, margin: 0 }}>
        Gözlənilməz xəta baş verdi. Yenidən cəhd edin — problem davam edərsə bir az sonra qayıdın.
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none',
          background: '#3cedeb', color: '#04141a', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}
      >
        Yenidən cəhd et
      </button>
    </div>
  );
}
