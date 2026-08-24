import type { Metadata } from 'next';
import { Geist, Poppins } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Chrono - Start Focus Session',
  description: 'AI Smart Scheduling web scaffold',
  icons: {
    icon: '/chrono-logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${poppins.variable}`}>
        {children}
      </body>
    </html>
  );
}
