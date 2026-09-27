import { Link } from 'react-router-dom';
import { Compass, Home as HomeIcon, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="bg-mist">
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-royal/10 text-royal">
          <Compass className="h-8 w-8" />
        </span>
        <p className="mt-6 font-display text-6xl font-extrabold text-navy">404</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-navy">We could not find that page</h1>
        <p className="mt-3 max-w-md text-sm text-slate-500">
          The page you are looking for may have been moved or removed. Browse our study material or head back to the home
          page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">
            <HomeIcon className="h-4 w-4" /> Back to home
          </Link>
          <Link to="/materials" className="btn-ghost">
            <Search className="h-4 w-4" /> Browse material
          </Link>
        </div>
      </div>
    </section>
  );
}