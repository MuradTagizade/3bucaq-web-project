import './globals.css';
import Script from 'next/script';
import AuthProvider from '@/components/providers/AuthProvider';
import ThemeProvider from '@/components/providers/ThemeProvider';

export const metadata = {
  title: '3bucaq — Make World Green Again',
  description: '3bucaq investisiya və MLM platforması. Paketlər alın, referal cəlb edin, qazanc əldə edin.',
  keywords: '3bucaq, investisiya, MLM, USDT, qazanc, referal',
  manifest: '/manifest.json',
  icons: {
    icon: '/3bucaq-logo.png',
    apple: '/3bucaq-logo.png',
  },
  openGraph: {
    title: '3bucaq — Make World Green Again',
    description: 'İnvestisiya və MLM platforması',
    type: 'website',
    locale: 'az_AZ',
    siteName: '3bucaq',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#060a13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="az" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/3bucaq-logo.png" />
        <link rel="apple-touch-icon" href="/3bucaq-logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
