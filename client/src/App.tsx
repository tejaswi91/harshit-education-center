import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './context/AuthContext';
import type { Role } from './types';

const Home = lazy(() => import('./pages/Home'));
const Materials = lazy(() => import('./pages/Materials'));
const MaterialDetail = lazy(() => import('./pages/MaterialDetail'));
const Courses = lazy(() => import('./pages/Courses'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const StudentDashboard = lazy(() => import('./pages/dashboard/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./pages/dashboard/TeacherDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function Protected({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/:id" element={<MaterialDetail />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard/student"
            element={
              <Protected roles={['STUDENT']}>
                <StudentDashboard />
              </Protected>
            }
          />
          <Route
            path="/dashboard/teacher"
            element={
              <Protected roles={['TEACHER', 'ADMIN']}>
                <TeacherDashboard />
              </Protected>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <Protected roles={['ADMIN']}>
                <AdminDashboard />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected roles={['STUDENT', 'TEACHER', 'ADMIN']}>
                <Profile />
              </Protected>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

