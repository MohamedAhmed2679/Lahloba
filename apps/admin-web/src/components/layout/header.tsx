'use client';
import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-medium">{subtitle}</p>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-teal-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search orders, users..." 
            className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm w-64 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all shadow-sm"
          />
        </div>
        
        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 rounded-full hover:bg-slate-200">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="h-6 w-px bg-slate-200"></div>
        {action}
      </div>
    </header>
  );
}
