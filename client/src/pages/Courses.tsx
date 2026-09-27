import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import { api } from '../lib/api';
import { nameOf } from '../lib/utils';
import { PageHero } from '../components/Layout';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Spinner';
import type { ClassLevel, CourseItem } from '../types';

const GROUP_ORDER = ['LKG - UKG', 'Class 1 - 5', 'Class 6 - 8', 'Class 9 - 10', 'Class 11 - 12'];
const GROUP_ICON: Record<string, string> = {
  'LKG - UKG': 'bg-rose-50 text-rose-600',
  'Class 1 - 5': 'bg-orange-50 text-orange-600',
  'Class 6 - 8': 'bg-emerald-50 text-emerald-600',
  'Class 9 - 10': 'bg-sky-50 text-sky-600',
  'Class 11 - 12': 'bg-violet-50 text-violet-600'
};

export default function Courses() {
  const [className, setClassName] = useState('');

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ['courses', className],
    queryFn: () => api.get<CourseItem[]>(`/public/courses${className ? `?className=${encodeURIComponent(className)}` : ''}`)
  });

  // Course records store a plain class name; the class list tells us which band it belongs to.
  const groupOf = useMemo(() => {
    const map = new Map<string, string>();
    classes?.forEach((item) => map.set(item.key, item.group));
    return map;
  }, [classes]);

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: courses?.filter((course) => groupOf.get(course.className) === group) ?? []
  })).filter((entry) => entry.items.length > 0);

  const subjectCount = new Set(courses?.flatMap((course) => course.subjects?.map(nameOf) ?? []) ?? []).size;

  return (
    <>
      <PageHero title="Our Courses" subtitle="Concept classes from Nursery through Class 12, matched to your board and subject.">
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setClassName('')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              className === '' ? 'bg-gold text-navy' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All classes
          </button>
          {classes?.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setClassName(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                className === item.key ? 'bg-gold text-navy' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </PageHero>

      <section className="bg-mist py-12">
        <div className="container-page">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, label: 'Active courses', value: courses?.length ?? 0 },
              { icon: GraduationCap, label: 'Subjects covered', value: subjectCount },
              { icon: Users, label: 'Class levels', value: classes?.length ?? 0 }
            ].map(({ icon: Icon, label, value }) => (
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

          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : isError ? (
            <div className="mt-8">
              <ErrorState onRetry={() => void refetch()} />
            </div>
          ) : !grouped.length ? (
            <div className="mt-8">
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="No courses published yet"
                description="Courses for this class are being prepared. Please check back soon or contact us for details."
                action={
                  <Link to="/contact" className="btn-primary mt-2">
                    Contact us
                  </Link>
                }
              />
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mt-12 first:mt-10">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl ${GROUP_ICON[group] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <h2 className="section-title">{group}</h2>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((course) => (
                    <article key={course._id} className="card flex flex-col p-6">
                      <span className="badge w-fit bg-royal/10 text-royal">{course.className}</span>
                      <h3 className="mt-3 font-display text-lg font-bold text-navy">{course.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{course.description}</p>

                      {course.subjects?.length ? (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {course.subjects.map((subject) => (
                            <span key={subject._id} className="badge bg-navy/5 text-navy">
                              {nameOf(subject)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {course.boards?.length ? (
                        <p className="mt-3 text-xs text-slate-400">Boards: {course.boards.map(nameOf).join(', ')}</p>
                      ) : null}

                      <Link to="/contact" className="btn-ghost mt-5">
                        Enquire about this course
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}