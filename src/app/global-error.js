'use client';

// Last-resort defense if the root layout crashes — must render its own <html>/<body>.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#060a13', color: '#e8eefc', textAlign: 'center', padding: 24,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7, maxWidth: 420, margin: 0 }}>
          An unexpected error occurred. Please refresh the page.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none',
            background: '#3cedeb', color: '#04141a', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
