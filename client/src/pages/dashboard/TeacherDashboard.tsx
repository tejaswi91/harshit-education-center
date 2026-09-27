import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Download, FileText, Pencil, Plus, Trash2, TrendingUp, Upload } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { ACCESS_TYPE_OPTIONS, formatDate, formatPrice, humanise, MATERIAL_TYPE_OPTIONS, nameOf } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Spinner';
import type { BoardRef, ClassLevel, Material, Paged, StaffDownload, StaffSummary, SubjectRef } from '../../types';

const emptyForm = {
  title: '',
  description: '',
  className: 'Class 1',
  subject: '',
  board: '',
  chapter: '',
  materialType: 'NOTES',
  visibility: 'PUBLIC',
  accessType: 'PUBLIC_FREE',
  price: '0',
  status: 'DRAFT',
  featured: false
};

type FormState = typeof emptyForm;

function formFromMaterial(material: Material): FormState {
  return {
    title: material.title,
    description: material.description,
    className: material.className,
    subject: typeof material.subject === 'string' ? material.subject : material.subject?._id ?? '',
    board: typeof material.board === 'string' ? material.board : material.board?._id ?? '',
    chapter: material.chapter ?? '',
    materialType: material.materialType,
    visibility: 'PUBLIC',
    accessType: material.accessType,
    price: String(material.price ?? 0),
    status: material.status,
    featured: material.featured
  };
}

