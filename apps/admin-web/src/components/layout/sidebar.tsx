'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CheckSquare, ShieldAlert, Settings, LogOut } from 'lucide-react';

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Users, label: 'Users Management', href: '/users' },
  { icon: CheckSquare, label: 'Approvals', href: '/approvals' },
  { icon: ShieldAlert, label: 'Moderation', href: '/moderation' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-slate-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-teal-500/20">
          L
        </div>
        <div>
          <div className="font-bold text-lg leading-tight text-white tracking-tight">Lahloba</div>
          <div className="text-xs text-teal-400 font-medium">Mission Control</div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
        {NAV.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href;
          return (
            <Link 
              key={href} 
              href={href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive 
                  ? 'bg-teal-500/10 text-teal-400 font-semibold' 
                  : 'hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-teal-400' : 'text-slate-500'} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 m-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-sm font-bold text-white shadow-md">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">Super Admin</div>
            <div className="text-xs text-slate-400 truncate">admin@lahloba.com</div>
          </div>
        </div>
        <button className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
          <LogOut size={14} /> Log Out
        </button>
      </div>
    </aside>
  );
}
