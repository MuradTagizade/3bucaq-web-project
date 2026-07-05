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
  description: 'LEVEL UP investment and MLM platform. Buy packages, invite referrals, earn rewards.',
  keywords: 'LEVEL UP, investment, MLM, USDT, earnings, referral',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'LEVEL UP — Make World Green Again',
    description: 'Investment and MLM platform',
    type: 'website',
    locale: 'en_US',
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
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