const TABS = [
  { key: 'materials', label: 'My material' },
  { key: 'upload', label: 'Upload' },
  { key: 'activity', label: 'Activity' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('materials');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<StaffSummary>('/dashboard/summary')
  });

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: boards } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<BoardRef[]>('/public/boards') });
  const { data: subjects } = useQuery({
    queryKey: ['subjects', form.className],
    queryFn: () => api.get<SubjectRef[]>(`/public/subjects?className=${encodeURIComponent(form.className)}`)
  });

  const { data: materials, isLoading: loadingMaterials, refetch: refetchMaterials } = useQuery({
    queryKey: ['dashboard-materials', search],
    queryFn: () => api.get<Paged<Material>>(`/dashboard/materials?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`)
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard-downloads'],
    queryFn: () => api.get<StaffDownload[]>('/dashboard/downloads')
  });


  function resetForm() {
    setForm(emptyForm);
    setFile(null);
    setThumbnail(null);
    setEditingId(null);
  }

  function startEdit(material: Material) {
    setForm(formFromMaterial(material));
    setFile(null);
    setThumbnail(null);
    setEditingId(material.id);
    setTab('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveMaterial(event: FormEvent) {
    event.preventDefault();
    if (!editingId && !file) {
      notify('Please attach a file to upload', 'error');
      return;
    }
    if (form.accessType === 'PAID' && Number(form.price) <= 0) {
      notify('Paid material needs a price greater than zero', 'error');
      return;
    }

    const body = new FormData();
    body.set('title', form.title.trim());
    body.set('description', form.description.trim());
    body.set('className', form.className);
    body.set('subject', form.subject);
    body.set('board', form.board);
    body.set('chapter', form.chapter.trim());
    body.set('materialType', form.materialType);
    body.set('visibility', form.visibility);
    body.set('accessType', form.accessType);
    body.set('price', String(Number(form.price) || 0));
    body.set('status', form.status);
    // z.coerce.boolean() treats any non-empty string as true, so false is sent as ''.
    body.set('featured', form.featured ? 'true' : '');
    if (file) body.set('file', file);
    if (thumbnail) body.set('thumbnail', thumbnail);

    setSaving(true);
    try {
      if (editingId) await api.upload<Material>(`/dashboard/materials/${editingId}`, body, 'PATCH');
      else await api.upload<Material>('/dashboard/materials', body, 'POST');
      notify(editingId ? 'Material updated' : 'Material uploaded', 'success');
      resetForm();
      setTab('materials');
      await Promise.all([refetchMaterials(), queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })]);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to save the material', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(material: Material, status: string) {
    const body = new FormData();
    body.set('status', status);
    try {
      await api.upload(`/dashboard/materials/${material.id}`, body, 'PATCH');
      notify(`Material marked ${humanise(status).toLowerCase()}`, 'success');
      await Promise.all([refetchMaterials(), queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })]);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to update the material', 'error');
    }
  }

  async function removeMaterial(material: Material) {
    if (!window.confirm(`Delete "${material.title}"? This also removes the stored file.`)) return;
    try {
      await api.delete(`/dashboard/materials/${material.id}`);
      notify('Material deleted', 'success');
      await Promise.all([refetchMaterials(), queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })]);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to delete the material', 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <section className="bg-mist py-16">
        <div className="container-page">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </section>
    );
  }

  const stats = [
    { label: 'Total material', value: summary.stats.total, icon: FileText },
    { label: 'Published', value: summary.stats.published, icon: Upload },
    { label: 'Drafts', value: summary.stats.drafts, icon: BarChart3 },
    { label: 'Downloads', value: summary.stats.downloads, icon: Download },
    { label: 'Revenue', value: formatPrice(summary.stats.revenue), icon: TrendingUp }
  ];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <section className="bg-navy py-12 text-white">
        <div className="container-page">
          <p className="text-xs font-medium uppercase tracking-wide text-gold">Teacher dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">{user?.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {summary.profile?.approved
              ? 'Your profile is approved. Publish and manage study material below.'
              : 'Your profile is awaiting admin approval. You can upload material, but publishing needs approval.'}
          </p>
        </div>
      </section>

      <section className="bg-mist py-12">
        <div className="container-page space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-royal/10 text-royal">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-display text-xl font-extrabold text-navy">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              </button>
            ))}
            <button type="button" onClick={() => setTab('upload')} className="btn-gold ml-auto">
              <Plus className="h-4 w-4" /> New material
            </button>
          </div>

          {tab === 'materials' ? (
            loadingMaterials ? (
              <div className="flex min-h-[30vh] items-center justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <div className="card p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-base font-extrabold text-navy">
                    Material ({materials?.total ?? 0})
                  </h2>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title…"
                    aria-label="Search your material"
                    className="field max-w-xs py-2"
                  />
                </div>

                {!materials?.items.length ? (
                  <EmptyState
                    icon={<FileText className="h-8 w-8" />}
                    title="No material yet"
                    description="Upload your first set of notes, worksheets or question papers."
                    action={
                      <button type="button" onClick={() => setTab('upload')} className="btn-primary mt-2">
                        Upload material
                      </button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-3 pr-4 font-semibold">Title</th>
                          <th className="pb-3 pr-4 font-semibold">Class</th>
                          <th className="pb-3 pr-4 font-semibold">Type</th>
                          <th className="pb-3 pr-4 font-semibold">Access</th>
                          <th className="pb-3 pr-4 font-semibold">Status</th>
                          <th className="pb-3 pr-4 font-semibold">Downloads</th>
                          <th className="pb-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {materials.items.map((material) => {
                          const published = material.status === 'PUBLISHED';
                          return (
                            <tr key={material.id}>
                              <td className="py-3 pr-4">
                                <p className="font-semibold text-navy">{material.title}</p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {nameOf(material.subject) || 'General'} • {formatDate(material.uploadedDate)}
                                </p>
                              </td>
                              <td className="py-3 pr-4 text-slate-600">{material.className}</td>
                              <td className="py-3 pr-4 text-slate-600">{humanise(material.materialType)}</td>
                              <td className="py-3 pr-4 text-slate-600">
                                {material.accessType === 'PAID'
                                  ? formatPrice(material.price)
                                  : humanise(material.accessType)}
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`badge ${
                                    published
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : material.status === 'DRAFT'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {humanise(material.status)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-slate-600">{material.downloadCount}</td>
                              <td className="py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void changeStatus(material, published ? 'DRAFT' : 'PUBLISHED')}
                                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-royal hover:text-royal"
                                  >
                                    {published ? 'Unpublish' : 'Publish'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(material)}
                                    aria-label={`Edit ${material.title}`}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-royal hover:text-royal"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void removeMaterial(material)}
                                    aria-label={`Delete ${material.title}`}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          ) : null}

          {tab === 'upload' ? (
            <form onSubmit={saveMaterial} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-navy">
                    {editingId ? 'Edit material' : 'Upload new material'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">PDF, Word, Excel, text or image files up to 15 MB.</p>
                </div>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="btn-ghost">
                    Cancel edit
                  </button>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="t-title">Title</label>
                  <input
                    id="t-title"
                    required
                    minLength={2}
                    maxLength={180}
                    className="field"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="t-desc">Description</label>
                  <textarea
                    id="t-desc"
                    required
                    minLength={2}
                    maxLength={2000}
                    rows={3}
                    className="field resize-y"
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="t-class">Class</label>
                  <select
                    id="t-class"
                    className="field"
                    value={form.className}
                    onChange={(e) => {
                      update('className', e.target.value);
                      update('subject', '');
                    }}
                  >
                    {classes?.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="t-subject">Subject</label>
                  <select
                    id="t-subject"
                    required
                    className="field"
                    value={form.subject}
                    onChange={(e) => update('subject', e.target.value)}
                  >
                    <option value="">Select subject</option>
                    {subjects?.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="t-board">Board (optional)</label>
                  <select id="t-board" className="field" value={form.board} onChange={(e) => update('board', e.target.value)}>
                    <option value="">All boards</option>
                    {boards?.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="t-chapter">Chapter (optional)</label>
                  <input
                    id="t-chapter"
                    className="field"
                    value={form.chapter}
                    onChange={(e) => update('chapter', e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="t-type">Material type</label>
                  <select
                    id="t-type"
                    className="field"
                    value={form.materialType}
                    onChange={(e) => update('materialType', e.target.value as FormState['materialType'])}
                  >
                    {MATERIAL_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="t-access">Access type</label>
                  <select
                    id="t-access"
                    className="field"
                    value={form.accessType}
                    onChange={(e) => update('accessType', e.target.value as FormState['accessType'])}
                  >
                    {ACCESS_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {form.accessType === 'PAID' ? (
                  <div>
                    <label className="field-label" htmlFor="t-price">Price (₹)</label>
                    <input
                      id="t-price"
                      type="number"
                      min={1}
                      required
                      className="field"
                      value={form.price}
                      onChange={(e) => update('price', e.target.value)}
                    />
                  </div>
                ) : null}

                <div>
                  <label className="field-label" htmlFor="t-visibility">Visibility</label>
                  <select
                    id="t-visibility"
                    className="field"
                    value={form.visibility}
                    onChange={(e) => update('visibility', e.target.value as FormState['visibility'])}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="t-status">Status</label>
                  <select
                    id="t-status"
                    className="field"
                    value={form.status}
                    onChange={(e) => update('status', e.target.value as FormState['status'])}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="t-file">
                    File{' '}
                    {editingId ? <span className="font-normal text-slate-400">(leave empty to keep current)</span> : null}
                  </label>
                  <input
                    id="t-file"
                    type="file"
                    required={!editingId}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="field file:mr-3 file:rounded-lg file:border-0 file:bg-royal/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-royal"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="t-thumb">Thumbnail image (optional)</label>
                  <input
                    id="t-thumb"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                    className="field file:mr-3 file:rounded-lg file:border-0 file:bg-royal/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-royal"
                  />
                </div>

                <label className="flex items-center gap-2.5 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => update('featured', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-royal focus:ring-royal"
                  />
                  <span className="text-sm text-ink">Feature this material on the home page</span>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Upload material'}
                </button>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="btn-ghost">
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          {tab === 'activity' ? (
            <div className="card p-5">
              <h2 className="font-display text-base font-extrabold text-navy">Recent downloads</h2>
              <p className="mt-1 text-sm text-slate-500">Who downloaded your material, most recent first.</p>

              {!activity?.length ? (
                <div className="mt-5">
                  <EmptyState
                    icon={<Download className="h-8 w-8" />}
                    title="No downloads yet"
                    description="Once students download your material, the activity will show up here."
                  />
                </div>
              ) : (
                <ul className="mt-5 divide-y divide-slate-50">
                  {activity.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center gap-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <Download className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">
                          {row.user?.name ?? 'Unknown user'}
                        </p>
                        <p className="truncate text-xs text-slate-400">{row.user?.email}</p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm text-slate-600">{row.material?.title ?? '—'}</p>
                        <p className="text-xs text-slate-400">
                          {row.material?.className ? `${row.material.className} • ` : ''}
                          {formatDate(row.downloadedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

