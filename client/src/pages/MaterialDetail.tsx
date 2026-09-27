import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Heart,
  Layers,
  Lock,
  ShoppingCart,
  Tag
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatDate, formatFileSize, formatPrice, humanise, nameOf } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHero } from '../components/Layout';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Spinner';
import type { Material } from '../types';

const ACCESS_MESSAGES: Record<string, string> = {
  login: 'Sign in with your free account to download this material.',
  purchase: 'Purchase this material once to get full access for a year.',
  expired: 'Your access to this material has expired. Please purchase it again.',
  unavailable: 'This material is not available at the moment.'
};

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'download' | 'purchase' | null>(null);
  const [favourited, setFavourited] = useState(false);

  const { data: material, isLoading, isError, refetch } = useQuery({
    queryKey: ['material', id],
    queryFn: () => api.get<Material>(`/public/materials/${id}`),
    enabled: Boolean(id)
  });

  const { data: favourites } = useQuery({
    queryKey: ['favourites'],
    queryFn: () => api.get<Material[]>('/materials/me/favourites'),
    enabled: Boolean(user)
  });

  // The server list is the source of truth; local state keeps the button responsive.
  useEffect(() => {
    if (favourites) setFavourited(favourites.some((item) => item.id === id));
  }, [favourites, id]);

  const favourite = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await api.post(`/materials/${id}/favourite`);
      else await api.delete(`/materials/${id}/favourite`);
    },
    onMutate: (next) => setFavourited(next),
    onError: (_error, next) => {
      setFavourited(!next);
      notify('Could not update favourites', 'error');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['favourites'] })
  });

  async function handleDownload() {
    if (!material) return;
    if (!user) {
      notify('Please sign in to download this material', 'info');
      navigate('/login', { state: { from: `/materials/${material.id}` } });
      return;
    }
    if (material.accessType === 'PAID' && !material.hasAccess) {
      navigate(`/materials/${material.id}`);
      return;
    }
    setBusy('download');
    try {
      await api.downloadFile(`/materials/${material.id}/download`, material.fileName || `${material.title}.pdf`);
      notify('Download started', 'success');
      void queryClient.invalidateQueries({ queryKey: ['material', id] });
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Download failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handlePurchase() {
    if (!material) return;
    setBusy('purchase');
    try {
      const result = await api.post<{ message: string }>(`/materials/${material.id}/purchase`);
      notify(result.message ?? 'Payment successful', 'success');
      void queryClient.invalidateQueries({ queryKey: ['material', id] });
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Purchase failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !material) {
    return (
      <section className="bg-mist py-16">
        <div className="container-page">
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Material not found"
            description="This material may have been removed, or it is not published yet."
            action={
              <Link to="/materials" className="btn-primary mt-2">
                Browse all material
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  const isPaid = material.accessType === 'PAID';
  const canDownload = Boolean(material.hasAccess);
  const blockedReason = canDownload ? undefined : material.accessReason;

  const details: { icon: typeof Tag; label: string; value: string }[] = [
    { icon: Layers, label: 'Class', value: material.className },
    { icon: Tag, label: 'Subject', value: nameOf(material.subject) || '—' },
    { icon: Tag, label: 'Board', value: nameOf(material.board) || 'All boards' },
    { icon: Layers, label: 'Chapter', value: material.chapter || 'Complete' },
    { icon: Tag, label: 'Material type', value: humanise(material.materialType) },
    { icon: Lock, label: 'Access', value: humanise(material.accessType) },
    { icon: FileText, label: 'File', value: material.fileName || '—' },
    { icon: Layers, label: 'File size', value: formatFileSize(material.fileSize) },
    { icon: Calendar, label: 'Uploaded', value: formatDate(material.uploadedDate) },
    { icon: Download, label: 'Downloads', value: `${material.downloadCount}` }
  ];

  return (
    <>
      <PageHero
        title={material.title}
        subtitle={`${material.className}${nameOf(material.subject) ? ` • ${nameOf(material.subject)}` : ''}`}
      />

      <section className="bg-mist py-12">
        <div className="container-page">
          <Link to="/materials" className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to study material
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="card overflow-hidden">
                <div className="flex h-56 items-center justify-center bg-navy/5 sm:h-72">
                  {material.thumbnail ? (
                    <img src={material.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-16 w-16 text-navy/20" />
                  )}
                </div>
              </div>

              <div className="card p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-navy/5 text-navy">{material.className}</span>
                  {nameOf(material.subject) ? (
                    <span className="badge bg-royal/10 text-royal">{nameOf(material.subject)}</span>
                  ) : null}
                  <span className="badge bg-slate-100 text-slate-600">{humanise(material.materialType)}</span>
                  {material.featured ? <span className="badge bg-gold/20 text-[#8a6100]">Featured</span> : null}
                </div>
                <h1 className="mt-4 font-display text-2xl font-extrabold text-navy">{material.title}</h1>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{material.description}</p>
              </div>

              <div className="card p-6">
                <h2 className="section-title text-lg">Material details</h2>
                <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {details.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-royal" />
                      <div className="min-w-0">
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className="mt-0.5 truncate text-sm font-medium text-navy" title={value}>
                          {value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <aside className="lg:col-span-1">
              <div className="card space-y-4 p-6 lg:sticky lg:top-24">
                {isPaid ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">One-time price</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-navy">{formatPrice(material.price)}</p>
                    <p className="mt-1 text-xs text-slate-500">Full access for 12 months from purchase.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Access</p>
                    <p className="mt-1 font-display text-xl font-extrabold text-navy">{humanise(material.accessType)}</p>
                  </div>
                )}

                {blockedReason ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="flex items-center gap-2 font-semibold">
                      <Lock className="h-4 w-4" /> Download restricted
                    </p>
                    <p className="mt-1.5 leading-relaxed">
                      {ACCESS_MESSAGES[blockedReason] ?? ACCESS_MESSAGES.login}
                    </p>
                  </div>
                ) : null}

                {isPaid && !canDownload ? (
                  <button
                    type="button"
                    onClick={handlePurchase}
                    disabled={busy !== null || !user}
                    className="btn-gold w-full"
                  >
                    {busy === 'purchase' ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <ShoppingCart className="h-4 w-4" />
                    )}
                    {busy === 'purchase'
                      ? 'Processing…'
                      : user
                        ? `Buy for ${formatPrice(material.price)}`
                        : 'Sign in to buy'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={busy !== null}
                    className="btn-primary w-full"
                  >
                    {busy === 'download' ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {busy === 'download' ? 'Preparing…' : 'Download material'}
                  </button>
                )}

                {!user ? (
                  <Link
                    to="/login"
                    state={{ from: `/materials/${material.id}` }}
                    className="btn-ghost w-full"
                  >
                    Sign in to your account
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => favourite.mutate(!favourited)}
                  disabled={!user || favourite.isPending}
                  aria-pressed={favourited}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    favourited
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-slate-200 text-ink hover:border-rose-200 hover:text-rose-500'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favourited ? 'fill-current' : ''}`} />
                  {favourited ? 'Saved to favourites' : 'Save to favourites'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}

