import { Link } from 'react-router-dom';
import { PageHero } from '../components/Layout';

export default function Register() {
  return (
    <>
      <PageHero title="Account access" subtitle="Student and teacher accounts are managed by the institute." />
      <section className="bg-mist py-16">
        <div className="container-page">
          <div className="card mx-auto max-w-xl p-6 text-center sm:p-8">
            <h1 className="font-display text-xl font-extrabold text-navy">Accounts are created by an administrator</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Please contact the institute to request a student or teacher account. Once your account has been created,
              you can sign in here.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/contact" className="btn-primary">Contact the institute</Link>
              <Link to="/login" className="btn-ghost">Sign in</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
