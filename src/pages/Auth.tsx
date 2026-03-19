import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

type Mode = 'signin' | 'signup' | 'forgot';

const Auth = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): string | null => {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required.';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid email address.';
    const domain = trimmed.split('@')[1]?.toLowerCase();
    
    // Block disposable/temporary email providers
    const disposableDomains = ['mailinator.com', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'yopmail.com', 'sharklasers.com', 'trashmail.com', 'fakeinbox.com', 'tempail.com', 'dispostable.com', 'maildrop.cc', 'guerrillamailblock.com', 'grr.la', 'getairmail.com', 'mohmal.com', 'burnermail.io'];
    if (disposableDomains.includes(domain)) return 'Disposable email addresses are not allowed.';
    
    // Block common fake/test domains
    const blockedDomains = ['test.com', 'example.com', 'example.org', 'example.net', 'fake.com', 'abc.com', 'xyz.com', 'asdf.com', 'qwerty.com', 'none.com', 'noemail.com', 'nope.com'];
    if (blockedDomains.includes(domain)) return 'Please use a real email address.';
    
    // Block domains that look fake (very short TLD or suspicious patterns)
    const tld = domain.split('.').pop();
    if (tld && tld.length < 2) return 'Please enter a valid email address.';
    
    // Only allow well-known TLDs
    const validTLDs = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'in', 'jp', 'br', 'it', 'nl', 'se', 'no', 'fi', 'dk', 'es', 'pt', 'ru', 'cn', 'kr', 'za', 'mx', 'ar', 'cl', 'nz', 'ie', 'be', 'ch', 'at', 'pl', 'cz', 'hu', 'ro', 'bg', 'hr', 'sk', 'si', 'lt', 'lv', 'ee', 'app', 'dev', 'me', 'info', 'biz', 'tech', 'online', 'store', 'site', 'xyz', 'ai', 'cloud', 'live', 'pro', 'cc', 'tv', 'id', 'pk', 'bd', 'lk', 'ae', 'sa', 'qa', 'om', 'kw', 'bh', 'sg', 'my', 'ph', 'th', 'vn', 'tw', 'hk'];
    if (tld && !validTLDs.includes(tld)) return 'Please use a valid email domain.';
    
    return null;
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone) return null; // optional
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s()-]/g, ''))) return 'Please enter a valid phone number (e.g. +1234567890).';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }

    if (mode === 'signup') {
      const phoneError = validatePhone(phoneNumber);
      if (phoneError) { setError(phoneError); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        navigate('/');
      } else if (mode === 'signup') {
        const { error, session } = await signUp(email.trim(), password, displayName.trim(), phoneNumber.trim());
        if (error) throw error;
        if (session) {
          navigate('/');
        } else {
          setMessage('Check your email to confirm your account.');
        }
      } else {
        const { error } = await resetPassword(email.trim());
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

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-20 p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground protocol-transition"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <Clock className="h-5 w-5 text-primary" />
          <span className="text-xl font-display font-medium tracking-tight text-foreground">PTT</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-display font-medium text-foreground mb-1">
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Get started with TickTick.' : 'Enter your email to reset.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
                />
                <input
                  type="tel"
                  placeholder="Phone number (e.g. +1234567890)"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
                />
              </>
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

          {/* Divider */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or continue with</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      const result = await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                      if (result?.error) throw result.error;
                    } catch (err: any) {
                      setError(err.message || 'Google sign-in failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-foreground bg-card hover:bg-accent protocol-transition disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      const result = await lovable.auth.signInWithOAuth("apple", {
                        redirect_uri: window.location.origin,
                      });
                      if (result?.error) throw result.error;
                    } catch (err: any) {
                      setError(err.message || 'Apple sign-in failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-foreground bg-card hover:bg-accent protocol-transition disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Apple
                </button>
              </div>
            </>
          )}
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
