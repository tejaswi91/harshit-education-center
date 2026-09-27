import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Heart, MapPin, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { nameOf } from '../lib/utils';
import { PageHero } from '../components/Layout';
import { Spinner } from '../components/ui/Spinner';
import type { GalleryItemType, InstituteSettings, TeacherItem, TestimonialItem } from '../types';

const VALUES = [
  { icon: BookOpen, title: 'Concept clarity', text: 'We build understanding rather than memorising formulas and answers.' },
  { icon: Users, title: 'Small batches', text: 'Limited students per batch so every learner gets individual attention.' },
  { icon: Heart, title: 'Doubt solving', text: 'Dedicated sessions make sure no question goes unanswered.' },
  { icon: Award, title: 'Exam focused', text: 'Chapter-wise practice aligned to CBSE, ICSE and State Board patterns.' }
];

export default function About() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<InstituteSettings>('/public/settings') });
  const { data: teachers } = useQuery({ queryKey: ['teachers'], queryFn: () => api.get<TeacherItem[]>('/public/teachers') });
  const { data: gallery } = useQuery({ queryKey: ['gallery'], queryFn: () => api.get<GalleryItemType[]>('/public/gallery') });
  const { data: testimonials } = useQuery({
    queryKey: ['testimonials'],
    queryFn: () => api.get<TestimonialItem[]>('/public/testimonials')
  });

  return (
    <>
      <PageHero title="About Us" subtitle={settings?.admissionMessage} />

      <section className="bg-white py-16">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="badge bg-royal/10 text-royal">Our story</span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-navy">
              {settings?.instituteName ?? 'Harshit Education Center'}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              {settings?.tagline ?? 'Learn Today, Lead Tomorrow'} — we are a coaching centre that teaches students from
              Nursery through Class 12 across all major Indian boards. Our classrooms combine structured concept sessions
              with chapter-wise study material so that what is taught in class is practised at home.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Every batch is kept intentionally small. Teachers track each student&apos;s progress, and dedicated doubt
              sessions make sure that a weak chapter never turns into a failed year.
            </p>
            {settings?.address ? (
              <p className="mt-6 flex items-start gap-2.5 text-sm text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-royal" />
                {settings.address}
              </p>
            ) : null}
            <Link to="/contact" className="btn-primary mt-7">
              Book a demo class
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-royal/10 text-royal">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-navy">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-mist py-16">
        <div className="container-page">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-royal/10 text-royal">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="section-title">Our Faculty</h2>
          </div>

          {!teachers?.length ? (
            <p className="mt-6 text-sm text-slate-500">Faculty profiles are being updated. Please check back shortly.</p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {teachers.map((teacher) => (
                <article key={teacher.id} className="card flex gap-4 p-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-navy font-display text-xl font-bold text-gold">
                    {teacher.photoUrl ? (
                      <img src={teacher.photoUrl} alt={teacher.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      teacher.name?.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-navy">{teacher.name}</h3>
                    <p className="text-xs font-medium text-royal">{teacher.qualification}</p>
                    <p className="mt-1.5 line-clamp-3 text-sm text-slate-500">{teacher.bio}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {teacher.experienceYears} yrs experience
                      {teacher.subjects?.length ? ` • ${teacher.subjects.map(nameOf).join(', ')}` : ''}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {gallery?.length ? (
        <section className="bg-white py-16">
          <div className="container-page">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-royal/10 text-royal">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="section-title">Our Campus</h2>
            </div>
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
          </div>
        </section>
      ) : null}

      {testimonials?.length ? (
        <section className="bg-mist py-16">
          <div className="container-page">
            <h2 className="section-title text-center">What Parents & Students Say</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {testimonials.map((item) => (
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
      ) : (
        <section className="flex min-h-[30vh] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </section>
      )}
    </>
  );
}