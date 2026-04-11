import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Campaign } from '@/stores/appStore';
import { useMetaAds } from '@/hooks/useMetaAds';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Eye, MousePointer, Users, RefreshCw, Target } from 'lucide-react';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CampanhasPage() {
  const { leads, campaigns, setCampaigns } = useAppStore();
  const { refreshData, loading: metaLoading } = useMetaAds();
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
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Campanhas Meta Ads</h1>
                <p className="text-sm text-muted-foreground mt-1">Gerencie e monitore suas campanhas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={metaLoading}
                className="backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${metaLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10">
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
        </div>

        {/* Stats with Apple glassmorphism */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-display">R$ {formatCurrency(totals.spend)}</div>
              <div className="text-sm text-muted-foreground">Gasto Total</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-display">{totals.impressions.toLocaleString('pt-BR')}</div>
              <div className="text-sm text-muted-foreground">Impressões</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                <MousePointer className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-display">{totals.clicks.toLocaleString('pt-BR')}</div>
              <div className="text-sm text-muted-foreground">Cliques</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-display">{totals.leads}</div>
              <div className="text-sm text-muted-foreground">Leads</div>
            </div>
          </div>
        </div>

        {/* Chart with Apple glassmorphism */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <h2 className="text-sm font-bold font-display mb-4">Desempenho por campanha</h2>
          <div className="h-[200px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0071e3" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6e40c9" stopOpacity={0.4} />
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
                  <Bar dataKey="spend" fill="url(#spendGradient)" radius={[8, 8, 0, 0]} name="Gasto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Table with Apple glassmorphism */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/20 dark:border-white/10">
            <h2 className="text-sm font-bold font-display">Detalhes das Campanhas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10">
                  {['Campanha', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'Leads', 'CPL', 'Status'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-white/5">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 dark:hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-medium max-w-[200px] truncate">{c.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">R$ {formatCurrency(c.spend || 0)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-muted-foreground">{(c.clicks || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-muted-foreground">{(c.ctr || 0).toFixed(2)}%</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.leads_api || 0}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.leads_api > 0 ? `R$ ${(c.spend / c.leads_api).toFixed(2)}` : '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xl ${
                        c.status === 'ACTIVE' 
                          ? 'bg-green-100/80 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200/50 dark:border-green-800/30' 
                          : 'bg-gray-100/80 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border border-gray-200/50 dark:border-gray-800/30'
                      }`}>
                        {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">Nenhuma campanha encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
