import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAIL = 'admin@floow.com';

export function setAdminViewingOrg(orgId: string, orgNome: string) {
  localStorage.setItem('admin_viewing_org',      orgId);
  localStorage.setItem('admin_viewing_org_nome', orgNome);
}

export function clearAdminViewingOrg() {
  localStorage.removeItem('admin_viewing_org');
  localStorage.removeItem('admin_viewing_org_nome');
}

export function getAdminViewingOrg(): { orgId: string; orgName: string } | null {
  const orgId = localStorage.getItem('admin_viewing_org');
  if (!orgId) return null;
  return { orgId, orgName: localStorage.getItem('admin_viewing_org_nome') || '' };
}

export function useOrgId() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { setReady(true); return; }

    // Admin: lê direto do localStorage no momento do effect.
    // window.location.href = '/' força reload completo, então o useEffect
    // executa com o valor correto já presente no localStorage.
    if (user.email === ADMIN_EMAIL) {
      const adminViewing = localStorage.getItem('admin_viewing_org');
      setOrgId(adminViewing); // pode ser null (sem impersonation) ou o orgId do cliente
      setReady(true);
      return;
    }

    // Usuário normal: busca via memberships
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setOrgId(data?.org_id || null);
        setReady(true);
      });
  }, [user?.id]);

  return { orgId, ready };
}
