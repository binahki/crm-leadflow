import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Creative } from '@/stores/appStore';
import { useMetaAds } from '@/hooks/useMetaAds';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Image, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CriativosPage() {
  const { leads, creatives, setCreatives } = useAppStore();
  const { refreshData, loading: metaLoading } = useMetaAds();

  useEffect(() => {
    supabase.from('criativos').select('*').then(({ data }) => {
      if (data) setCreatives(data as unknown as Creative[]);
    });
  }, []);

  const ranked = useMemo(() =>
    [...creatives].filter(c => (c.leads || 0) > 0).sort((a, b) => (a.cpl || 999) - (b.cpl || 999)),
    [creatives]
  );

  const ctrData = creatives.slice(0, 10).map(c => ({
    name: c.name?.substring(0, 12) || 'Criativo',
    ctr: c.ctr || 0,
  }));

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Criativos</h1>
            <p className="text-sm text-gray-400 mt-0.5">Analise o desempenho dos seus criativos</p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={metaLoading} className="bg-white border-gray-200">
            <RefreshCw className={`w-4 h-4 mr-2 ${metaLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        {/* CTR Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="font-semibold text-gray-900 mb-5">CTR por criativo</h3>
          <div className="h-52">
            {ctrData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ctrData}>
                  <defs>
                    <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="ctr" fill="url(#ctrGradient)" radius={[6, 6, 0, 0]} name="CTR %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Ranking table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Ranking por CPL (menor → maior)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Criativo', 'Gasto', 'Leads', 'CPL', 'CTR', 'Status'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ranked.map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-400">{i + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[200px] truncate">{c.name}</td>
                    <td className="px-6 py-4 text-gray-500">R$ {(c.spend || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-500">{c.leads || 0}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">R$ {(c.cpl || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-500">{(c.ctr || 0).toFixed(2)}%</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${c.effective_status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.effective_status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">Nenhum criativo com leads</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
