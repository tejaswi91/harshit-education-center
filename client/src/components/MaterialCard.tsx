import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Heart, Lock, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatFileSize, formatPrice, humanise, nameOf } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Material } from '../types';
import { Spinner } from './ui/Spinner';

const TYPE_TONES: Record<string, string> = {
  NOTES: 'bg-sky-50 text-sky-700',
  WORKSHEET: 'bg-emerald-50 text-emerald-700',
  QUESTION_PAPER: 'bg-violet-50 text-violet-700',
  SAMPLE_PAPER: 'bg-amber-50 text-amber-700',
  PREVIOUS_YEAR_PAPER: 'bg-rose-50 text-rose-700',
  ASSIGNMENT: 'bg-orange-50 text-orange-700',
  REVISION_MATERIAL: 'bg-teal-50 text-teal-700',
  PRACTICE_SHEET: 'bg-indigo-50 text-indigo-700',
  OTHER: 'bg-slate-50 text-slate-700'
};

export function MaterialCard({ material, onRequireLogin }: { material: Material; onRequireLogin?: () => void }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [favourited, setFavourited] = useState(false);
  const [busy, setBusy] = useState(false);

  const tone = TYPE_TONES[material.materialType] ?? TYPE_TONES.OTHER;
  const isPaid = material.accessType === 'PAID';

  const favourite = useMutation({
    mutationFn: async () => {
      if (favourited) await api.delete(`/materials/${material.id}/favourite`);
      else await api.post(`/materials/${material.id}/favourite`);
    },
    onMutate: () => setFavourited((value) => !value),
    onError: () => setFavourited(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favourites'] })
  });

  async function handlePrimaryAction() {
    if (!user) {
      onRequireLogin?.();
      notify('Please sign in to access this material', 'info');
      return;
    }
    if (isPaid && !material.hasAccess) {
      navigate(`/materials/${material.id}`);
      return;
    }
    setBusy(true);
    try {
      await api.downloadFile(`/materials/${material.id}/download`, material.fileName || `${material.title}.pdf`);
      notify('Download started', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Download failed', 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-soft">
      <Link to={`/materials/${material.id}`} className="block">
        <div className={`flex h-32 items-center justify-center ${tone}`}>
          {material.thumbnail ? (
            <img src={material.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <FileText className="h-12 w-12 opacity-70" />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="badge bg-navy/5 text-navy">{material.className}</span>
          {material.subject ? <span className="badge bg-royal/10 text-royal">{nameOf(material.subject)}</span> : null}
          {isPaid ? <span className="badge bg-gold/20 text-[#8a6100]">{formatPrice(material.price)}</span> : null}
          {material.accessType === 'STUDENT_ONLY' ? (
            <span className="badge bg-slate-100 text-slate-600">Students only</span>
          ) : null}
        </div>

        <Link
          to={`/materials/${material.id}`}
          className="line-clamp-2 font-display text-base font-bold leading-snug text-navy transition hover:text-royal"
        >
          {material.title}
        </Link>

        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{material.description}</p>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <dd>{humanise(material.materialType)}</dd>
          <dd>{formatFileSize(material.fileSize)}</dd>
          <dd>{material.downloadCount} downloads</dd>
        </dl>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={busy}
            className={isPaid && !material.hasAccess ? 'btn-gold flex-1' : 'btn-primary flex-1'}
          >
            {busy ? (
              <Spinner className="h-4 w-4" />
            ) : isPaid && !material.hasAccess ? (
              <>
                <ShoppingCart className="h-4 w-4" /> Buy now
              </>
            ) : !material.hasAccess ? (
              <>
                <Lock className="h-4 w-4" /> Sign in
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Download
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                notify('Please sign in to save favourites', 'info');
                return;
              }
              favourite.mutate();
            }}
            aria-label={favourited ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={favourited}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
              favourited
                ? 'border-rose-200 bg-rose-50 text-rose-600'
                : 'border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-500'
            }`}
          >
            <Heart className={`h-4 w-4 ${favourited ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  );
}
