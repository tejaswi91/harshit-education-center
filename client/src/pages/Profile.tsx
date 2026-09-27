import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save, ShieldCheck, User as UserIcon } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { humanise } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHero } from '../components/Layout';
import { ErrorState, Spinner } from '../components/ui/Spinner';
import type { BoardRef, ClassLevel, SessionResponse, StudentProfileData, TeacherProfileData } from '../types';

const emptyProfile = {
  name: '',
  className: '',
  board: '',
  schoolName: '',
  guardianName: '',
  mobile: '',
  qualification: '',
  bio: ''
};

const emptyPasswords = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function Profile() {
  const { refresh } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProfile);
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionResponse>('/auth/me')
  });

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: boards } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<BoardRef[]>('/public/boards') });

  // Seed the editable form once the session payload arrives.
  useEffect(() => {
    if (!data) return;
    const student = data.profile as StudentProfileData | null;
    const teacher = data.profile as TeacherProfileData | null;
    setForm({
      name: data.user.name,
      className: student?.className ?? '',
      board: student?.board?._id ?? '',
      schoolName: student?.schoolName ?? '',
      guardianName: student?.guardianName ?? '',
      mobile: student?.mobile ?? '',
      qualification: teacher?.qualification ?? '',
      bio: teacher?.bio ?? ''
    });
  }, [data]);

  const changePassword = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }),
    onSuccess: (result) => {
      setPasswords(emptyPasswords);
      notify(result.message ?? 'Password updated successfully', 'success');
    },
    onError: (error) => notify(error instanceof ApiError ? error.message : 'Unable to change password', 'error')
  });

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const isStudent = data?.user.role === 'STUDENT';
      await api.patch('/auth/me', {
        name: form.name.trim(),
        ...(isStudent
          ? {
              className: form.className,
              board: form.board || null,
              schoolName: form.schoolName.trim() || undefined,
              guardianName: form.guardianName.trim() || undefined,
              mobile: form.mobile.trim() || undefined
            }
          : { qualification: form.qualification.trim() || undefined, bio: form.bio.trim() || undefined })
      });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['session'] }), refresh()]);
      notify('Profile updated', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to save your profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      notify('New password and confirmation do not match', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword.mutateAsync();
    } finally {
      setSavingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <section className="bg-mist py-16">
        <div className="container-page">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </section>
    );
  }

  const isStudent = data.user.role === 'STUDENT';

  return (
    <>
      <PageHero title="My Profile" subtitle="Keep your contact and class details up to date." />

      <section className="bg-mist py-12">
        <div className="container-page grid gap-8 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="card p-6 text-center">
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-navy font-display text-2xl font-extrabold text-gold">
                {data.user.name.charAt(0)}
              </span>
              <h2 className="mt-4 font-display text-lg font-extrabold text-navy">{data.user.name}</h2>
              <p className="mt-0.5 break-all text-sm text-slate-500">{data.user.email}</p>
              <span className="badge mt-3 bg-royal/10 text-royal">
                <ShieldCheck className="h-3.5 w-3.5" /> {humanise(data.user.role)}
              </span>

              {data.user.lastLogin ? (
                <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
                  Last signed in {new Date(data.user.lastLogin).toLocaleString('en-IN')}
                </p>
              ) : null}
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-2">
            <form onSubmit={saveProfile} className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-navy">
                <UserIcon className="h-4 w-4 text-royal" /> Personal details
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="p-name">Full name</label>
                  <input
                    id="p-name"
                    required
                    minLength={2}
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="p-email">Email</label>
                  <input id="p-email" value={data.user.email} disabled className="field cursor-not-allowed bg-slate-50" />
                  <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
                </div>

                {isStudent ? (
                  <>
                    <div>
                      <label className="field-label" htmlFor="p-class">Class</label>
                      <select
                        id="p-class"
                        className="field"
                        value={form.className}
                        onChange={(e) => setForm((c) => ({ ...c, className: e.target.value }))}
                      >
                        {classes?.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="p-board">Board</label>
                      <select
                        id="p-board"
                        className="field"
                        value={form.board}
                        onChange={(e) => setForm((c) => ({ ...c, board: e.target.value }))}
                      >
                        <option value="">Select board</option>
                        {boards?.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="p-school">School name</label>
                      <input
                        id="p-school"
                        className="field"
                        value={form.schoolName}
                        onChange={(e) => setForm((c) => ({ ...c, schoolName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="p-guardian">Parent / guardian</label>
                      <input
                        id="p-guardian"
                        className="field"
                        value={form.guardianName}
                        onChange={(e) => setForm((c) => ({ ...c, guardianName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="p-mobile">Mobile number</label>
                      <input
                        id="p-mobile"
                        inputMode="tel"
                        className="field"
                        value={form.mobile}
                        onChange={(e) => setForm((c) => ({ ...c, mobile: e.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="p-qual">Qualification</label>
                      <input
                        id="p-qual"
                        className="field"
                        value={form.qualification}
                        onChange={(e) => setForm((c) => ({ ...c, qualification: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="p-bio">Bio</label>
                      <textarea
                        id="p-bio"
                        rows={4}
                        className="field resize-y"
                        value={form.bio}
                        onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>

              <button type="submit" disabled={savingProfile} className="btn-primary mt-5">
                {savingProfile ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <form onSubmit={savePassword} className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-navy">
                <KeyRound className="h-4 w-4 text-royal" /> Change password
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">Use at least 8 characters for your new password.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="pw-current">Current password</label>
                  <input
                    id="pw-current"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="field"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((c) => ({ ...c, currentPassword: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="pw-new">New password</label>
                  <input
                    id="pw-new"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="field"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords((c) => ({ ...c, newPassword: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="pw-confirm">Confirm new password</label>
                  <input
                    id="pw-confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="field"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords((c) => ({ ...c, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" disabled={savingPassword} className="btn-primary mt-5">
                {savingPassword ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}

