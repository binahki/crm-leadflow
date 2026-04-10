import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Creative } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CriativosPage() {
  const { leads, creatives, setCreatives } = useAppStore();

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
        <h1 className="text-xl font-bold font-display tracking-tight">Criativos</h1>

        {/* CTR Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold font-display mb-4">CTR por criativo</h2>
          <div className="h-[200px]">
            {ctrData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ctrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="ctr" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} name="CTR %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold font-display">Ranking por CPL (menor → maior)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['#', 'Criativo', 'Gasto', 'Leads', 'CPL', 'CTR', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((c, i) => (
                <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">R$ {(c.spend || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.leads || 0}</td>
                  <td className="px-4 py-3 font-medium">R$ {(c.cpl || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(c.ctr || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.effective_status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
                      {c.effective_status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum criativo com leads</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
