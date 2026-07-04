import './globals.css';
import Script from 'next/script';
import { Inter, JetBrains_Mono } from 'next/font/google';
import AuthProvider from '@/components/providers/AuthProvider';
import ThemeProvider from '@/components/providers/ThemeProvider';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata = {
  title: 'LEVEL UP — Make World Green Again',
  description: 'LEVEL UP investisiya və MLM platforması. Paketlər alın, referal cəlb edin, qazanc əldə edin.',
  keywords: 'LEVEL UP, investisiya, MLM, USDT, qazanc, referal',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'LEVEL UP — Make World Green Again',
    description: 'İnvestisiya və MLM platforması',
    type: 'website',
    locale: 'az_AZ',
    siteName: 'LEVEL UP',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060a13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="az" data-scroll-behavior="smooth" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.setAttribute('data-theme', 'dark');
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
