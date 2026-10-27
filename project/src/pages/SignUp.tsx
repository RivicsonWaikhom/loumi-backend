import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Sprout, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/apiClient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/farm-planner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setSubmitting(true);
    try {
      await signup(cleanName, cleanEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please check your details and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-forest-50/40 px-4 py-8 sm:py-12 md:py-14">
      <div className="w-full max-w-[420px] rounded-3xl border border-forest-100 bg-white p-7 shadow-card sm:p-9">
        {/* Card Header */}
        <div className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-600 text-white shadow-xs">
            <Sprout className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-3.5 font-display text-2xl font-bold tracking-tight text-forest-900 sm:text-2xl">
            Create your LOUMI account
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-forest-600 leading-relaxed">
            Set up your secure, isolated agricultural decision-support workspace.
          </p>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="signup-name" className="block text-xs font-semibold text-forest-800">
              Full name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Thoiba Singh"
              className="mt-1.5 w-full rounded-xl border border-forest-200 bg-white px-3.5 py-2.5 text-sm text-forest-900 placeholder:text-forest-400 shadow-xs transition focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-xs font-semibold text-forest-800">
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="farmer@example.com"
              className="mt-1.5 w-full rounded-xl border border-forest-200 bg-white px-3.5 py-2.5 text-sm text-forest-900 placeholder:text-forest-400 shadow-xs transition focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-xs font-semibold text-forest-800">
              Password (min. 6 characters)
            </label>
            <div className="relative mt-1.5">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-forest-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-forest-900 placeholder:text-forest-400 shadow-xs transition focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-forest-400 hover:text-forest-700 transition focus:outline-hidden"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="signup-confirm-password" className="block text-xs font-semibold text-forest-800">
              Confirm password
            </label>
            <div className="relative mt-1.5">
              <input
                id="signup-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-forest-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-forest-900 placeholder:text-forest-400 shadow-xs transition focus:border-forest-500 focus:outline-hidden focus:ring-1 focus:ring-forest-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 text-sm font-bold text-white shadow-xs transition hover:bg-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.99]"
          >
            <UserPlus className="h-4 w-4" />
            <span>{submitting ? 'Creating account…' : 'Create Account'}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-forest-600">
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ from: location.state?.from }}
            className="font-bold text-forest-800 underline underline-offset-2 hover:text-forest-950 transition"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
