import { Header } from '@/components/layout/header';
import { AlertCircle, FileWarning, HelpCircle } from 'lucide-react';

export default function ModerationPage() {
  return (
    <>
      <Header 
        title="Disputes & Moderation" 
        subtitle="Manage user reports, damaged goods, and refund requests" 
      />

      <main className="flex-1 overflow-auto p-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex gap-2 items-center">
              <FileWarning className="text-rose-500" /> High-Priority Tickets
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs font-bold uppercase rounded-md">Order Undelivered</span>
                  <span className="text-xs font-semibold text-orange-600">30m ago</span>
                </div>
                <h4 className="font-bold text-slate-900">#ORD-8890: Customer vs Driver Route Dispute</h4>
                <p className="text-sm text-slate-700 mt-2">
                  "Driver marked as delivered but nothing arrived at my door."
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="text-sm px-4 py-2 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50">Review GPS Logs</button>
                  <button className="text-sm px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">Intervene in Chat</button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-1 bg-slate-200 text-slate-800 text-xs font-bold uppercase rounded-md">Quality Control</span>
                  <span className="text-xs font-semibold text-slate-500">2h ago</span>
                </div>
                <h4 className="font-bold text-slate-900">#ORD-8865: Spoiled Ingredients Report</h4>
                <p className="text-sm text-slate-500 mt-2">
                  Chef requested a refund due to poor quality meat from supplier "Fresh Market".
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="text-sm px-4 py-2 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50">View Evidence</button>
                  <button className="text-sm px-4 py-2 bg-white text-rose-600 font-medium rounded-lg border border-slate-200 hover:bg-rose-50">Issue Refund (150 EGP)</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-center justify-center flex-col text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
              <CheckCircle />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">All Caught Up!</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              There are no pending low-priority reports or moderation queue items at this time.
            </p>
          </div>

        </div>
      </main>
    </>
  );
}

function CheckCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
