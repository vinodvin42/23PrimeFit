import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        color: '#f4f7f5',
        textAlign: 'center',
      }}
    >
      <div>
        <p style={{ color: '#c7f36b', fontSize: 12, fontWeight: 700 }}>404</p>
        <h1 style={{ margin: '8px 0', fontSize: 32 }}>Page not found</h1>
        <p style={{ color: '#a9b1ac', marginBottom: 24 }}>
          This coaching workspace page does not exist.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '11px 16px',
            color: '#17201c',
            background: '#c7f36b',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
