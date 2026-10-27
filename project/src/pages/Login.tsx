import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Sprout, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/apiClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/farm-planner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(cleanEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials and try again.');
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
            Welcome back to LOUMI
          </h1>
          <p className="mt-1 text-xs text-forest-600 sm:text-sm leading-relaxed">
            Sign in to access your farm plots, observations, and agronomy tools.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-forest-800">
              Email address
            </label>
            <input
              id="login-email"
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
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-semibold text-forest-800">
                Password
              </label>
            </div>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 text-sm font-bold text-white shadow-xs transition hover:bg-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.99]"
          >
            <LogIn className="h-4 w-4" />
            <span>{submitting ? 'Logging in…' : 'Log In'}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-forest-600">
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            state={{ from: location.state?.from }}
            className="font-bold text-forest-800 underline underline-offset-2 hover:text-forest-950 transition"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
