import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Heart, Receipt, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatPrice, humanise } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MaterialCard } from '../../components/MaterialCard';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Spinner';
import type { DownloadRecord, Material, PurchaseRecord, StudentSummary } from '../../types';

const TABS = [
  { key: 'downloads', label: 'Downloads', icon: Download },
  { key: 'favourites', label: 'Favourites', icon: Heart },
  { key: 'purchases', label: 'Purchases', icon: Receipt }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function StudentDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<TabKey>('downloads');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<StudentSummary>('/dashboard/summary')
  });

  const { data: downloads, isLoading: loadingDownloads } = useQuery({
    queryKey: ['downloads'],
    queryFn: () => api.get<DownloadRecord[]>('/materials/me/downloads')
  });

  const { data: favourites, isLoading: loadingFavourites } = useQuery({
    queryKey: ['favourites'],
    queryFn: () => api.get<Material[]>('/materials/me/favourites')
  });

  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.get<PurchaseRecord[]>('/materials/me/purchases')
  });

  async function download(material: Material) {
    setBusyId(material.id);
    try {
      await api.downloadFile(`/materials/${material.id}/download`, material.fileName || `${material.title}.pdf`);
      notify('Download started', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Download failed', 'error');
    } finally {
      setBusyId(null);
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
    { label: 'Total downloads', value: summary.stats.downloads, icon: Download },
    { label: 'Saved favourites', value: summary.stats.favourites, icon: Heart },
    { label: 'Purchases', value: summary.stats.purchases, icon: Receipt }
  ];

  return (
    <>
      <section className="bg-navy py-12 text-white">
        <div className="container-page">
          <p className="text-xs font-medium uppercase tracking-wide text-gold">Student dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Welcome back, {user?.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {summary.profile?.className ? summary.profile.className : 'Student account'}
            {summary.profile?.board ? ` • ${summary.profile.board.name}` : ''}
          </p>
        </div>
      </section>

      <section className="bg-mist py-12">
        <div className="container-page space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-royal/10 text-royal">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-extrabold text-navy">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    tab === key ? 'bg-royal text-white' : 'border border-slate-200 bg-white text-ink hover:border-royal'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === 'downloads' ? (
                loadingDownloads ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : !downloads?.length ? (
                  <EmptyState
                    icon={<Download className="h-8 w-8" />}
                    title="No downloads yet"
                    description="Material you download will be listed here for quick access."
                    action={
                      <Link to="/materials" className="btn-primary mt-2">
                        Browse study material
                      </Link>
                    }
                  />
                ) : (
                  <ul className="card divide-y divide-slate-100">
                    {downloads.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/materials/${row.material.id}`}
                            className="block truncate font-display text-sm font-bold text-navy transition hover:text-royal"
                          >
                            {row.material.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {row.material.className} • {humanise(row.material.materialType)} •{' '}
                            {formatDate(row.downloadedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void download(row.material)}
                          disabled={busyId === row.material.id}
                          className="btn-ghost px-4 py-2"
                        >
                          {busyId === row.material.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {tab === 'favourites' ? (
                loadingFavourites ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : !favourites?.length ? (
                  <EmptyState
                    icon={<Heart className="h-8 w-8" />}
                    title="Nothing saved yet"
                    description="Tap the heart on any material to keep it here for later."
                    action={
                      <Link to="/materials" className="btn-primary mt-2">
                        Find material
                      </Link>
                    }
                  />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {favourites.map((material) => (
                      <MaterialCard key={material.id} material={material} />
                    ))}
                  </div>
                )
              ) : null}

              {tab === 'purchases' ? (
                loadingPurchases ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : !purchases?.length ? (
                  <EmptyState
                    icon={<Receipt className="h-8 w-8" />}
                    title="No purchases yet"
                    description="Paid material you buy will appear here with its receipt."
                    action={
                      <Link to="/materials?accessType=PAID" className="btn-primary mt-2">
                        Browse paid material
                      </Link>
                    }
                  />
                ) : (
                  <ul className="space-y-4">
                    {purchases.map((purchase) => (
                      <li key={purchase.id} className="card flex flex-wrap items-center gap-4 p-5">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/materials/${purchase.material.id}`}
                            className="block font-display text-sm font-bold text-navy transition hover:text-royal"
                          >
                            {purchase.material.title}
                          </Link>
                          <p className="mt-1 text-xs text-slate-400">
                            {purchase.material.className} • Purchased {formatDate(purchase.purchaseDate)} • Ref{' '}
                            {purchase.transactionId}
                          </p>
                          {purchase.expiryDate ? (
                            <p className="mt-0.5 text-xs text-slate-400">
                              Valid until {formatDate(purchase.expiryDate)}
                            </p>
                          ) : null}
                        </div>
                        <p className="font-display text-lg font-extrabold text-navy">
                          {formatPrice(purchase.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => void download(purchase.material)}
                          disabled={busyId === purchase.material.id}
                          className="btn-primary px-4 py-2"
                        >
                          {busyId === purchase.material.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-4 bg-navy p-6 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-gold">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold">Looking for something specific?</p>
                <p className="text-sm text-slate-300">New material is added every week.</p>
              </div>
            </div>
            <Link to="/materials" className="btn-gold">
              Explore library
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

