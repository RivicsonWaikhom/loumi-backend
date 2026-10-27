import { Link } from 'react-router-dom';
import { Sprout, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-600 text-white">
        <Sprout className="h-7 w-7" />
      </span>
      <p className="mt-6 font-display text-6xl font-extrabold text-forest-900">404</p>
      <p className="mt-2 text-lg font-semibold text-forest-800">Page not found</p>
      <p className="mt-1 max-w-md text-sm text-forest-600">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
    </div>
  );
}
