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
          <span className="text-xl font-display font-medium tracking-tight text-foreground">TickTick</span>
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
