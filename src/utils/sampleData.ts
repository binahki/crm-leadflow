import { Campaign, Creative } from '@/stores/appStore';

interface SampleLead {
  id: string;
  nome: string;
  whatsapp: string;
  cidade: string;
  status: number;
  entrada: string;
  wa_sent: boolean;
  created_at: string;
  observacoes?: string;
  quiz_data?: Record<string, unknown>;
}

export const sampleLeads: SampleLead[] = [
  {
    id: '1',
    nome: 'Ana Silva',
    whatsapp: '(11) 98765-4321',
    cidade: 'São Paulo',
    status: 0,
    entrada: '10/04 14:30',
    wa_sent: false,
    created_at: new Date().toISOString(),
    quiz_data: {
      idade: '25-34',
      interesse: 'alto',
      experiencia: 'iniciante'
    }
  },
  {
    id: '2',
    nome: 'Maria Santos',
    whatsapp: '(21) 91234-5678',
    cidade: 'Rio de Janeiro',
    status: 1,
    entrada: '10/04 13:15',
    wa_sent: true,
    observacoes: 'Interessada em kits de verão',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    quiz_data: {
      idade: '18-24',
      interesse: 'médio',
      experiencia: 'intermediário'
    }
  },
  {
    id: '3',
    nome: 'Carla Oliveira',
    whatsapp: '(31) 99876-5432',
    cidade: 'Belo Horizonte',
    status: 2,
    entrada: '10/04 11:45',
    wa_sent: true,
    observacoes: 'Aguardando confirmação de proposta',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    quiz_data: {
      idade: '35-44',
      interesse: 'alto',
      experiencia: 'avançado'
    }
  },
  {
    id: '4',
    nome: 'Fernanda Costa',
    whatsapp: '(41) 97654-3210',
    cidade: 'Curitiba',
    status: 3,
    entrada: '09/04 16:20',
    wa_sent: true,
    observacoes: 'Convertida - comprou kit inicial',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    quiz_data: {
      idade: '25-34',
      interesse: 'alto',
      experiencia: 'intermediário'
    }
  },
  {
    id: '5',
    nome: 'Juliana Pereira',
    whatsapp: '(51) 96543-2109',
    cidade: 'Porto Alegre',
    status: 0,
    entrada: '09/04 15:10',
    wa_sent: false,
    created_at: new Date(Date.now() - 90000000).toISOString(),
    quiz_data: {
      idade: '18-24',
      interesse: 'médio',
      experiencia: 'iniciante'
    }
  }
];

export const sampleCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Campanha Principal - Verão 2024',
    status: 'ACTIVE',
    objective: 'LEADS',
    budget: 1000,
    budget_type: 'daily',
    spend: 850.50,
    impressions: 45000,
    clicks: 1250,
    ctr: 2.78,
    cpm: 18.90,
    roas: 3.2,
    leads_api: 45,
    reach: 38000
  },
  {
    id: '2',
    name: 'Campanha Secundária - Iniciantes',
    status: 'ACTIVE',
    objective: 'LEADS',
    budget: 500,
    budget_type: 'daily',
    spend: 425.75,
    impressions: 22000,
    clicks: 680,
    ctr: 3.09,
    cpm: 19.35,
    roas: 2.8,
    leads_api: 28,
    reach: 18500
  },
  {
    id: '3',
    name: 'Campanha Remarketing',
    status: 'PAUSED',
    objective: 'CONVERSIONS',
    budget: 300,
    budget_type: 'daily',
    spend: 150.25,
    impressions: 8000,
    clicks: 320,
    ctr: 4.0,
    cpm: 18.78,
    roas: 4.5,
    leads_api: 15,
    reach: 6500
  }
];

export const sampleCreatives: Creative[] = [
  {
    id: '1',
    name: 'Criativo Video - Produto em Ação',
    thumbnail_url: 'https://example.com/thumb1.jpg',
    effective_status: 'ACTIVE',
    adset_name: 'Adset Principal',
    campaign_name: 'Campanha Principal - Verão 2024',
    spend: 350.25,
    impressions: 18000,
    clicks: 520,
    ctr: 2.89,
    cpl: 18.50,
    leads: 19
  },
  {
    id: '2',
    name: 'Criativo Carrossel - Benefícios',
    thumbnail_url: 'https://example.com/thumb2.jpg',
    effective_status: 'ACTIVE',
    adset_name: 'Adset Secundário',
    campaign_name: 'Campanha Secundária - Iniciantes',
    spend: 225.50,
    impressions: 12000,
    clicks: 380,
    ctr: 3.17,
    cpl: 15.95,
    leads: 14
  },
  {
    id: '3',
    name: 'Criativo Imagem - Antes e Depois',
    thumbnail_url: 'https://example.com/thumb3.jpg',
    effective_status: 'ACTIVE',
    adset_name: 'Adset Principal',
    campaign_name: 'Campanha Principal - Verão 2024',
    spend: 275.75,
    impressions: 14000,
    clicks: 420,
    ctr: 3.0,
    cpl: 16.42,
    leads: 17
  },
  {
    id: '4',
    name: 'Criativo Stories - Tutorial',
    thumbnail_url: 'https://example.com/thumb4.jpg',
    effective_status: 'PAUSED',
    adset_name: 'Adset Remarketing',
    campaign_name: 'Campanha Remarketing',
    spend: 89.25,
    impressions: 4500,
    clicks: 180,
    ctr: 4.0,
    cpl: 12.50,
    leads: 7
  }
];

// Function to insert sample data into Supabase
export async function insertSampleData() {
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    // Insert leads
    for (const lead of sampleLeads) {
      await supabase.from('leads').insert({
        ...lead,
        quiz_data: lead.quiz_data ? JSON.stringify(lead.quiz_data) : null
      });
    }
    
    // Insert campaigns
    for (const campaign of sampleCampaigns) {
      await supabase.from('campanhas').insert(campaign);
    }
    
    // Insert creatives
    for (const creative of sampleCreatives) {
      await supabase.from('criativos').insert(creative);
    }
    
    console.log('Sample data inserted successfully');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}
