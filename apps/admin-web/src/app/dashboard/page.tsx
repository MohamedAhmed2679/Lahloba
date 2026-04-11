export default function DashboardPage() {
  const kpis = [
    { label: 'Live Orders', value: '24', change: '+3', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { label: 'On-time Rate', value: '94.2%', change: '+1.2%', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'GMV Today', value: '18,450 EGP', change: '+12%', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Avg Delivery', value: '42 min', change: '-3 min', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ];

  const orders = [
    { id: 'ord_10042', status: 'CHEF_PREPARING', customer: 'Ahmed H.', chef: 'Fatma A.', total: '280 EGP', time: '2:45 PM' },
    { id: 'ord_10041', status: 'MEAL_ON_THE_WAY', customer: 'Sara M.', chef: 'Fatma A.', total: '195 EGP', time: '2:30 PM' },
    { id: 'ord_10040', status: 'DELIVERED', customer: 'Omar K.', chef: 'Fatma A.', total: '340 EGP', time: '2:15 PM' },
    { id: 'ord_10039', status: 'INGREDIENTS_SOURCING', customer: 'Nour E.', chef: 'Fatma A.', total: '150 EGP', time: '2:10 PM' },
  ];

  const sc: Record<string, string> = {
    CREATED: 'bg-slate-100 text-slate-600', CONFIRMED: 'bg-blue-100 text-blue-700',
    INGREDIENTS_SOURCING: 'bg-amber-100 text-amber-700', CHEF_PREPARING: 'bg-teal-100 text-teal-700',
    MEAL_ON_THE_WAY: 'bg-purple-100 text-purple-700', DELIVERED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border p-5 ${k.color}`}>
            <div className="text-sm font-medium opacity-75">{k.label}</div>
            <div className="text-2xl font-bold mt-1">{k.value}</div>
            <div className="text-xs mt-1 opacity-60">{k.change} from yesterday</div>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold">Recent Orders</h2>
          <a href="/orders" className="text-sm text-teal-700 hover:underline">View all</a>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-700">
            <th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Chef</th>
            <th className="px-5 py-3 font-medium">Total</th><th className="px-5 py-3 font-medium">Time</th>
          </tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <td className="px-5 py-3 font-mono text-xs">{o.id}</td>
              <td className="px-5 py-3"><span className={`px-2 py-1 rounded-lg text-xs font-medium ${sc[o.status]||''}`}>{o.status.replace(/_/g,' ')}</span></td>
              <td className="px-5 py-3">{o.customer}</td><td className="px-5 py-3">{o.chef}</td>
              <td className="px-5 py-3 font-medium">{o.total}</td><td className="px-5 py-3 text-slate-500">{o.time}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5">
          <h3 className="font-bold mb-3">Disputes Queue</h3>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-rose-500">3</div>
            <div className="text-sm text-slate-500"><div>Open tickets</div><div>Oldest: 2h 15m</div></div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5">
          <h3 className="font-bold mb-3">Transport Health</h3>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div><div className="text-lg font-bold text-emerald-500">98%</div><div className="text-slate-500">WS</div></div>
            <div><div className="text-lg font-bold text-emerald-500">96%</div><div className="text-slate-500">Push</div></div>
            <div><div className="text-lg font-bold text-amber-500">12s</div><div className="text-slate-500">Outbox</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
