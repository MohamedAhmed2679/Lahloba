'use client';
import { useState } from 'react';

const TABS = ['Platform', 'Chefs', 'Stores', 'Delivery'];

export default function AnalyticsPage() {
  const [tab, setTab] = useState('Platform');
  const [days, setDays] = useState(30);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-slate-500 text-sm">Performance insights and trends</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded-xl px-3 py-2 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t}</button>
        ))}
      </div>

      {/* Platform KPIs */}
      {tab === 'Platform' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Orders', value: '1,247', delta: '+18%' },
              { label: 'GMV', value: '187,420 EGP', delta: '+22%' },
              { label: 'Active Customers', value: '342', delta: '+15%' },
              { label: 'Active Chefs', value: '28', delta: '+3' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-[18px] p-6 border">
                <div className="text-sm text-slate-500">{k.label}</div>
                <div className="text-2xl font-bold mt-1">{k.value}</div>
                <div className="text-xs text-emerald-600 mt-1">{k.delta}</div>
              </div>
            ))}
          </div>

          {/* Loyalty stats */}
          <div className="bg-white rounded-[18px] p-6 border">
            <h3 className="font-bold mb-4">Loyalty Program</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { tier: 'Bronze', count: 280, color: 'bg-amber-700' },
                { tier: 'Silver', count: 45, color: 'bg-slate-400' },
                { tier: 'Gold', count: 12, color: 'bg-yellow-500' },
                { tier: 'Platinum', count: 5, color: 'bg-slate-800' },
              ].map((t) => (
                <div key={t.tier} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${t.color}`} />
                  <span className="text-sm">{t.tier}</span>
                  <span className="font-bold ml-auto">{t.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly demand heatmap */}
          <div className="bg-white rounded-[18px] p-6 border">
            <h3 className="font-bold mb-4">Hourly Demand</h3>
            <div className="flex gap-1">
              {Array.from({ length: 24 }, (_, h) => {
                const intensity = h >= 11 && h <= 14 ? 0.8 : h >= 18 && h <= 21 ? 1.0 : h >= 8 && h <= 22 ? 0.3 : 0.05;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-12 rounded" style={{ backgroundColor: `rgba(15, 118, 110, ${intensity})` }} />
                    <span className="text-[10px] text-slate-400">{h}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ETA Model Accuracy */}
          <div className="bg-white rounded-[18px] p-6 border">
            <h3 className="font-bold mb-4">ETA Prediction Accuracy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><div className="text-sm text-slate-500">MAE</div><div className="text-xl font-bold">6.2 min</div></div>
              <div><div className="text-sm text-slate-500">Within 10 min</div><div className="text-xl font-bold text-emerald-600">87.3%</div></div>
              <div><div className="text-sm text-slate-500">Avg Confidence</div><div className="text-xl font-bold">0.78</div></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Chefs' && (
        <div className="bg-white rounded-[18px] p-6 border">
          <h3 className="font-bold mb-4">Chef Leaderboard</h3>
          <table className="w-full text-sm">
            <thead className="text-slate-500"><tr><th className="text-left py-2">Chef</th><th>Orders</th><th>GMV</th><th>Rating</th><th>Avg Prep</th></tr></thead>
            <tbody>
              {[
                { name: 'Fatma Ali', orders: 48, gmv: '7,200', rating: 4.8, prep: '32m' },
                { name: 'Nour Said', orders: 35, gmv: '5,100', rating: 4.6, prep: '28m' },
                { name: 'Hana Mohamed', orders: 22, gmv: '3,400', rating: 4.9, prep: '40m' },
              ].map((c) => (
                <tr key={c.name} className="border-t"><td className="py-3 font-medium">{c.name}</td><td className="text-center">{c.orders}</td><td className="text-center text-amber-600">{c.gmv} EGP</td><td className="text-center">{c.rating}</td><td className="text-center">{c.prep}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Stores' && (
        <div className="bg-white rounded-[18px] p-6 border">
          <h3 className="font-bold mb-4">Store Performance</h3>
          <table className="w-full text-sm">
            <thead className="text-slate-500"><tr><th className="text-left py-2">Store</th><th>Orders</th><th>Revenue</th><th>Avg Pack</th><th>Sub Rate</th></tr></thead>
            <tbody>
              {[
                { name: 'Metro Market', orders: 120, rev: '18,500', pack: '12m', sub: '3.2%' },
                { name: 'Fresh Corner', orders: 85, rev: '12,100', pack: '15m', sub: '5.1%' },
              ].map((s) => (
                <tr key={s.name} className="border-t"><td className="py-3 font-medium">{s.name}</td><td className="text-center">{s.orders}</td><td className="text-center text-amber-600">{s.rev} EGP</td><td className="text-center">{s.pack}</td><td className="text-center">{s.sub}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Delivery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Completed Tasks', value: '892', delta: '+12%' },
              { label: 'Batched Tasks', value: '234 (26%)', delta: '+8%' },
              { label: 'Avg Delivery Time', value: '38 min', delta: '-3 min' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-[18px] p-6 border">
                <div className="text-sm text-slate-500">{k.label}</div>
                <div className="text-xl font-bold mt-1">{k.value}</div>
                <div className="text-xs text-emerald-600">{k.delta}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-[18px] p-6 border">
            <h3 className="font-bold mb-4">Route Optimization Impact</h3>
            <div className="grid grid-cols-2 gap-8">
              <div><div className="text-sm text-slate-500 mb-1">Avg Distance Saved (Batched)</div><div className="text-2xl font-bold text-teal-700">2.4 km/batch</div></div>
              <div><div className="text-sm text-slate-500 mb-1">Driver Payout Efficiency</div><div className="text-2xl font-bold text-teal-700">+18% per km</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
