import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface Props {
  to: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
}

export function NavLink({ to, children, className, activeClassName, exact = false }: Props) {
  const { pathname } = useLocation();
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={cn(
        'relative py-2 text-sm font-medium transition-colors',
        active ? 'text-white' : 'text-slate-300 hover:text-white',
        className
      )}
    >
      {children}
      {active ? <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-gold" /> : null}
    </Link>
  );
}
