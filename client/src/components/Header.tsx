import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, LayoutDashboard, LogOut, Menu, Phone, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { InstituteSettings } from '../types';
import { NavLink } from './ui/NavLink';

const LINKS = [
  { to: '/', label: 'Home', exact: true },
  { to: '/courses', label: 'Courses' },
  { to: '/materials', label: 'Study Material' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' }
];

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<InstituteSettings>('/public/settings')
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const dashboardPath =
    user?.role === 'ADMIN' ? '/dashboard/admin' : user?.role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-soft">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold text-navy">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="hidden sm:block">
            <span className="block font-display text-base font-extrabold leading-tight text-white">
              {settings?.instituteName ?? 'Harshit Education Center'}
            </span>
            <span className="block text-[11px] font-medium text-gold">{settings?.tagline ?? 'Learn Today • Lead Tomorrow'}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} exact={link.exact}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Link to={dashboardPath} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                Login
              </Link>
              <Link to="/register" className="btn-gold py-2.5">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="grid h-10 w-10 place-items-center rounded-xl text-white transition hover:bg-white/10 lg:hidden"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {menuOpen ? <MobileMenu onNavigate={() => setMenuOpen(false)} /> : null}
    </header>
  );
}
function MobileMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dashboardPath =
    user?.role === 'ADMIN' ? '/dashboard/admin' : user?.role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/student';

  return (
    <div className="border-t border-white/10 bg-navy lg:hidden">
      <div className="container-page flex flex-col gap-1 py-4">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} exact={link.exact} className="py-2.5">
            {link.label}
          </NavLink>
        ))}
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
          {user ? (
            <>
              <Link to={dashboardPath} onClick={onNavigate} className="btn-ghost justify-start">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <Link to="/profile" onClick={onNavigate} className="btn-ghost justify-start">
                <UserIcon className="h-4 w-4" /> My profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onNavigate();
                  navigate('/');
                }}
                className="btn-ghost justify-start"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={onNavigate} className="btn-ghost justify-start">
                Login
              </Link>
              <Link to="/register" onClick={onNavigate} className="btn-gold">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<InstituteSettings>('/public/settings')
  });

  return (
    <div className="hidden bg-[#061529] text-slate-300 lg:block">
      <div className="container-page flex h-9 items-center justify-between text-xs">
        <p>Quality coaching from Nursery to Class 12</p>
        <div className="flex items-center gap-5">
          {settings?.phone ? (
            <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 transition hover:text-gold">
              <Phone className="h-3.5 w-3.5" />
              {settings.phone}
            </a>
          ) : null}
          {settings?.email ? <span>{settings.email}</span> : null}
        </div>
      </div>
    </div>
  );
}
