import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Circle } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setReady(true);
    } else {
      // Also check if user has a session (from the recovery link)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
        else navigate('/auth');
      });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-grid pointer-events-none z-0" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Circle className="h-5 w-5 fill-primary text-primary" />
          <span className="text-xl font-display font-medium tracking-tight text-foreground">Todoist</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-display font-medium text-foreground mb-1">Set new password</h2>
          <p className="text-sm text-muted-foreground mb-6">Enter your new password below.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition" />
            <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
              className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium protocol-transition hover:opacity-90 disabled:opacity-50">
              {loading ? '...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
