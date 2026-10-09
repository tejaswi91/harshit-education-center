import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, GraduationCap, Search, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MaterialCard } from '../components/MaterialCard';
import { Spinner } from '../components/ui/Spinner';
import type { ClassLevel, CourseItem, GalleryItemType, Material, NoticeItem, TeacherItem } from '../types';

const HIGHLIGHTS = [
  { icon: Users, title: 'Expert Faculty', text: 'Experienced teachers who simplify every concept.' },
  { icon: BookOpen, title: 'Smart Material', text: 'Chapter-wise notes, papers and practice sheets.' },
  { icon: GraduationCap, title: 'All Boards', text: 'CBSE, ICSE and State Board preparation.' },
  { icon: Sparkles, title: 'Small Batches', text: 'Personal attention for every student.' }
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();
  const [className, setClassName] = useState('');
  const [search, setSearch] = useState('');

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => api.get<CourseItem[]>('/public/courses') });
  const { data: notices } = useQuery({
    queryKey: ['notices'],
    queryFn: () => api.get<NoticeItem[]>('/public/notices?limit=3')
  });
  const { data: testimonials } = useQuery({
    queryKey: ['testimonials'],
    queryFn: () => api.get<{ _id: string; name: string; quote: string; className: string }[]>('/public/testimonials')
  });
  const { data: gallery } = useQuery({ queryKey: ['gallery'], queryFn: () => api.get<GalleryItemType[]>('/public/gallery') });
  const { data: teachers } = useQuery({ queryKey: ['teachers'], queryFn: () => api.get<TeacherItem[]>('/public/teachers') });
  const { data: materials, isLoading: loadingMaterials } = useQuery({
    queryKey: ['home-materials'],
    queryFn: () => api.get<{ items: Material[] }>('/public/materials?limit=6&sort=recent')
  });

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (className) params.set('className', className);
    if (search.trim()) params.set('search', search.trim());
    navigate(`/materials?${params.toString()}`);
  }
  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #1554d3, transparent 45%)' }}
        />
        <div className="container-page relative py-20 sm:py-28">
          <div className="max-w-2xl">
            <span className="badge bg-gold/15 text-gold">Admissions open for 2026-27</span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              Build a strong foundation from <span className="text-gold">Nursery to Class 12</span>
            </h1>
            <p className="mt-5 text-base text-slate-300 sm:text-lg">
              Concept classes, chapter-wise study material and dedicated doubt sessions for all major boards, taught by
              experienced faculty.
            </p>

            <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-soft sm:flex-row">
              <select value={className} onChange={(event) => setClassName(event.target.value)} className="field flex-1" aria-label="Select class">
                <option value="">Select Class</option>
                {classes?.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field flex-[2]"
                placeholder="Search study material"
                aria-label="Search study material"
              />
              <button type="submit" className="btn-gold">
                <Search className="h-4 w-4" /> Search
              </button>
            </form>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/materials" className="btn-gold">
                Browse Study Material <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="btn-outline">
                Enquire Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-mist">
        <div className="container-page grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-royal/10 text-royal">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-navy">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Latest Study Material</h2>
            <p className="mt-2 text-sm text-slate-500">Recently uploaded notes, papers and practice resources.</p>
          </div>
          <Link to="/materials" className="btn-ghost">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loadingMaterials
            ? [0, 1, 2].map((key) => (
                <div key={key} className="card flex h-80 items-center justify-center">
                  <Spinner />
                </div>
              ))
            : materials?.items.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  onRequireLogin={() => {
                    if (!user) notify('Sign in to download study material', 'info');
                  }}
                />
              ))}
        </div>
      </section>
      <section className="bg-mist py-16">
        <div className="container-page">
          <h2 className="section-title text-center">Choose Your Class</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-500">
            Explore study material curated for every stage of your academic journey.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {classes?.map((item) => (
              <Link
                key={item.key}
                to={`/materials?className=${encodeURIComponent(item.key)}`}
                className="card flex flex-col items-center gap-2 px-3 py-6 text-center transition hover:-translate-y-1 hover:border-royal/30 hover:shadow-soft"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-royal/10 text-sm font-extrabold text-royal">
                  {item.label.replace('Class ', '')}
                </span>
                <span className="text-sm font-semibold text-navy">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-3">
          <div>
            <h2 className="section-title">Latest Notices</h2>
            <p className="mt-2 text-sm text-slate-500">Important updates for students and parents.</p>
            <div className="mt-6 space-y-4">
              {notices?.map((notice) => (
                <article key={notice._id} className="card p-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-xl bg-royal/10 px-3 py-2 text-center text-royal">
                      <p className="text-[10px] font-bold uppercase">
                        {new Date(notice.publishDate).toLocaleDateString('en-IN', { month: 'short' })}
                      </p>
                      <p className="text-lg font-extrabold leading-none">{new Date(notice.publishDate).getDate()}</p>
                    </div>
                    <div>
                      <span className="badge bg-gold/20 text-[#8a6100]">{notice.category}</span>
                      <h3 className="mt-2 font-display text-base font-bold leading-snug text-navy">{notice.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{notice.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <h2 className="section-title">Our Teachers</h2>
            <p className="mt-2 text-sm text-slate-500">Faculty who make every concept easy to understand.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {teachers?.map((teacher) => (
                <article key={teacher.id} className="card flex gap-4 p-5">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-navy font-display text-lg font-extrabold text-white">
                    {teacher.photoUrl ? (
                      <img src={teacher.photoUrl} alt={teacher.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      teacher.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-navy">{teacher.name}</h3>
                    <p className="text-xs font-medium text-royal">{teacher.qualification}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{teacher.bio}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {teacher.experienceYears} yrs experience
                      {teacher.subjects.length ? ` • ${teacher.subjects.map((s) => s.name).join(', ')}` : ''}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mist py-16">
        <div className="container-page">
          <h2 className="section-title text-center">What Parents & Students Say</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {testimonials?.map((item) => (
              <figure key={item._id} className="card flex flex-col p-6">
                <p className="flex-1 text-sm leading-relaxed text-slate-600">“{item.quote}”</p>
                <figcaption className="mt-5 border-t border-slate-100 pt-4">
                  <p className="font-display text-sm font-bold text-navy">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.className}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {gallery?.length ? (
        <section className="container-page py-16">
          <h2 className="section-title text-center">Our Campus</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((item) => (
              <figure key={item._id} className="group relative overflow-hidden rounded-2xl">
                <img
                  src={item.imageUrl}
                  alt={item.altText}
                  className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-4 text-sm font-semibold text-white">
                  {item.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-navy py-16 text-white">
        <div className="container-page flex flex-col items-center gap-6 text-center">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Ready to start learning?</h2>
          <p className="max-w-xl text-sm text-slate-300">
            Contact the institute to request an account and access student-only material.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="btn-gold">
              Request an Account
            </Link>
            <Link to="/contact" className="btn-outline">
              Talk to Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
