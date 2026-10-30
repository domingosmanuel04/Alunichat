import type { Metadata } from 'next';
import { DM_Sans, Fraunces, Outfit, Sora } from 'next/font/google';
import { Toaster } from 'sonner';
import { getSiteUrl } from '@/lib/site-url';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'ALURICHAT',
    template: '%s · ALURICHAT',
  },
  description: 'Atendimento inteligente. Vendas automatizadas. Operação sob controle.',
  alternates: {
    canonical: '/',
    types: {
      'text/plain': [
        { url: '/llms.txt', title: 'llms.txt' },
        { url: '/roots.txt', title: 'roots.txt' },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=3' },
      { url: '/icone.png?v=3', type: 'image/png' },
      { url: '/favicon-32.png?v=3', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico?v=3',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${sora.variable} ${fraunces.variable} ${outfit.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #1E293B',
              color: '#F1F5F9',
            },
          }}
        />
      </body>
    </html>
  );
}
