import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

  const inputClass = "w-full h-11 bg-white text-black px-3.5 rounded-md text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#366fec]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img 
            src="/logo-light.png" 
            alt="LeadFlow" 
            className="h-8 w-auto mx-auto mb-6 object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            {isForgot ? 'Recuperar senha' : isSignUp ? 'Criar conta' : 'Entrar no LeadFlow'}
          </h1>
          <p className="text-sm text-gray-400">
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
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                required={isSignUp}
                className={inputClass}
              />
            </div>
          )}
          
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className={inputClass}
            />
          </div>

          {!isForgot && (
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className={inputClass}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="w-full h-11 text-white font-semibold rounded-md transition-opacity hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            style={{ backgroundColor: '#366fec' }}
            disabled={submitting}
          >
            {submitting
              ? 'Carregando...'
              : isForgot
              ? 'Enviar link'
              : isSignUp
              ? 'Criar conta'
              : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          {!isForgot && (
            <div>
              <button
                type="button"
                onClick={() => setIsForgot(true)}
                className="text-sm text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setIsForgot(false);
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
            </button>
          </div>
          {isForgot && (
            <div>
              <button
                type="button"
                onClick={() => setIsForgot(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
