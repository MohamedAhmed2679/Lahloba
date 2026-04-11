import { Header } from '@/components/layout/header';
import { MoreVertical, ShieldAlert, CheckCircle2, UserX } from 'lucide-react';

const USERS = [
  { id: 'USR-8901', name: 'Ahmed Hassan', email: 'ahmed.h@example.com', role: 'Customer', status: 'Active', joined: '12 Jan 2024' },
  { id: 'USR-8902', name: 'Mona Zaki', email: 'mona.z@example.com', role: 'Chef', status: 'Pending', joined: '13 Jan 2024' },
  { id: 'USR-8903', name: 'Fresh Market', email: 'contact@freshmarket.com', role: 'Store', status: 'Active', joined: '15 Jan 2024' },
  { id: 'USR-8904', name: 'Omar Khaled', email: 'omar.k@example.com', role: 'Driver', status: 'Suspended', joined: '20 Jan 2024' },
  { id: 'USR-8905', name: 'Layla Rashad', email: 'layla.r@example.com', role: 'Customer', status: 'Active', joined: '22 Jan 2024' },
];

export default function UsersPage() {
  return (
    <>
      <Header 
        title="Users Management" 
        subtitle="View and manage all platform accounts" 
        action={
          <button className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm">
            + Export Users List
          </button>
        }
      />

      <main className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-full">
          
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex gap-2">
              <select className="text-sm border-slate-200 border rounded-lg px-3 py-1.5 bg-white shadow-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20">
                <option>All Roles</option>
                <option>Customers</option>
                <option>Chefs</option>
                <option>Drivers</option>
                <option>Stores</option>
              </select>
              <select className="text-sm border-slate-200 border rounded-lg px-3 py-1.5 bg-white shadow-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20">
                <option>All Statuses</option>
                <option>Active</option>
                <option>Pending</option>
                <option>Suspended</option>
              </select>
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Showing 5 of 12,401 users
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">User</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Role</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Joined</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {USERS.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 group-hover:text-teal-600 transition-colors cursor-pointer">{user.name}</div>
                          <div className="text-slate-500 text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{user.role}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ring-1 ring-inset ${
                        user.status === 'Active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/20' :
                        user.status === 'Pending' ? 'bg-amber-50 text-amber-700 ring-amber-500/20' :
                        'bg-rose-50 text-rose-700 ring-rose-500/20'
                      }`}>
                        {user.status === 'Active' && <CheckCircle2 size={12} />}
                        {user.status === 'Suspended' && <UserX size={12} />}
                        {user.status === 'Pending' && <ShieldAlert size={12} />}
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{user.joined}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 mt-auto">
            <button className="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all shadow-sm">
              Previous
            </button>
            <div className="flex gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-teal-500 text-teal-600 font-semibold shadow-sm">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:border border border-transparent hover:border-slate-200 font-medium">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:border border border-transparent hover:border-slate-200 font-medium">3</button>
            </div>
            <button className="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all shadow-sm">
              Next
            </button>
          </div>
          
        </div>
      </main>
    </>
  );
}
