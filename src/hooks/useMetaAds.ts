import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';

interface MetaAdsMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  reach: number;
  cplRealTime: number; // CPL em tempo real based on FB leads
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
  budget_type: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
  leads_api: number;
  reach: number;
}

export function useMetaAds() {
  const { metaAccountId, metaToken, setCampaigns, setCreatives } = useAppStore();
  const [metrics, setMetrics] = useState<MetaAdsMetrics>({
    spend: 0, impressions: 0, clicks: 0,
    ctr: 0, cpc: 0, leads: 0, cpl: 0, reach: 0, cplRealTime: 0,
  });
  const [loading, setLoading]       = useState(false);
  const [error,   setError]         = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!metaToken)     { setError('Token do Meta Ads não configurado'); return; }
    if (!metaAccountId) { setError('ID da conta do Meta Ads não configurado'); return; }

    setLoading(true);
    setError(null);

    try {
      // ── 1. Busca campanhas com insights embutidos (date_preset=last_30d) ──
      const fields = [
        'id', 'name', 'status', 'objective',
        'daily_budget', 'lifetime_budget',
        'insights.date_preset(last_30d){spend,impressions,clicks,ctr,cpm,reach,actions}',
      ].join(',');

      const url = `https://graph.facebook.com/v18.0/act_${metaAccountId}/campaigns?fields=${fields}&limit=20&access_token=${metaToken}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      const campaignsList: Campaign[] = (data.data || []).map((c: any) => {
        const ins  = c.insights?.data?.[0] || {};
        const spend       = parseFloat(ins.spend || '0');
        const impressions = parseInt(ins.impressions || '0', 10);
        const clicks      = parseInt(ins.clicks || '0', 10);
        const reach       = parseInt(ins.reach || '0', 10);
        const ctr         = parseFloat(ins.ctr || '0');
        const cpm         = parseFloat(ins.cpm || '0');

        // Leads vindos de actions (lead_generation ou offsite_conversion.fb_pixel_lead)
        const actions: any[] = ins.actions || [];
        const leadsFromAds = actions
          .filter((a: any) => ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'].includes(a.action_type))
          .reduce((sum: number, a: any) => sum + parseInt(a.value || '0', 10), 0);

        const budget = parseFloat(c.daily_budget || c.lifetime_budget || '0') / 100;

        return {
          id:          c.id,
          name:        c.name,
          status:      c.status,
          objective:   c.objective || '',
          budget,
          budget_type: c.daily_budget ? 'daily' : 'lifetime',
          spend,
          impressions,
          clicks,
          ctr,
          cpm,
          roas:      0,
          leads_api: leadsFromAds,
          reach,
        };
      });

      // ── 2. Leads do Supabase (últimos 30 dias) ──
      const { data: leadsData } = await supabase
        .from('leads')
        .select('created_at, status, utm_source')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const totalLeadsDB  = leadsData?.length || 0;
      const convertedLeads = leadsData?.filter(l => Number(l.status) === 3).length || 0;

      // ── 3. Métricas agregadas ──
      const totalSpend       = campaignsList.reduce((s, c) => s + c.spend, 0);
      const totalImpressions = campaignsList.reduce((s, c) => s + c.impressions, 0);
      const totalClicks      = campaignsList.reduce((s, c) => s + c.clicks, 0);
      const totalReach       = campaignsList.reduce((s, c) => s + c.reach, 0);
      const totalLeadsAds    = campaignsList.reduce((s, c) => s + c.leads_api, 0);

      // Usa leads da API se disponível, senão usa Supabase
      // Total leads captured in our system originating from Facebook (utm_source = "FB")
      const totalLeadsFB = (leadsData || []).filter((l: any) => {
        if (!l.utm_source) return false;
        const src = l.utm_source.toUpperCase();
        return src === 'FB' || src === 'TRÁFEGO PAGO' || src === 'TRAFEGO PAGO';
      }).length;
      
      // Use API leads if available, otherwise fall back to DB count (including all sources)
      const totalLeads = totalLeadsAds > 0 ? totalLeadsAds : totalLeadsDB;
      
      // Real‑time CPL based exclusively on FB‑sourced leads
      const cplRealTimeValue = totalLeadsFB > 0 ? totalSpend / totalLeadsFB : 0;

      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const avgCPL = totalLeads  > 0 ? totalSpend / totalLeads  : 0;

      // ── 4. Atualiza campanhas com leads proporcionais se API não retornou ──
      const updatedCampaigns = campaignsList.map(c => ({
        ...c,
        leads_api: c.leads_api > 0
          ? c.leads_api
          : totalSpend > 0 ? Math.round((c.spend / totalSpend) * totalLeadsDB) : 0,
        roas: c.spend > 0 ? (convertedLeads * 100) / c.spend : 0,
      }));

      setMetrics({ 
        spend: totalSpend, 
        impressions: totalImpressions, 
        clicks: totalClicks, 
        ctr: avgCTR, 
        cpc: avgCPC, 
        leads: totalLeads, 
        cpl: avgCPL, 
        reach: totalReach,
        cplRealTime: cplRealTimeValue
      });
      setCampaigns(updatedCampaigns);
      setLastUpdated(new Date());

    } catch (err: any) {
      const msg = err?.message || 'Erro ao buscar dados do Meta Ads';
      setError(msg);
      console.error('[useMetaAds]', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!metaToken) return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [metaToken, metaAccountId]); // eslint-disable-line

  return { metrics, loading, error, lastUpdated, refreshData: fetchMetrics };
}
