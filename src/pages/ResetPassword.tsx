import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const { user, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await updatePassword(password);
    if (error) toast.error(error.message);
    else {
      toast.success('Senha atualizada com sucesso!');
      setDone(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold font-display tracking-tight">Nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina sua nova senha abaixo</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Nova senha
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
          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Atualizar senha'}
          </Button>
        </form>
      </div>
    </div>
  );
}
