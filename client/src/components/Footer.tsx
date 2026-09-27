import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Facebook, GraduationCap, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { api } from '../lib/api';
import type { InstituteSettings } from '../types';

const YEAR = new Date().getFullYear();

export function Footer() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<InstituteSettings>('/public/settings')
  });

  const socials = [
    { key: 'youtube', href: settings?.socialLinks?.youtube, Icon: Youtube, label: 'YouTube' },
    { key: 'instagram', href: settings?.socialLinks?.instagram, Icon: Instagram, label: 'Instagram' },
    { key: 'facebook', href: settings?.socialLinks?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'linkedin', href: settings?.socialLinks?.linkedin, Icon: Linkedin, label: 'LinkedIn' }
  ].filter((social) => Boolean(social.href));

  return (
    <footer className="mt-auto bg-navy text-slate-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold text-navy">
              <GraduationCap className="h-6 w-6" />
            </span>
            <span className="font-display text-base font-extrabold text-white">
              {settings?.instituteName ?? 'Harshit Education Center'}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {settings?.tagline ?? 'Learn Today • Lead Tomorrow'}. Quality coaching for students from Nursery to Class 12
            across all major Indian boards.
          </p>
          {socials.length ? (
            <div className="mt-5 flex gap-2">
              {socials.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-gold hover:text-navy"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-wide text-white">Quick Links</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { to: '/', label: 'Home' },
              { to: '/courses', label: 'Courses' },
              { to: '/materials', label: 'Study Material' },
              { to: '/about', label: 'About Us' },
              { to: '/contact', label: 'Contact' }
            ].map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="transition hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-wide text-white">Classes</h4>
          <ul className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
            {['Nursery', 'LKG / UKG', 'Class 1 - 5', 'Class 6 - 8', 'Class 9 - 10', 'Class 11 - 12'].map((label) => (
              <li key={label}>
                <Link to="/courses" className="transition hover:text-gold">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-bold uppercase tracking-wide text-white">Get in Touch</h4>
          <ul className="mt-4 space-y-3 text-sm">
            {settings?.address ? (
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{settings.address}</span>
              </li>
            ) : null}
            {settings?.phone ? (
              <li>
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex gap-2.5 transition hover:text-gold">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {settings.phone}
                </a>
              </li>
            ) : null}
            {settings?.email ? (
              <li>
                <a href={`mailto:${settings.email}`} className="flex gap-2.5 transition hover:text-gold">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {settings.email}
                </a>
              </li>
            ) : null}
          </ul>
          <Link to="/contact" className="btn-gold mt-5">
            Enquire Now
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-400 sm:flex-row">
          <p>
            © {YEAR} {settings?.instituteName ?? 'Harshit Education Center'}. All rights reserved.
          </p>
          <p>Crafted for better learning outcomes</p>
        </div>
      </div>
    </footer>
  );
}
