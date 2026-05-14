import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Renovação silenciosa de token — não altera estado de loading
      if (event === 'TOKEN_REFRESHED') return;

      // Sessão encerrada ou token expirado sem possibilidade de refresh
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }

      resolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Carrega sessão inicial — sempre resolve o loading, mesmo em caso de erro
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!resolved) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        // Falha de rede ou refresh_token inválido — encerra loading para não travar a tela
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          first_name: fullName?.split(' ')[0]
        }
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  return { user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword };
}
