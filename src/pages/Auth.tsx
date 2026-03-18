import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'forgot';

const Auth = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      } else if (mode === 'signup') {
        const { error, session } = await signUp(email, password, displayName);
        if (error) throw error;
        if (session) {
          navigate('/');
        } else {
          setMessage('Check your email to confirm your account.');
        }
      } else {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMessage('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-grid pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <Circle className="h-5 w-5 fill-primary text-primary" />
          <span className="text-xl font-display font-medium tracking-tight text-foreground">Todoist</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-display font-medium text-foreground mb-1">
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Get started with Todoist.' : 'Enter your email to reset.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-primary">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium protocol-transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {mode === 'signin' && (
              <>
                <button onClick={() => setMode('forgot')} className="text-xs text-muted-foreground hover:text-foreground protocol-transition block mx-auto">
                  Forgot password?
                </button>
                <button onClick={() => setMode('signup')} className="text-xs text-muted-foreground hover:text-foreground protocol-transition block mx-auto">
                  Don't have an account? <span className="text-primary">Sign up</span>
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => setMode('signin')} className="text-xs text-muted-foreground hover:text-foreground protocol-transition block mx-auto">
                Already have an account? <span className="text-primary">Sign in</span>
              </button>
            )}
            {mode === 'forgot' && (
              <button onClick={() => setMode('signin')} className="text-xs text-muted-foreground hover:text-foreground protocol-transition block mx-auto">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
