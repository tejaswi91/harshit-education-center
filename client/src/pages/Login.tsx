import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/api';
import { dashboardPathFor } from '../lib/utils';
import { PageHero } from '../components/Layout';
import { Spinner } from '../components/ui/Spinner';

const PERKS = [
  { icon: Sparkles, text: 'Download free notes, worksheets and previous year papers' },
  { icon: ShieldCheck, text: 'One-time access to paid material for a full year' },
  { icon: Lock, text: 'Keep your favourites and download history in one place' }
];

export default function Login() {
  const { user, login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  // `login` resolves before React re-renders the auth context, so redirect once the user lands.
  useEffect(() => {
    if (!pending || !user) return;
    navigate(from ?? dashboardPathFor(user.role), { replace: true });
  }, [pending, user, navigate, from]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      setPending(true);
      notify('Welcome back!', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to sign in right now', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero title="Sign In" subtitle="Access your study material, downloads and dashboard." />
      <section className="bg-mist py-16">
        <div className="container-page grid items-start gap-10 lg:grid-cols-2">
          <div className="card p-6 sm:p-8">
            <h1 className="font-display text-xl font-extrabold text-navy">Sign in to your account</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Need an account?{' '}
              <Link to="/contact" className="font-semibold text-royal hover:underline">
                Contact the institute
              </Link>
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="field-label" htmlFor="email">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="field pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="field pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {busy ? 'Signing in…' : 'Sign in'}
                {!busy ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          </div>

          <div className="card bg-navy p-6 text-white sm:p-8">
            <h2 className="font-display text-lg font-extrabold">Institute account access</h2>
            <ul className="mt-5 space-y-4">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-gold">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-300">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-7 rounded-xl bg-white/5 p-4 text-sm text-slate-300">
              Student and teacher accounts are created by an institute administrator. Contact the institute if you need access.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}