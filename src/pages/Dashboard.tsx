import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { MetricCard } from '@/components/MetricCard';
import { useAppStore, Lead } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Users, TrendingUp, Target, MessageCircle } from 'lucide-react';
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

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const { leads, setLeads, period, setPeriod } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setLeads(data as unknown as Lead[]);
      setLoading(false);
    };
    fetchLeads();

    // Real-time subscription
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newLead = payload.new as unknown as Lead;
          useAppStore.getState().addLead(newLead);
          // Show notification
          if (Notification.permission === 'granted') {
            new Notification('Novo lead!', { body: `${newLead.nome} de ${newLead.cidade}` });
          }
        }
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
  // Placeholder metrics (will be replaced with real Meta data)
  const totalSpend = 0;
  const cpl = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : 0;
  const conversionRate = totalLeads > 0
    ? ((leads.filter((l) => l.status === 3).length / totalLeads) * 100).toFixed(1)
    : '0';

  return (
    <AppLayout leadCount={totalLeads}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral dos seus leads e campanhas</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] h-9">
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

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Gasto Total" value={`R$ ${formatCurrency(totalSpend)}`} icon={DollarSign} />
          <MetricCard label="Leads Aprovados" value={totalLeads} icon={Users} subtitle="Via webhook" />
          <MetricCard label="CPL Médio" value={cpl > 0 ? `R$ ${formatCurrency(cpl)}` : '-'} icon={TrendingUp} />
          <MetricCard label="Taxa Conversão" value={`${conversionRate}%`} icon={Target} />
        </div>

        {/* Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold font-display mb-4">Leads aprovados — últimos 30 dias</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fill="url(#leadGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold font-display">Leads Recentes</h2>
          </div>
          <div className="divide-y divide-border">
            {recentLeads.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum lead ainda. Configure o webhook para começar a receber leads.
              </div>
            )}
            {recentLeads.map((lead) => (
              <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground">{lead.cidade}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{lead.entrada}</span>
                  <a
                    href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success hover:bg-success/20 transition-colors"
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
}
