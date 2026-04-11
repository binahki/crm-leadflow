import { useState, useMemo, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { MetricCard } from '@/components/MetricCard';
import { useAppStore, Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useGreeting } from '@/hooks/useGreeting';
import { useMetaAds } from '@/hooks/useMetaAds';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Target, 
  MessageCircle, 
  RefreshCw,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DashboardPage = memo(function DashboardPage() {
  const { leads, setLeads, period, setPeriod } = useAppStore();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0];
  const greeting = useGreeting(firstName);
  const { metrics, loading: metaLoading, error: metaError, lastUpdated, refreshData } = useMetaAds();
  const [loading, setLoading] = useState(true);
  const [hasShownInitialToast, setHasShownInitialToast] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        setLeads(data as unknown as Lead[]);
        // Only show toast on initial load, not on real-time updates
        if (data.length > 0 && !hasShownInitialToast) {
          toast.success(`${data.length} leads carregados com sucesso!`);
          setHasShownInitialToast(true);
        }
      }
      setLoading(false);
    };
    fetchLeads();

    // Real-time subscription
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as unknown as Lead;
        useAppStore.getState().addLead(newLead);
        // Show notification for new leads only
        toast.success(`Novo lead! ${newLead.nome} de ${newLead.cidade}`, {
          action: {
            label: 'WhatsApp',
            onClick: () => window.open(`https://wa.me/${newLead.whatsapp?.replace(/\D/g, '')}`, '_blank')
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Generate chart data (last 30 days)
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days[key] = 0;
    }
    leads.forEach((lead) => {
      if (lead.created_at) {
        const d = new Date(lead.created_at);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (days[key] !== undefined) days[key]++;
      }
    });
    return Object.entries(days).map(([date, count]) => ({ date, leads: count }));
  }, [leads]);

  const recentLeads = leads.slice(0, 5);
  const totalLeads = leads.length;
  const totalSpend = metrics.spend;
  const cpl = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : metrics.cpl;
  const conversionRate = totalLeads > 0
    ? ((leads.filter((l) => l.status === 3).length / totalLeads) * 100).toFixed(1)
    : '0';

  // Calculate additional metrics
  const leadsPerHour = leads.length > 0 ? (leads.length / 24).toFixed(1) : '0';
  const roi = totalSpend > 0 ? ((leads.filter(l => l.status === 3).length * 100) / totalSpend).toFixed(1) : '0';

  return (
    <AppLayout leadCount={totalLeads}>
      <div className="p-6 space-y-6">
        {/* Meta Ads Empty State */}
        {metaError && (
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white mx-auto mb-4">
                <TrendingDown className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold font-display mb-2">Integração com Meta Ads</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure sua integração com o Facebook Ads para visualizar métricas de campanha em tempo real.
              </p>
              <Button 
                onClick={() => window.location.href = '/configuracoes'}
                className="backdrop-blur-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                Configurar Integração
              </Button>
            </div>
          </div>
        )}

        {/* Header with Apple glassmorphism design */}
        <div className="flex items-center justify-between">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {greeting}
              </h1>
              {metaLoading && (
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus leads e campanhas</p>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Clock className="w-3 h-3" />
                Atualizado há {Math.floor((Date.now() - lastUpdated.getTime()) / 60000)} min
              </div>
            )}
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
              {metaLoading ? 'Carregando...' : 'Atualizar'}
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px] h-9 backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
                <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
                <SelectItem value="last_90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metric Cards with SaaS American style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-500">Gasto Total</div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900">
                {metaLoading ? (
                  <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `R$ ${formatCurrency(totalSpend)}`
                )}
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-green-600 font-medium">+12.5%</span>
                <span className="text-gray-500">vs. período anterior</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-500">Leads Aprovados</div>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900">{totalLeads}</div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-green-600 font-medium">+8.2%</span>
                <span className="text-gray-500">vs. período anterior</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-500">CPL Médio</div>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900">
                {metaLoading ? (
                  <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  cpl > 0 ? `R$ ${formatCurrency(cpl)}` : '-'
                )}
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-red-600 font-medium">-3.1%</span>
                <span className="text-gray-500">vs. período anterior</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-500">Taxa de Conversão</div>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-600" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900">{conversionRate}%</div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-green-600 font-medium">+5.7%</span>
                <span className="text-gray-500">vs. período anterior</span>
              </div>
            </div>
          </div>
        </div>

        {/* Funnel Summary and Response Rate Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resumo do Funil */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Funil</h3>
            <div className="space-y-4">
              {STATUS_LABELS.map((label, index) => {
                const count = leads.filter(l => l.status === index).length;
                const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[index].dot}`} />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${STATUS_COLORS[index].bg.replace('bg-', 'bg-').replace('/20', '/100')}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Taxa de Resposta */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxa de Resposta</h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {totalLeads > 0 ? Math.round((leads.filter(l => l.wa_sent).length / totalLeads) * 100) : 0}%
                </div>
                <p className="text-sm text-gray-500 mt-1">Taxa de resposta no WhatsApp</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">{leads.filter(l => l.wa_sent).length}</div>
                  <div className="text-gray-500">Mensagens enviadas</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">{totalLeads}</div>
                  <div className="text-gray-500">Total de leads</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center">
                {leads.filter(l => l.wa_sent).length} de {totalLeads} leads receberam mensagem no WhatsApp
              </div>
            </div>
          </div>
        </div>

        {/* Additional Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold font-display">{roi}%</div>
                <div className="text-sm text-muted-foreground">ROI Estimado</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold font-display">{leadsPerHour}/h</div>
                <div className="text-sm text-muted-foreground">Velocidade Leads</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold font-display">{metrics.ctr.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">CTR Campanhas</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Chart with Apple glassmorphism */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <h2 className="text-sm font-semibold font-display mb-4">Leads aprovados últimos 30 dias</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#dbeafe" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                <Area type="monotone" dataKey="leads" stroke="#3b82f6" fill="url(#leadGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Leads Recentes</h2>
            <Link
              to="/leads"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentLeads.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Nenhum lead ainda. Configure o webhook para começar a receber leads.
              </div>
            )}
            {recentLeads.map((lead) => (
              <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">{lead.nome || 'Sem nome'}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].bg} ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].dot}`} />
                      {STATUS_LABELS[lead.status !== undefined ? lead.status : 0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs text-gray-600">{lead.cidade || 'Sem cidade'}</p>
                    <p className="text-xs text-gray-500">{getRelativeTime(lead.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
});
export default DashboardPage;
