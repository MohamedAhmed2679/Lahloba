import { Header } from '@/components/layout/header';
import { TrendingUp, TrendingDown, Package, Clock, ShieldAlert } from 'lucide-react';

const KPI = [
  { label: 'Live Orders', value: '142', delta: '+12%', isPositive: true, icon: Package, color: 'text-teal-600', bg: 'bg-teal-50' },
  { label: 'On-time Rate', value: '94.2%', delta: '+1.1%', isPositive: true, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'GMV Today', value: '48,420 EGP', delta: '+8.4%', isPositive: true, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Active Disputes', value: '6', delta: '-2', isPositive: true, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' }, // Drop in disputes is positive
];

const RECENT_ORDERS = [
  { id: 'ORD-8901', status: 'CHEF_PREPARING', customer: 'Ahmed H.', role: 'Customer', amount: '280 EGP', time: '2 mins ago', statusColor: 'bg-amber-100 text-amber-700 ring-amber-500/20' },
  { id: 'ORD-8900', status: 'MEAL_ON_THE_WAY', customer: 'Sara M.', role: 'Customer', amount: '195 EGP', time: '14 mins ago', statusColor: 'bg-purple-100 text-purple-700 ring-purple-500/20' },
  { id: 'ORD-8899', status: 'DELIVERED', customer: 'Omar K.', role: 'Customer', amount: '340 EGP', time: '28 mins ago', statusColor: 'bg-emerald-100 text-emerald-700 ring-emerald-500/20' },
  { id: 'ORD-8898', status: 'INGREDIENTS_SOURCING', customer: 'Layla R.', role: 'Chef', amount: '150 EGP', time: '41 mins ago', statusColor: 'bg-sky-100 text-sky-700 ring-sky-500/20' },
];

export default function DashboardPage() {
  return (
    <>
      <Header 
        title="Dashboard Overview" 
        subtitle="Platform health and real-time operations" 
        action={
          <div className="flex gap-2">
            <select className="text-sm border-slate-200 border rounded-lg px-3 py-1.5 bg-white shadow-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20">
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>
            <button className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
              Export CSV
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-8 space-y-8">
        
        {/* KPI Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {KPI.map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                  <kpi.icon size={20} className={kpi.color} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${kpi.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpi.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {kpi.delta}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{kpi.value}</div>
                <div className="text-sm font-medium text-slate-500 mt-1">{kpi.label}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Bottom Split */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
          
          {/* Geolocation Mock Map */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Live Heatmap</h3>
              <span className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: "url('https://maps.googleapis.com/maps/api/staticmap?center=30.0444,31.2357&zoom=12&size=800x400&style=feature:all|element:labels|visibility:off&style=feature:water|color:0xcbe7f3&style=feature:landscape|color:0xf8f9fa&style=feature:road|color:0xffffff|weight:1')", backgroundSize: 'cover' }}></div>
              <div className="relative z-10 w-4 h-4 rounded-full bg-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.2)] animate-ping absolute translate-x-12 translate-y-12"></div>
              <div className="relative z-10 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.2)] animate-ping absolute -translate-x-24 -translate-y-16"></div>
              <div className="relative z-10 w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.2)] animate-ping absolute translate-x-32 -translate-y-8"></div>
              <p className="z-20 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium shadow-sm text-slate-700 font-mono">
                [ Map Module Active ]
              </p>
            </div>
          </div>

          {/* Real-time Order Stream */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Order Stream</h3>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <div className="space-y-1">
                {RECENT_ORDERS.map((order) => (
                  <div key={order.id} className="p-3 hover:bg-slate-50 rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm text-slate-900">{order.id}</div>
                      <div className="text-xs text-slate-400 font-medium">{order.time}</div>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-semibold">{order.customer}</div>
                      <div className="text-sm font-bold text-slate-700">{order.amount}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${order.statusColor}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 border-t border-slate-100">
              <button className="w-full py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                View All Active Orders
              </button>
            </div>
          </div>

        </section>
      </main>
    </>
  );
}
