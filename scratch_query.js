const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://obguidmfvfjaekaskgob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZ3VpZG1mdmZqYWVrYXNrZ29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ1MDYsImV4cCI6MjA5MTQyMDUwNn0.PEbZbWCLM-0Fvl8fi5E95t8G6i_LRZPyQrq4Crk03CY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('ai_optimization_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('AI Optimization Logs:');
  console.log(JSON.stringify(data, null, 2));
}

run();
