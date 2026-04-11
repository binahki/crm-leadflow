import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isForgot) {
      const { error } = await resetPassword(email);
      if (error) toast.error(error.message);
      else toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setSubmitting(false);
      return;
    }

    if (isSignUp) {
      const { error } = await signUp(email, password, fullName);
      if (error) toast.error(error.message);
      else toast.success('Conta criada! Verifique seu email para confirmar.');
    } else {
      const { error } = await signIn(email, password);
      if (error) toast.error('Email ou senha incorretos.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-xl mx-auto mb-4 font-display">
            L
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight">
            {isForgot ? 'Recuperar senha' : isSignUp ? 'Criar conta' : 'Entrar no LeadFlow'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isForgot
              ? 'Insira seu email para receber o link de recuperação'
              : isSignUp
              ? 'Crie sua conta para começar'
              : 'CRM Intelligence para gestão de leads'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Nome completo
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                required={isSignUp}
                className="h-11"
              />
            </div>
          )}
          
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="h-11"
            />
          </div>

          {!isForgot && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-11"
              />
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting
              ? 'Carregando...'
              : isForgot
              ? 'Enviar link'
              : isSignUp
              ? 'Criar conta'
              : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {!isForgot && (
            <button
              onClick={() => setIsForgot(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Esqueceu a senha?
            </button>
          )}
          <div>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setIsForgot(false);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
            </button>
          </div>
          {isForgot && (
            <button
              onClick={() => setIsForgot(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
