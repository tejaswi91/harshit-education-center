import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../lib/api';
import { ACCESS_TYPE_OPTIONS, cn, MATERIAL_TYPE_OPTIONS, SORT_OPTIONS } from '../lib/utils';
import { PageHero } from '../components/Layout';
import { MaterialCard } from '../components/MaterialCard';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Spinner';
import type { BoardRef, ClassLevel, Material, Paged, SubjectRef } from '../types';

const PAGE_SIZE = 12;

export default function Materials() {
  const [searchParams, setSearchParams] = useSearchParams();

  const className = searchParams.get('className') ?? '';
  const subject = searchParams.get('subject') ?? '';
  const board = searchParams.get('board') ?? '';
  const materialType = searchParams.get('materialType') ?? '';
  const accessType = searchParams.get('accessType') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'recent';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: boards } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<BoardRef[]>('/public/boards') });
  const { data: subjects } = useQuery({
    queryKey: ['subjects', className],
    queryFn: () => api.get<SubjectRef[]>(`/public/subjects${className ? `?className=${encodeURIComponent(className)}` : ''}`)
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ sort, page: String(page), limit: String(PAGE_SIZE) });
    if (className) params.set('className', className);
    if (subject) params.set('subject', subject);
    if (board) params.set('board', board);
    if (materialType) params.set('materialType', materialType);
    if (accessType) params.set('accessType', accessType);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [className, subject, board, materialType, accessType, search, sort, page]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['materials', queryString],
    queryFn: () => api.get<Paged<Material>>(`/public/materials?${queryString}`)
  });

  /**
   * Any filter change resets pagination. Changing the class also drops the subject,
   * because the subject list returned by the API is scoped to the selected class.
   */
  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'className') next.delete('subject');
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function clearAll() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const hasFilters = Boolean(className || subject || board || materialType || accessType || search);
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <>
      <PageHero title="Study Material" subtitle="Chapter-wise notes, worksheets, question papers and previous year papers.">
        <form
          className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
            updateParam('search', input.value);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search notes, papers, chapters…"
              className="field pl-10"
              aria-label="Search study material"
            />
          </div>
          <button type="submit" className="btn-gold">Search</button>
        </form>
      </PageHero>
      <section className="bg-mist py-12">
        <div className="container-page grid gap-8 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="card p-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-navy">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </h2>
                {hasFilters ? (
                  <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs font-semibold text-royal hover:underline">
                    <X className="h-3 w-3" /> Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="field-label" htmlFor="f-class">Class</label>
                  <select id="f-class" className="field" value={className} onChange={(e) => updateParam('className', e.target.value)}>
                    <option value="">All classes</option>
                    {classes?.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="f-subject">Subject</label>
                  <select id="f-subject" className="field" value={subject} onChange={(e) => updateParam('subject', e.target.value)}>
                    <option value="">All subjects</option>
                    {subjects?.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="f-board">Board</label>
                  <select id="f-board" className="field" value={board} onChange={(e) => updateParam('board', e.target.value)}>
                    <option value="">All boards</option>
                    {boards?.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="f-type">Material type</label>
                  <select id="f-type" className="field" value={materialType} onChange={(e) => updateParam('materialType', e.target.value)}>
                    <option value="">All types</option>
                    {MATERIAL_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="f-access">Access</label>
                  <select id="f-access" className="field" value={accessType} onChange={(e) => updateParam('accessType', e.target.value)}>
                    <option value="">All access</option>
                    {ACCESS_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {isLoading ? 'Loading material…' : `${total} ${total === 1 ? 'item' : 'items'} found`}
                {isFetching && !isLoading ? <span className="ml-2 text-xs text-royal">Updating…</span> : null}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-xs font-medium text-slate-500">
                  Sort by
                </label>
                <select id="sort" className="field w-auto py-2" value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
                  {SORT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Spinner className="h-8 w-8" />
              </div>
            ) : isError ? (
              <div className="mt-6">
                <ErrorState onRetry={() => void refetch()} />
              </div>
            ) : !data?.items.length ? (
              <div className="mt-6">
                <EmptyState
                  icon={<FileSearch className="h-8 w-8" />}
                  title="No material matched your filters"
                  description="Try clearing a filter or searching for a different chapter."
                  action={
                    hasFilters ? (
                      <button type="button" onClick={clearAll} className="btn-ghost mt-2">
                        Clear all filters
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            )}
            {!isLoading && !isError && pages > 1 ? (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => updateParam('page', String(page - 1))}
                  disabled={page <= 1}
                  className="btn-ghost px-4 py-2"
                >
                  Previous
                </button>
                {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => updateParam('page', String(number))}
                    aria-current={number === page ? 'page' : undefined}
                    className={cn(
                      'h-10 w-10 rounded-xl text-sm font-semibold transition',
                      number === page ? 'bg-royal text-white' : 'border border-slate-200 text-ink hover:border-royal hover:text-royal'
                    )}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateParam('page', String(page + 1))}
                  disabled={page >= pages}
                  className="btn-ghost px-4 py-2"
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
