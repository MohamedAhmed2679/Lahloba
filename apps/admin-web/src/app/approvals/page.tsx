import { Header } from '@/components/layout/header';
import { BadgeCheck, XCircle, FileImage, ShieldAlert, Store, ChefHat } from 'lucide-react';

const QUEUE = [
  { id: 'APP-102', entity: 'Mona Zaki', type: 'Chef Certification', submitted: '2 hours ago', documents: 3, icon: ChefHat },
  { id: 'APP-103', entity: 'Fresh Market', type: 'Store Verification', submitted: '5 hours ago', documents: 4, icon: Store },
  { id: 'APP-104', entity: 'Tarek Y.', type: 'Driver License Check', submitted: '1 day ago', documents: 2, icon: ShieldAlert },
];

export default function ApprovalsPage() {
  return (
    <>
      <Header 
        title="Approvals Queue" 
        subtitle="Review chef certifications, vehicle registrations, and store permits" 
      />

      <main className="flex-1 overflow-auto p-8">
        
        <div className="flex gap-4 mb-8">
          <div className="bg-white border text-amber-700 border-amber-200 bg-amber-50 rounded-xl px-5 py-3 shadow-sm font-medium flex gap-3 items-center">
            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><ShieldAlert size={16} /></span>
            3 pending applications require immediate attention
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {QUEUE.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <item.icon size={24} />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                    {item.id}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-1">{item.entity}</h3>
                <p className="text-sm font-medium text-slate-500 mb-6">{item.type}</p>

                <div className="space-y-3 mb-6">
                  <div className="text-sm flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-2 font-medium">
                      <FileImage size={16} className="text-slate-400" />
                      Documents Provided
                    </span>
                    <span className="font-bold text-slate-900">{item.documents}</span>
                  </div>
                  <div className="text-sm flex items-center justify-between text-slate-600">
                    <span className="font-medium">Submitted</span>
                    <span className="font-bold text-slate-900">{item.submitted}</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-xl transition-colors">
                    <BadgeCheck size={18} /> Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold rounded-xl transition-colors">
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
