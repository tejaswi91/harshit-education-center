import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Header, TopBar } from './Header';
import { Footer } from './Footer';

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function PageHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="bg-navy py-14 text-white">
      <div className="container-page">
        <nav aria-label="Breadcrumb" className="mb-3 text-xs text-slate-400">
          <Link to="/" className="transition hover:text-gold">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-200">{title}</span>
        </nav>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{subtitle}</p> : null}
        {children}
      </div>
    </section>
  );
}
