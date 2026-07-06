import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://obguidmfvfjaekaskgob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZ3VpZG1mdmZqYWVrYXNrZ29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ1MDYsImV4cCI6MjA5MTQyMDUwNn0.PEbZbWCLM-0Fvl8fi5E95t8G6i_LRZPyQrq4Crk03CY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying the 20 most recent leads');
  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, utm_source, utm_campaign, utm_medium, utm_content, created_at, status, org_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  console.log(`Found ${data.length} leads:`);
  data.forEach((l, i) => {
    console.log(`${i+1}. Name: "${l.nome}" | ID: ${l.id} | Created: ${l.created_at} | Status: ${l.status}`);
    console.log(`   UTMs: source="${l.utm_source}", medium="${l.utm_medium}", campaign="${l.utm_campaign}", content="${l.utm_content}"`);
  });
}

run();

