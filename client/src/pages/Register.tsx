import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import { cn, dashboardPathFor } from '../lib/utils';
import { PageHero } from '../components/Layout';
import { Spinner } from '../components/ui/Spinner';
import type { BoardRef, ClassLevel, Role } from '../types';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  className: 'Class 1',
  board: '',
  schoolName: '',
  guardianName: '',
  mobile: '',
  qualification: '',
  bio: ''
};

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'STUDENT', label: 'I am a student', hint: 'Access material and track downloads' },
  { value: 'TEACHER', label: 'I am a teacher', hint: 'Publish material after approval' }
];

export default function Register() {
  const { user, register } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('STUDENT');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: boards } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<BoardRef[]>('/public/boards') });

  useEffect(() => {
    if (!pending || !user) return;
    navigate(dashboardPathFor(user.role), { replace: true });
  }, [pending, user, navigate]);

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        ...(role === 'STUDENT'
          ? {
              className: form.className,
              board: form.board || undefined,
              schoolName: form.schoolName.trim() || undefined,
              guardianName: form.guardianName.trim() || undefined,
              mobile: form.mobile.trim() || undefined
            }
          : { qualification: form.qualification.trim() || undefined, bio: form.bio.trim() || undefined })
      });
      setPending(true);
      notify('Account created. Welcome aboard!', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to create your account', 'error');
    } finally {
      setBusy(false);
    }
  }

  function roleFields() {
    if (role === 'TEACHER') {
      return (
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="qualification">Qualification</label>
            <input
              id="qualification"
              className="field"
              placeholder="e.g. M.Sc. Mathematics, B.Tech"
              value={form.qualification}
              onChange={(e) => update('qualification', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bio">Short bio</label>
            <textarea
              id="bio"
              rows={4}
              className="field resize-y"
              placeholder="Subjects you teach and your experience"
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
            />
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            Teacher profiles are reviewed by an administrator before they appear on the public site.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="className">Class</label>
          <select
            id="className"
            required
            className="field"
            value={form.className}
            onChange={(e) => update('className', e.target.value)}
          >
            {classes?.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="board">Board</label>
          <select id="board" className="field" value={form.board} onChange={(e) => update('board', e.target.value)}>
            <option value="">Select board</option>
            {boards?.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="schoolName">School name</label>
          <input id="schoolName" className="field" value={form.schoolName} onChange={(e) => update('schoolName', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="guardianName">Parent / guardian name</label>
          <input
            id="guardianName"
            className="field"
            value={form.guardianName}
            onChange={(e) => update('guardianName', e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="mobile">Mobile number</label>
          <input id="mobile" inputMode="tel" className="field" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero title="Create Account" subtitle="Register as a student to unlock student-only study material." />
      <section className="bg-mist py-16">
        <div className="container-page">
          <div className="card mx-auto max-w-3xl p-6 sm:p-8">
            <p className="text-sm text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-royal hover:underline">
                Sign in instead
              </Link>
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  aria-pressed={role === option.value}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                    role === option.value
                      ? 'border-royal bg-royal/5 ring-2 ring-royal/20'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                      role === option.value ? 'bg-royal text-white' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {option.value === 'STUDENT' ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-navy">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="name">Full name</label>
                  <input
                    id="name"
                    required
                    minLength={2}
                    className="field"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="reg-email">Email address</label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    className="field"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="field"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                />
              </div>

              {roleFields()}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}


