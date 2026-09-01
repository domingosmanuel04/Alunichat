import type { Metadata } from 'next';
import { DM_Sans, Sora } from 'next/font/google';
import { Toaster } from 'sonner';
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

export const metadata: Metadata = {
  title: {
    default: 'ALURICHAT',
    template: '%s · ALURICHAT',
  },
  description: 'Atendimento inteligente. Vendas automatizadas. Operação sob controle.',
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
        className={`${dmSans.variable} ${sora.variable} font-sans antialiased`}
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
