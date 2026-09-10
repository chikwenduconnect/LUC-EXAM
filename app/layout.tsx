import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LUC Exam | LUC Hub & Academy',
  description: 'Premium modern examination workspace for LUC Hub & Academy.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-gray-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
