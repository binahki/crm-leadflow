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
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    leads: 0,
    cpl: 0,
    reach: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    if (!metaToken) {
      setError('Token do Meta Ads não configurado');
      return;
    }

    if (!metaAccountId) {
      setError('ID da conta do Meta Ads não configurado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch campaigns from Meta Ads API
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${metaAccountId}/campaigns?fields=name,status,objective,budget,budget_type,spend,impressions,clicks,ctr,cpm,reach&access_token=${metaToken}`
      );

      if (!campaignsResponse.ok) {
        throw new Error(`HTTP error! status: ${campaignsResponse.status}`);
      }

      const campaignsData = await campaignsResponse.json();
      const campaignsList: Campaign[] = campaignsData.data.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        budget: campaign.budget,
        budget_type: campaign.budget_type,
        spend: campaign.spend || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        ctr: campaign.ctr || 0,
        cpm: campaign.cpm || 0,
        roas: 0, // Will be calculated
        leads_api: 0, // Will be calculated from leads
        reach: campaign.reach || 0,
      }));

      // Fetch leads data from our database to calculate conversion metrics
      const { data: leadsData } = await supabase
        .from('leads')
        .select('created_at, status')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const totalLeads = leadsData?.length || 0;
      const convertedLeads = leadsData?.filter(lead => lead.status === 3).length || 0;

      // Calculate aggregate metrics
      const totalSpend = campaignsList.reduce((sum, campaign) => sum + campaign.spend, 0);
      const totalImpressions = campaignsList.reduce((sum, campaign) => sum + campaign.impressions, 0);
      const totalClicks = campaignsList.reduce((sum, campaign) => sum + campaign.clicks, 0);
      const totalReach = campaignsList.reduce((sum, campaign) => sum + campaign.reach, 0);
      
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;

      const metrics: MetaAdsMetrics = {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: avgCTR,
        cpc: avgCPC,
        leads: totalLeads,
        cpl: avgCPL,
        reach: totalReach,
      };

      // Update campaigns with calculated metrics
      const updatedCampaigns = campaignsList.map(campaign => ({
        ...campaign,
        roas: campaign.spend > 0 ? (convertedLeads * 100) / campaign.spend : 0,
        leads_api: Math.floor((campaign.spend / totalSpend) * totalLeads) || 0,
      }));

      setMetrics(metrics);
      setCampaigns(updatedCampaigns);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erro ao buscar dados do Meta Ads. Verifique suas credenciais.');
      console.error('Meta Ads API error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchMetrics();
  };

  // Auto-refresh every 15 minutes
  useEffect(() => {
    if (!metaToken) return;

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [metaToken, metaAccountId]);

  return {
    metrics,
    loading,
    error,
    lastUpdated,
    refreshData,
  };
}
