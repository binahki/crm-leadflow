import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAIL  = 'murilosilvestredias@gmail.com';
const KEY_ORG_ID   = 'admin_viewing_org';
const KEY_ORG_NAME = 'admin_viewing_org_name';

// Cache de membership: evita re-query a cada troca de rota para usuários normais.
// Resetado apenas quando o userId muda (logout/login).
const _membershipCache: Record<string, string> = {};

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
    return { orgId, orgName: localStorage.getItem(KEY_ORG_NAME) || '' };
  } catch { return null; }
}

// ── Hook principal ─────────────────────────────────────────────
/**
 * Fonte única de verdade para org_id.
 *
 * PROBLEMA RESOLVIDO: o efeito depende de [user?.id, location.pathname].
 * Quando o admin faz "Acessar" e navega para '/', o pathname muda,
 * o efeito re-executa e lê o novo valor do localStorage imediatamente.
 * Para usuários normais, o resultado é cacheado em memória (_membershipCache)
 * para evitar N queries desnecessárias a cada troca de rota.
 *
 * GARANTIA: orgId nunca é undefined — é string | null.
 * Queries SÓ devem executar quando ready=true && orgId !== null.
 */
export function useOrgId() {
  const { user } = useAuth();
  const location = useLocation();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { setOrgId(null); setReady(true); return; }

    // Admin: re-verifica localStorage a cada mudança de rota.
    // Isso é necessário porque quando o admin clica "Acessar" e navega,
    // o user.id não muda (mesmo JWT), mas o pathname muda.
    if (user.email === ADMIN_EMAIL) {
      const adminViewing = localStorage.getItem(KEY_ORG_ID);
      if (adminViewing) {
        setOrgId(adminViewing);
        setReady(true);
        return;
      }
    }

    // Usuário normal (ou admin sem impersonation):
    // usa cache para não re-query a cada navegação.
    if (_membershipCache[user.id]) {
      setOrgId(_membershipCache[user.id]);
      setReady(true);
      return;
    }

    // Primeira vez: busca no banco e armazena no cache.
    setReady(false);
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const id = data?.org_id || null;
        if (id) _membershipCache[user.id] = id;
        setOrgId(id);
        setReady(true);
      })
      .catch(() => { setOrgId(null); setReady(true); });
  }, [user?.id, location.pathname]); // pathname garante re-execução ao navegar

  return { orgId, ready };
}
