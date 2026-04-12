import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Campaign } from '@/stores/appStore';
import { useMetaAds } from '@/hooks/useMetaAds';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Eye, MousePointer, Users, RefreshCw, Megaphone } from 'lucide-react';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CampanhasPage() {
  const { leads, campaigns, setCampaigns } = useAppStore();
  const { refreshData, loading: metaLoading } = useMetaAds();
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    supabase.from('campanhas').select('*').then(({ data }) => {
      if (data) setCampaigns(data as unknown as Campaign[]);
    });
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return campaigns;
    return campaigns.filter(c => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  const chartData = filtered.slice(0, 8).map(c => ({
    name: c.name?.substring(0, 12) || 'Campanha',
    spend: c.spend || 0,
    clicks: c.clicks || 0,
  }));

  const totals = {
    spend:       campaigns.reduce((s, c) => s + (c.spend || 0), 0),
    impressions: campaigns.reduce((s, c) => s + (c.impressions || 0), 0),
    clicks:      campaigns.reduce((s, c) => s + (c.clicks || 0), 0),
    leads:       campaigns.reduce((s, c) => s + (c.leads_api || 0), 0),
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campanhas Meta Ads</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie e monitore suas campanhas</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={refreshData} disabled={metaLoading} className="bg-white border-gray-200">
              <RefreshCw className={`w-4 h-4 mr-2 ${metaLoading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-white border-gray-200">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ACTIVE">Ativas</SelectItem>
                <SelectItem value="PAUSED">Pausadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Gasto Total',  value: `R$ ${formatCurrency(totals.spend)}`,                   icon: DollarSign,   bg: 'bg-green-50',  ic: 'text-green-600' },
            { label: 'Impressões',   value: totals.impressions.toLocaleString('pt-BR'),               icon: Eye,          bg: 'bg-blue-50',   ic: 'text-blue-600' },
            { label: 'Cliques',      value: totals.clicks.toLocaleString('pt-BR'),                    icon: MousePointer, bg: 'bg-purple-50', ic: 'text-purple-600' },
            { label: 'Leads',        value: String(totals.leads),                                     icon: Users,        bg: 'bg-orange-50', ic: 'text-orange-600' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{c.label}</span>
                <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center`}>
                  <c.icon className={`w-4 h-4 ${c.ic}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="font-semibold text-gray-900 mb-5">Desempenho por campanha</h3>
          <div className="h-52">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="spend" fill="url(#spendGradient)" radius={[6, 6, 0, 0]} name="Gasto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Detalhes das Campanhas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Campanha', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'Leads', 'CPL', 'Status'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[200px] truncate">{c.name}</td>
                    <td className="px-6 py-4 text-gray-500">R$ {formatCurrency(c.spend || 0)}</td>
                    <td className="px-6 py-4 text-gray-500">{(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-gray-500">{(c.clicks || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-gray-500">{(c.ctr || 0).toFixed(2)}%</td>
                    <td className="px-6 py-4 text-gray-500">{c.leads_api || 0}</td>
                    <td className="px-6 py-4 text-gray-500">{c.leads_api > 0 ? `R$ ${(c.spend / c.leads_api).toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400 text-sm">Nenhuma campanha encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
