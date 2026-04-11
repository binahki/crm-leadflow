import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Creative } from '@/stores/appStore';
import { useMetaAds } from '@/hooks/useMetaAds';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Image, TrendingUp, DollarSign, MousePointer, Target, RefreshCw } from 'lucide-react';

export default function CriativosPage() {
  const { leads, creatives, setCreatives } = useAppStore();
  const { refreshData, loading: metaLoading } = useMetaAds();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('criativos').select('*');
      if (data) setCreatives(data as unknown as Creative[]);
    };
    fetch();
  }, []);

  const ranked = useMemo(() =>
    [...creatives]
      .filter((c) => (c.leads || 0) > 0)
      .sort((a, b) => (a.cpl || 999) - (b.cpl || 999)),
    [creatives]
  );

  const ctrData = creatives.slice(0, 10).map((c) => ({
    name: c.name?.substring(0, 12) || 'Criativo',
    ctr: c.ctr || 0,
  }));

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
                <Image className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Criativos</h1>
                <p className="text-sm text-muted-foreground mt-1">Analise o desempenho dos seus criativos</p>
              </div>
            </div>
            <button 
              onClick={refreshData}
              disabled={metaLoading}
              className="backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg px-4 py-2 text-sm hover:bg-white/80 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${metaLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* CTR Chart with Apple glassmorphism */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <h2 className="text-sm font-bold font-display mb-4">CTR por criativo</h2>
          <div className="h-[200px]">
            {ctrData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ctrData}>
                  <defs>
                    <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      color: '#1e293b',
                      fontSize: '12px',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar dataKey="ctr" fill="url(#ctrGradient)" radius={[8, 8, 0, 0]} name="CTR %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Ranking with Apple glassmorphism */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/20 dark:border-white/10">
            <h2 className="text-sm font-bold font-display">Ranking por CPL (menor maior)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10">
                  {['#', 'Criativo', 'Gasto', 'Leads', 'CPL', 'CTR', 'Status'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-white/5">
                {ranked.map((c, i) => (
                  <tr key={c.id} className="hover:bg-white/5 dark:hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-6 py-4 font-medium max-w-[200px] truncate">{c.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">R$ {(c.spend || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.leads || 0}</td>
                    <td className="px-6 py-4 font-medium">R$ {(c.cpl || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{(c.ctr || 0).toFixed(2)}%</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xl ${
                        c.effective_status === 'ACTIVE' 
                          ? 'bg-green-100/80 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200/50 dark:border-green-800/30' 
                          : 'bg-gray-100/80 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border border-gray-200/50 dark:border-gray-800/30'
                      }`}>
                        {c.effective_status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Nenhum criativo com leads</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
