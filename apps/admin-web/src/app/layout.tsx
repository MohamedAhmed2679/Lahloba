import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = { 
  title: 'Lahloba Mission Control', 
  description: 'Operations Dashboard' 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen flex font-['Inter'] selection:bg-teal-500/30">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
