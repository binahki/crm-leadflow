import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Campaign } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CampanhasPage() {
  const { leads, campaigns, setCampaigns } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('campanhas').select('*');
      if (data) setCampaigns(data as unknown as Campaign[]);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  const chartData = filtered.slice(0, 8).map((c) => ({
    name: c.name?.substring(0, 12) || 'Campanha',
    spend: c.spend || 0,
    clicks: c.clicks || 0,
  }));

  const totals = {
    spend: campaigns.reduce((s, c) => s + (c.spend || 0), 0),
    impressions: campaigns.reduce((s, c) => s + (c.impressions || 0), 0),
    clicks: campaigns.reduce((s, c) => s + (c.clicks || 0), 0),
    leads: campaigns.reduce((s, c) => s + (c.leads_api || 0), 0),
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-display tracking-tight">Campanhas Meta Ads</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ACTIVE">Ativas</SelectItem>
              <SelectItem value="PAUSED">Pausadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Gasto Total', value: `R$ ${formatCurrency(totals.spend)}` },
            { label: 'Impressões', value: totals.impressions.toLocaleString('pt-BR') },
            { label: 'Cliques', value: totals.clicks.toLocaleString('pt-BR') },
            { label: 'Leads', value: totals.leads },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-bold font-display mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold font-display mb-4">Desempenho por campanha</h2>
          <div className="h-[200px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Gasto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Campanha', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'Leads', 'CPL', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">R$ {formatCurrency(c.spend || 0)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(c.impressions || 0).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(c.clicks || 0).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(c.ctr || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.leads_api || 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.leads_api > 0 ? `R$ ${(c.spend / c.leads_api).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
                      {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma campanha encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
