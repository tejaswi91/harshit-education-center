import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Inbox,
  Mail,
  Save,
  Settings as SettingsIcon,
  TrendingUp,
  UserCog,
  Users
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatPrice, humanise } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Spinner';
import type {
  AdminOverview,
  AdminStudentProfile,
  AdminTeacherProfile,
  AdminUser,
  BoardRef,
  ClassLevel,
  EnquiryItem,
  InstituteSettings,
  Role
} from '../../types';

const TABS = [
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'users', label: 'Users' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'students', label: 'Students' },
  { key: 'settings', label: 'Settings' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

const emptySettings = {
  instituteName: '',
  tagline: '',
  phone: '',
  email: '',
  address: '',
  admissionMessage: '',
  logoUrl: '',
  heroImageUrl: '',
  youtube: '',
  instagram: '',
  facebook: '',
  linkedin: ''
};

const emptyTeacher = {
  name: '',
  email: '',
  password: '',
  qualification: '',
  bio: ''
};

const emptyStudent = {
  name: '',
  email: '',
  password: '',
  className: 'Class 1',
  board: '',
  schoolName: '',
  guardianName: '',
  mobile: ''
};

export default function AdminDashboard() {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('enquiries');
  const [settings, setSettings] = useState(emptySettings);
  const [teacher, setTeacher] = useState(emptyTeacher);
  const [student, setStudent] = useState(emptyStudent);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);

  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<AdminOverview>('/admin/overview')
  });

  const { data: enquiries, refetch: refetchEnquiries } = useQuery({
    queryKey: ['admin-enquiries'],
    queryFn: () => api.get<EnquiryItem[]>('/admin/enquiries')
  });

  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/admin/users')
  });

  const { data: teachers, refetch: refetchTeachers } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: () => api.get<AdminTeacherProfile[]>('/admin/teachers')
  });

  const { data: students, refetch: refetchStudents } = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => api.get<AdminStudentProfile[]>('/admin/students')
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassLevel[]>('/public/classes')
  });

  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: () => api.get<BoardRef[]>('/public/boards')
  });

  const { data: savedSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<InstituteSettings>('/admin/settings')
  });

  useEffect(() => {
    if (!savedSettings) return;
    setSettings({
      instituteName: savedSettings.instituteName ?? '',
      tagline: savedSettings.tagline ?? '',
      phone: savedSettings.phone ?? '',
      email: savedSettings.email ?? '',
      address: savedSettings.address ?? '',
      admissionMessage: savedSettings.admissionMessage ?? '',
      logoUrl: savedSettings.logoUrl ?? '',
      heroImageUrl: savedSettings.heroImageUrl ?? '',
      youtube: savedSettings.socialLinks?.youtube ?? '',
      instagram: savedSettings.socialLinks?.instagram ?? '',
      facebook: savedSettings.socialLinks?.facebook ?? '',
      linkedin: savedSettings.socialLinks?.linkedin ?? ''
    });
  }, [savedSettings]);

  const refreshAll = () =>
    Promise.all([
      refetchEnquiries(),
      refetchUsers(),
      refetchTeachers(),
      refetchStudents(),
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    ]);

  async function setEnquiryStatus(id: string, status: string) {
    try {
      await api.patch(`/admin/enquiries/${id}`, { status });
      notify('Enquiry updated', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to update the enquiry', 'error');
    }
  }

  async function deleteEnquiry(id: string) {
    if (!window.confirm('Delete this enquiry?')) return;
    try {
      await api.delete(`/admin/enquiries/${id}`);
      notify('Enquiry deleted', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to delete the enquiry', 'error');
    }
  }

  async function updateUser(user: AdminUser, patch: { isActive?: boolean; role?: Role }) {
    try {
      await api.patch(`/admin/users/${user._id}`, patch);
      notify('User updated', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to update the user', 'error');
    }
  }

  async function reviewTeacher(profile: AdminTeacherProfile, approved: boolean) {
    try {
      await api.patch(`/admin/teachers/${profile._id}`, { approved });
      notify(approved ? 'Teacher approved' : 'Teacher approval revoked', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to update the teacher', 'error');
    }
  }

  async function createTeacher(event: FormEvent) {
    event.preventDefault();
    setCreatingTeacher(true);
    try {
      await api.post('/admin/teachers', {
        name: teacher.name.trim(),
        email: teacher.email.trim(),
        password: teacher.password,
        qualification: teacher.qualification.trim() || undefined,
        bio: teacher.bio.trim() || undefined
      });
      setTeacher(emptyTeacher);
      notify('Teacher account created and approved', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to create the teacher account', 'error');
    } finally {
      setCreatingTeacher(false);
    }
  }

  async function createStudent(event: FormEvent) {
    event.preventDefault();
    setCreatingStudent(true);
    try {
      await api.post('/admin/students', {
        name: student.name.trim(),
        email: student.email.trim(),
        password: student.password,
        className: student.className,
        board: student.board || undefined,
        schoolName: student.schoolName.trim() || undefined,
        guardianName: student.guardianName.trim() || undefined,
        mobile: student.mobile.trim() || undefined
      });
      setStudent(emptyStudent);
      notify('Student account created', 'success');
      await refreshAll();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to create the student account', 'error');
    } finally {
      setCreatingStudent(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/admin/settings', {
        instituteName: settings.instituteName.trim(),
        tagline: settings.tagline.trim(),
        phone: settings.phone.trim(),
        email: settings.email.trim(),
        address: settings.address.trim(),
        admissionMessage: settings.admissionMessage.trim(),
        logoUrl: settings.logoUrl.trim(),
        heroImageUrl: settings.heroImageUrl.trim(),
        socialLinks: {
          youtube: settings.youtube.trim(),
          instagram: settings.instagram.trim(),
          facebook: settings.facebook.trim(),
          linkedin: settings.linkedin.trim()
        }
      });
      notify('Settings saved', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] })
      ]);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <section className="bg-mist py-16">
        <div className="container-page">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </section>
    );
  }

  const stats = [
    { label: 'Users', value: overview.users, icon: Users },
    { label: 'Students', value: overview.students, icon: BookOpen },
    { label: 'Teachers', value: overview.teachers, icon: UserCog },
    { label: 'Pending approvals', value: overview.pendingTeachers, icon: CheckCircle2 },
    { label: 'Material', value: overview.materials, icon: FileText },
    { label: 'New enquiries', value: overview.newEnquiries, icon: Inbox },
    { label: 'Downloads', value: overview.downloads, icon: Download },
    { label: 'Revenue', value: formatPrice(overview.revenue), icon: TrendingUp }
  ];


  return (
    <>
      <section className="bg-navy py-12 text-white">
        <div className="container-page">
          <p className="text-xs font-medium uppercase tracking-wide text-gold">Admin dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Institute overview</h1>
          <p className="mt-2 text-sm text-slate-300">
            {overview.published} published • {overview.drafts} drafts • {overview.newEnquiries} new{' '}
            {overview.newEnquiries === 1 ? 'enquiry' : 'enquiries'}
          </p>
        </div>
      </section>

      <section className="bg-mist py-12">
        <div className="container-page space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card flex items-center gap-4 p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-royal/10 text-royal">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-extrabold text-navy">{value}</p>
                  <p className="truncate text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  tab === key ? 'bg-royal text-white' : 'border border-slate-200 bg-white text-ink hover:border-royal'
                }`}
              >
                {label}
                {key === 'enquiries' && overview.newEnquiries ? (
                  <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">
                    {overview.newEnquiries}
                  </span>
                ) : null}
                {key === 'teachers' && overview.pendingTeachers ? (
                  <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">
                    {overview.pendingTeachers}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === 'enquiries' ? (
            <div className="card p-5">
              <h2 className="font-display text-base font-extrabold text-navy">Admission enquiries</h2>
              <p className="mt-1 text-sm text-slate-500">Track and close incoming admission requests.</p>

              {!enquiries?.length ? (
                <div className="mt-5">
                  <EmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title="No enquiries yet"
                    description="New enquiries from the contact page will appear here."
                  />
                </div>
              ) : (
                <ul className="mt-5 space-y-4">
                  {enquiries.map((enquiry) => (
                    <li key={enquiry._id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold text-navy">{enquiry.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {enquiry.className}
                            {enquiry.board ? ` • ${enquiry.board.name}` : ''} • {formatDate(enquiry.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`badge ${
                            enquiry.status === 'NEW'
                              ? 'bg-amber-50 text-amber-700'
                              : enquiry.status === 'CONTACTED'
                                ? 'bg-sky-50 text-sky-700'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {humanise(enquiry.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{enquiry.message}</p>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                        <a href={`tel:${enquiry.mobile}`} className="font-medium transition hover:text-royal">
                          {enquiry.mobile}
                        </a>
                        {enquiry.email ? (
                          <a href={`mailto:${enquiry.email}`} className="font-medium transition hover:text-royal">
                            {enquiry.email}
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(['NEW', 'CONTACTED', 'CLOSED'] as const)
                          .filter((status) => status !== enquiry.status)
                          .map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => void setEnquiryStatus(enquiry._id, status)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-royal hover:text-royal"
                            >
                              Mark {humanise(status).toLowerCase()}
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => void deleteEnquiry(enquiry._id)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'users' ? (
            <div className="card p-5">
              <h2 className="font-display text-base font-extrabold text-navy">Users</h2>
              <p className="mt-1 text-sm text-slate-500">Change a role or disable an account.</p>

              {!users?.length ? (
                <div className="mt-5">
                  <EmptyState icon={<Users className="h-8 w-8" />} title="No users found" />
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-3 pr-4 font-semibold">Name</th>
                        <th className="pb-3 pr-4 font-semibold">Role</th>
                        <th className="pb-3 pr-4 font-semibold">Joined</th>
                        <th className="pb-3 pr-4 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-navy">{user.name}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              value={user.role}
                              aria-label={`Role for ${user.name}`}
                              onChange={(e) => void updateUser(user, { role: e.target.value as Role })}
                              className="field w-auto py-1.5 text-xs"
                            >
                              <option value="STUDENT">Student</option>
                              <option value="TEACHER">Teacher</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{formatDate(user.createdAt)}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`badge ${
                                user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {user.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => void updateUser(user, { isActive: !user.isActive })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-royal hover:text-royal"
                            >
                              {user.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'teachers' ? (
            <div className="space-y-6">
              <form onSubmit={createTeacher} className="card space-y-4 p-5">
                <div>
                  <h2 className="font-display text-base font-extrabold text-navy">Create teacher account</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Only administrators can create staff accounts. New teacher accounts are approved immediately.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="teacher-name">Full name</label>
                    <input
                      id="teacher-name"
                      required
                      minLength={2}
                      className="field"
                      value={teacher.name}
                      onChange={(event) => setTeacher((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="teacher-email">Email address</label>
                    <input
                      id="teacher-email"
                      type="email"
                      required
                      className="field"
                      value={teacher.email}
                      onChange={(event) => setTeacher((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="teacher-password">Initial password</label>
                    <input
                      id="teacher-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="field"
                      value={teacher.password}
                      onChange={(event) => setTeacher((current) => ({ ...current, password: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="teacher-qualification">Qualification</label>
                    <input
                      id="teacher-qualification"
                      className="field"
                      value={teacher.qualification}
                      onChange={(event) => setTeacher((current) => ({ ...current, qualification: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label" htmlFor="teacher-bio">Short bio</label>
                    <textarea
                      id="teacher-bio"
                      rows={3}
                      className="field resize-y"
                      value={teacher.bio}
                      onChange={(event) => setTeacher((current) => ({ ...current, bio: event.target.value }))}
                    />
                  </div>
                </div>
                <button type="submit" disabled={creatingTeacher} className="btn-primary">
                  {creatingTeacher ? <Spinner className="h-4 w-4" /> : null}
                  {creatingTeacher ? 'Creating account…' : 'Create teacher account'}
                </button>
              </form>

              <div className="card p-5">
                <h2 className="font-display text-base font-extrabold text-navy">Teacher approvals</h2>
                <p className="mt-1 text-sm text-slate-500">Approved teachers appear on the public faculty list.</p>

                {!teachers?.length ? (
                  <div className="mt-5">
                    <EmptyState
                      icon={<UserCog className="h-8 w-8" />}
                      title="No teachers yet"
                      description="Create a teacher account above to add institute staff."
                    />
                  </div>
                ) : (
                  <ul className="mt-5 space-y-4">
                    {teachers.map((profile) => (
                      <li key={profile._id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 p-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy font-display text-lg font-bold text-gold">
                          {profile.user?.name?.charAt(0) ?? '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm font-bold text-navy">{profile.user?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-slate-400">{profile.user?.email}</p>
                          {profile.qualification ? (
                            <p className="mt-0.5 text-xs text-slate-500">{profile.qualification}</p>
                          ) : null}
                        </div>
                        <span
                          className={`badge ${
                            profile.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {profile.approved ? 'Approved' : 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void reviewTeacher(profile, !profile.approved)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-royal hover:text-royal"
                        >
                          {profile.approved ? 'Revoke' : 'Approve'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'students' ? (
            <div className="space-y-6">
              <form onSubmit={createStudent} className="card space-y-4 p-5">
                <div>
                  <h2 className="font-display text-base font-extrabold text-navy">Create student account</h2>
                  <p className="mt-1 text-sm text-slate-500">Only administrators can create student logins.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="student-name">Full name</label>
                    <input
                      id="student-name"
                      required
                      minLength={2}
                      className="field"
                      value={student.name}
                      onChange={(event) => setStudent((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-email">Email address</label>
                    <input
                      id="student-email"
                      type="email"
                      required
                      className="field"
                      value={student.email}
                      onChange={(event) => setStudent((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-password">Initial password</label>
                    <input
                      id="student-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="field"
                      value={student.password}
                      onChange={(event) => setStudent((current) => ({ ...current, password: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-class">Class</label>
                    <select
                      id="student-class"
                      required
                      className="field"
                      value={student.className}
                      onChange={(event) => setStudent((current) => ({ ...current, className: event.target.value }))}
                    >
                      {classes?.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-board">Board</label>
                    <select
                      id="student-board"
                      className="field"
                      value={student.board}
                      onChange={(event) => setStudent((current) => ({ ...current, board: event.target.value }))}
                    >
                      <option value="">Select board (optional)</option>
                      {boards?.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-school">School name</label>
                    <input
                      id="student-school"
                      className="field"
                      value={student.schoolName}
                      onChange={(event) => setStudent((current) => ({ ...current, schoolName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-guardian">Parent / guardian name</label>
                    <input
                      id="student-guardian"
                      className="field"
                      value={student.guardianName}
                      onChange={(event) => setStudent((current) => ({ ...current, guardianName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="student-mobile">Mobile number</label>
                    <input
                      id="student-mobile"
                      inputMode="tel"
                      className="field"
                      value={student.mobile}
                      onChange={(event) => setStudent((current) => ({ ...current, mobile: event.target.value }))}
                    />
                  </div>
                </div>
                <button type="submit" disabled={creatingStudent} className="btn-primary">
                  {creatingStudent ? <Spinner className="h-4 w-4" /> : null}
                  {creatingStudent ? 'Creating account…' : 'Create student account'}
                </button>
              </form>

              <div className="card p-5">
                <h2 className="font-display text-base font-extrabold text-navy">Students</h2>
                <p className="mt-1 text-sm text-slate-500">Student accounts and their class details.</p>

                {!students?.length ? (
                  <div className="mt-5">
                    <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No students yet" />
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-3 pr-4 font-semibold">Student</th>
                          <th className="pb-3 pr-4 font-semibold">Class</th>
                          <th className="pb-3 pr-4 font-semibold">Board</th>
                          <th className="pb-3 pr-4 font-semibold">Guardian</th>
                          <th className="pb-3 font-semibold">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map((student) => (
                          <tr key={student._id}>
                            <td className="py-3 pr-4">
                              <p className="font-semibold text-navy">{student.user?.name ?? '—'}</p>
                              <p className="text-xs text-slate-400">{student.user?.email}</p>
                            </td>
                            <td className="py-3 pr-4 text-slate-600">{student.className}</td>
                            <td className="py-3 pr-4 text-slate-600">{student.board?.name ?? '—'}</td>
                            <td className="py-3 pr-4 text-slate-600">
                              {student.guardianName ?? '—'}
                              {student.mobile ? <span className="block text-xs text-slate-400">{student.mobile}</span> : null}
                            </td>
                            <td className="py-3 text-slate-600">{formatDate(student.user?.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'settings' ? (
            <form onSubmit={saveSettings} className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-navy">
                <SettingsIcon className="h-4 w-4 text-royal" /> Institute settings
              </h2>
              <p className="mt-1 text-sm text-slate-500">These values appear in the header, footer and contact page.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="a-name">Institute name</label>
                  <input
                    id="a-name"
                    className="field"
                    value={settings.instituteName}
                    onChange={(e) => setSettings((s) => ({ ...s, instituteName: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="a-tagline">Tagline</label>
                  <input
                    id="a-tagline"
                    className="field"
                    value={settings.tagline}
                    onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-phone">Phone</label>
                  <input
                    id="a-phone"
                    className="field"
                    value={settings.phone}
                    onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-email">Email</label>
                  <input
                    id="a-email"
                    type="email"
                    className="field"
                    value={settings.email}
                    onChange={(e) => setSettings((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="a-address">Address</label>
                  <textarea
                    id="a-address"
                    rows={2}
                    className="field resize-y"
                    value={settings.address}
                    onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="a-admission">Admission message</label>
                  <textarea
                    id="a-admission"
                    rows={3}
                    className="field resize-y"
                    value={settings.admissionMessage}
                    onChange={(e) => setSettings((s) => ({ ...s, admissionMessage: e.target.value }))}
                  />
                </div>

                {(['youtube', 'instagram', 'facebook', 'linkedin'] as const).map((network) => (
                  <div key={network}>
                    <label className="field-label" htmlFor={`a-${network}`}>
                      {humanise(network)} URL
                    </label>
                    <input
                      id={`a-${network}`}
                      className="field"
                      placeholder="https://"
                      value={settings[network]}
                      onChange={(e) => setSettings((s) => ({ ...s, [network]: e.target.value }))}
                    />
                  </div>
                ))}

                <div>
                  <label className="field-label" htmlFor="a-logo">Logo URL</label>
                  <input
                    id="a-logo"
                    className="field"
                    value={settings.logoUrl}
                    onChange={(e) => setSettings((s) => ({ ...s, logoUrl: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-hero">Hero image URL</label>
                  <input
                    id="a-hero"
                    className="field"
                    value={settings.heroImageUrl}
                    onChange={(e) => setSettings((s) => ({ ...s, heroImageUrl: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" disabled={savingSettings} className="btn-primary mt-6">
                {savingSettings ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}
