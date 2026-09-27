import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { PageHero } from '../components/Layout';
import { Spinner } from '../components/ui/Spinner';
import type { BoardRef, ClassLevel, InstituteSettings } from '../types';

const emptyForm = { name: '', mobile: '', email: '', className: 'Class 1', board: '', message: '' };

export default function Contact() {
  const { notify } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<InstituteSettings>('/public/settings') });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassLevel[]>('/public/classes') });
  const { data: boards } = useQuery({ queryKey: ['boards'], queryFn: () => api.get<BoardRef[]>('/public/boards') });

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.post<{ message: string }>('/public/enquiries', {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        className: form.className,
        board: form.board,
        message: form.message.trim()
      });
      setSent(true);
      setForm(emptyForm);
      notify(result.message ?? 'Thank you! We will contact you shortly.', 'success');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Unable to submit your enquiry', 'error');
    } finally {
      setBusy(false);
    }
  }

  const contactRows = [
    {
      icon: Phone,
      label: 'Phone',
      value: settings?.phone,
      href: settings?.phone ? `tel:${settings.phone.replace(/\s/g, '')}` : undefined
    },
    { icon: Mail, label: 'Email', value: settings?.email, href: settings?.email ? `mailto:${settings.email}` : undefined },
    { icon: MapPin, label: 'Address', value: settings?.address },
    { icon: Clock, label: 'Office hours', value: 'Mon – Sat, 9:00 AM to 7:00 PM' }
  ].filter((row) => Boolean(row.value));

  return (
    <>
      <PageHero
        title="Contact Us"
        subtitle="Tell us about your child and we will call you back with the right batch and fee details."
      />

      <section className="bg-mist py-16">
        <div className="container-page grid gap-8 lg:grid-cols-3">
          <div className="card p-6 sm:p-8 lg:col-span-2">
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h2 className="font-display text-xl font-extrabold text-navy">Enquiry received</h2>
                <p className="max-w-md text-sm text-slate-500">
                  Thank you for reaching out. Our team will contact you shortly to discuss classes and fees.
                </p>
                <button type="button" onClick={() => setSent(false)} className="btn-ghost mt-2">
                  Send another enquiry
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl font-extrabold text-navy">Send an enquiry</h2>
                <p className="mt-1.5 text-sm text-slate-500">All fields marked required help us respond faster.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor="c-name">Parent / student name</label>
                      <input
                        id="c-name"
                        required
                        minLength={2}
                        className="field"
                        value={form.name}
                        onChange={(e) => update('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-mobile">Mobile number</label>
                      <input
                        id="c-mobile"
                        required
                        inputMode="tel"
                        minLength={6}
                        className="field"
                        placeholder="10-digit mobile"
                        value={form.mobile}
                        onChange={(e) => update('mobile', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-email">Email (optional)</label>
                      <input
                        id="c-email"
                        type="email"
                        className="field"
                        value={form.email}
                        onChange={(e) => update('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-class">Class seeking admission</label>
                      <select
                        id="c-class"
                        required
                        className="field"
                        value={form.className}
                        onChange={(e) => update('className', e.target.value)}
                      >
                        {classes?.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-board">Board (optional)</label>
                      <select
                        id="c-board"
                        className="field"
                        value={form.board}
                        onChange={(e) => update('board', e.target.value)}
                      >
                        <option value="">Select board</option>
                        {boards?.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="c-message">Your message</label>
                    <textarea
                      id="c-message"
                      required
                      minLength={5}
                      rows={5}
                      className="field resize-y"
                      placeholder="Share the subjects you need help with, preferred batch timing, or any questions."
                      value={form.message}
                      onChange={(e) => update('message', e.target.value)}
                    />
                  </div>

                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {busy ? 'Sending…' : 'Send enquiry'}
                  </button>
                </form>
              </>
            )}
          </div>
          <aside className="space-y-5">
            <div className="card p-6">
              <h2 className="font-display text-base font-extrabold text-navy">Reach us directly</h2>
              <ul className="mt-5 space-y-4">
                {contactRows.map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-royal/10 text-royal">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      {href ? (
                        <a href={href} className="break-words text-sm font-medium text-navy transition hover:text-royal">
                          {value}
                        </a>
                      ) : (
                        <p className="break-words text-sm font-medium text-navy">{value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card bg-navy p-6 text-white">
              <h2 className="font-display text-base font-extrabold">Looking for study material?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Browse chapter-wise notes, worksheets and previous year papers. Create a free account to download
                student-only material.
              </p>
              <a href="/materials" className="btn-gold mt-5 w-full">
                Browse study material
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}