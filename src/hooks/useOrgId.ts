import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAIL   = 'murilosilvestredias@gmail.com';
const KEY_ORG_ID    = 'admin_viewing_org';
const KEY_ORG_NAME  = 'admin_viewing_org_name';

// ── Utilitários de localStorage ────────────────────────────────
export function setAdminViewingOrg(orgId: string, orgName: string) {
  try {
    localStorage.setItem(KEY_ORG_ID,   orgId);
    localStorage.setItem(KEY_ORG_NAME, orgName);
  } catch { /* SSR/private mode */ }
}

export function clearAdminViewingOrg() {
  try {
    localStorage.removeItem(KEY_ORG_ID);
    localStorage.removeItem(KEY_ORG_NAME);
  } catch {}
}

export function getAdminViewingOrg(): { orgId: string; orgName: string } | null {
  try {
    const orgId = localStorage.getItem(KEY_ORG_ID);
    if (!orgId) return null;
    const orgName = localStorage.getItem(KEY_ORG_NAME) || '';
    return { orgId, orgName };
  } catch { return null; }
}

// ── Hook principal ─────────────────────────────────────────────
/**
 * Retorna o org_id correto para o usuário atual.
 * - Se o usuário for o admin E tiver 'admin_viewing_org' no localStorage,
 *   usa esse org_id (modo impersonation).
 * - Caso contrário, busca via tabela memberships.
 */
export function useOrgId() {
  const { user } = useAuth();

  const [orgId,       setOrgId]       = useState<string | null>(null);
  const [orgName,     setOrgName]     = useState<string>('');
  const [isAdminView, setIsAdminView] = useState(false);
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    if (!user) { setReady(true); return; }

    // Admin impersonando outra org
    if (user.email === ADMIN_EMAIL) {
      const override = getAdminViewingOrg();
      if (override) {
        setOrgId(override.orgId);
        setOrgName(override.orgName);
        setIsAdminView(true);
        setReady(true);
        return;
      }
    }

    // Usuário normal — busca via memberships
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.org_id) setOrgId(data.org_id);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [user?.id]);

  return { orgId, orgName, isAdminView, ready, loading: !ready };
}
