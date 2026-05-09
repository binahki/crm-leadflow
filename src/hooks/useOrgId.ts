import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAIL = 'admin@floow.com';

// ── Utilitários de localStorage ────────────────────────────────
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

// ── Hook principal ─────────────────────────────────────────────
export function useOrgId() {
  const { user } = useAuth();
  const location = useLocation();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { setOrgId(null); setReady(true); return; }

    // Admin visualizando outra org via impersonation
    const adminViewing = localStorage.getItem('admin_viewing_org');
    if (adminViewing && user.email === ADMIN_EMAIL) {
      setOrgId(adminViewing);
      setReady(true);
      return;
    }

    // Busca org normal via memberships
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setOrgId(data?.org_id || null);
        setReady(true);
      });
  }, [user?.id, location.pathname]); // pathname garante re-leitura ao navegar (impersonation)

  return { orgId, ready };
}
