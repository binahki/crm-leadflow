import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, Campaign, Creative } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, TrendingUp, Users, DollarSign, Target, MousePointer } from 'lucide-react';
import { 
  FunnelChart, 
  Funnel, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { leads, campaigns, creatives } = useAppStore();
  const [period, setPeriod] = useState('last_30d');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter leads based on selected criteria
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];
    
    // Filter by period
    const now = new Date();
    const periodDays = {
      'today': 1,
      'last_7d': 7,
      'last_30d': 30,
      'last_90d': 90
    }[period] || 30;
    
    const cutoffDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    filtered = filtered.filter(lead => 
      lead.created_at && new Date(lead.created_at) >= cutoffDate
    );
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === parseInt(statusFilter));
    }
    
    return filtered;
  }, [leads, period, statusFilter]);

  // Funnel data
  const funnelData = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const completedQuiz = filteredLeads.filter(l => l.quiz_data).length;
    const approved = filteredLeads.filter(l => l.status >= 0).length;
    const converted = filteredLeads.filter(l => l.status === 3).length;
    
    return [
      { name: 'Cliques', value: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0), color: '#0071e3' },
      { name: 'Iniciaram Quiz', value: completedQuiz, color: '#6e40c9' },
      { name: 'Aprovados', value: approved, color: '#f59e0b' },
      { name: 'Convertidos', value: converted, color: '#10b981' }
    ];
  }, [filteredLeads, campaigns]);

  // Conversion rate over time
  const conversionData = useMemo(() => {
    const days: Record<string, { date: string; leads: number; converted: number; rate: number }> = {};
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days[key] = { date: key, leads: 0, converted: 0, rate: 0 };
    }
    
    // Count leads and conversions per day
    filteredLeads.forEach(lead => {
      if (lead.created_at) {
        const d = new Date(lead.created_at);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (days[key]) {
          days[key].leads++;
          if (lead.status === 3) days[key].converted++;
        }
      }
    });
    
    // Calculate rates
    Object.values(days).forEach(day => {
      day.rate = day.leads > 0 ? (day.converted / day.leads) * 100 : 0;
    });
    
    return Object.values(days);
  }, [filteredLeads]);

  // Status distribution
  const statusData = useMemo(() => {
    const statusCounts = [0, 1, 2, 3].map(status => ({
      name: ['Aguardando', 'Em atendimento', 'Proposta enviada', 'Convertida'][status],
      value: filteredLeads.filter(l => l.status === status).length,
      color: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][status]
    }));
    return statusCounts;
  }, [filteredLeads]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Nome', 'WhatsApp', 'Cidade', 'Status', 'Entrada', 'Observações'];
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => [
        `"${lead.nome}"`,
        `"${lead.whatsapp}"`,
        `"${lead.cidade}"`,
        `["Aguardando", "Em atendimento", "Proposta enviada", "Convertida"][lead.status]`,
        `"${lead.entrada}"`,
        `"${lead.observacoes || ''}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Relatório exportado com sucesso!');
  };

  // Export to PDF (placeholder)
  const exportToPDF = () => {
    toast.info('Exportação PDF em desenvolvimento...');
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Relatórios</h1>
                <p className="text-sm text-muted-foreground mt-1">Análise completa de desempenho e conversões</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={exportToPDF}
                variant="outline"
                className="backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button 
                onClick={exportToCSV}
                className="backdrop-blur-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px] backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10">
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
            
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="0">Aguardando</SelectItem>
                  <SelectItem value="1">Em atendimento</SelectItem>
                  <SelectItem value="2">Proposta enviada</SelectItem>
                  <SelectItem value="3">Convertida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-display">{filteredLeads.length}</div>
              <div className="text-sm text-muted-foreground">Leads no período</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Taxa</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-display">
                {filteredLeads.length > 0 ? 
                  ((filteredLeads.filter(l => l.status === 3).length / filteredLeads.length) * 100).toFixed(1) : '0'
                }%
              </div>
              <div className="text-sm text-muted-foreground">Conversão</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Médio</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-display">
                R$ {campaigns.length > 0 ? 
                  (campaigns.reduce((sum, c) => sum + (c.spend || 0), 0) / filteredLeads.length).toFixed(2) : '0'
                }
              </div>
              <div className="text-sm text-muted-foreground">CPL</div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                <MousePointer className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-display">
                {campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground">Cliques</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel Chart */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <h2 className="text-sm font-bold font-display mb-4">Funil de Conversão</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart data={funnelData}>
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
                  <Funnel dataKey="value" fill="#8884d8" />
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
            <h2 className="text-sm font-bold font-display mb-4">Distribuição por Status</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Conversion Rate Over Time */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <h2 className="text-sm font-bold font-display mb-4">Taxa de Conversão ao Longo do Tempo</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionData}>
                <defs>
                  <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
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
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} fill="url(#conversionGradient)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/20 dark:border-white/10">
            <h2 className="text-sm font-bold font-display">Leads Detalhados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 dark:border-white/10">
                  {['Nome', 'WhatsApp', 'Cidade', 'Status', 'Entrada', 'Observações'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-white/5">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 dark:hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-medium">{lead.nome}</td>
                    <td className="px-6 py-4 text-muted-foreground">{lead.whatsapp}</td>
                    <td className="px-6 py-4 text-muted-foreground">{lead.cidade}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xl ${
                        lead.status === 3 ? 'bg-green-100/80 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200/50 dark:border-green-800/30' :
                        lead.status === 2 ? 'bg-purple-100/80 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30' :
                        lead.status === 1 ? 'bg-blue-100/80 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30' :
                        'bg-orange-100/80 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/30'
                      }`}>
                        {['Aguardando', 'Em atendimento', 'Proposta enviada', 'Convertida'][lead.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{lead.entrada}</td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{lead.observacoes || '-'}</td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">Nenhum lead encontrado no período selecionado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
