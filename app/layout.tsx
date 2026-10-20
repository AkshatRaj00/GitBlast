import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitBlast — Autonomous Architecture & Blast Radius Engine',
  description: 'Client-side import graph mapping and heuristic change impact analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#070b14] text-slate-100 overflow-hidden antialiased select-none font-sans">
        {children}
      </body>
    </html>
  );
}
