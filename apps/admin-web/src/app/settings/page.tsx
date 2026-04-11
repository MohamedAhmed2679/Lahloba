import { Header } from '@/components/layout/header';
import { Settings2, Zap, DollarSign, Activity } from 'lucide-react';

export default function SettingsPage() {
  return (
    <>
      <Header 
        title="Platform Controls & Settings" 
        subtitle="Configure the fee engine, surge pricing, and global platform toggles" 
        action={
          <button className="text-sm bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 transition-colors shadow-sm">
            Save Changes
          </button>
        }
      />

      <main className="flex-1 overflow-auto p-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <DollarSign size={16} /> Financial Engine
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Base Delivery Fee (EGP)</label>
                <div className="text-xs text-slate-500 mb-2">The starting platform rate applied to all deliveries.</div>
                <input type="number" defaultValue="20" className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder-slate-400 font-medium" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Platform Commission %</label>
                <div className="text-xs text-slate-500 mb-2">The percentage cut the platform takes from Chef earnings.</div>
                <input type="number" defaultValue="15" className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder-slate-400 font-medium" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Distance Multiplier (per km)</label>
                <div className="text-xs text-slate-500 mb-2">Additional EGP added per kilometer exceeding 3km.</div>
                <input type="number" defaultValue="5" className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder-slate-400 font-medium" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Activity size={16} /> Operational Toggles
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Enable Surge Pricing</div>
                  <div className="text-xs text-slate-500 mt-1 max-w-[250px]">Automatically apply an x1.5 multiplier during heavy traffic hours.</div>
                </div>
                <button className="w-12 h-6 rounded-full bg-teal-500 relative flex items-center px-1 cursor-pointer transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm absolute right-1"></div>
                </button>
              </div>

              <hr className="border-slate-100" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Pause New User Registration</div>
                  <div className="text-xs text-slate-500 mt-1 max-w-[250px]">Stop accepting new accounts globally if operations are overloaded.</div>
                </div>
                <button className="w-12 h-6 rounded-full bg-slate-300 relative flex items-center px-1 cursor-pointer transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm absolute left-1"></div>
                </button>
              </div>

              <hr className="border-slate-100" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-rose-600">Maintenance Mode</div>
                  <div className="text-xs text-slate-500 mt-1 max-w-[250px]">Takes the entire platform offline. Active orders will be paused.</div>
                </div>
                <button className="w-12 h-6 rounded-full bg-rose-500 relative flex items-center px-1 cursor-pointer transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm absolute left-1 transition-all"></div>
                </button>
              </div>

            </div>
          </section>

        </div>
      </main>
    </>
  );
}
