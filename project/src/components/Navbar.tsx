import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Sprout, LogOut, User, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/disease-detection', label: 'Disease Detection' },
  { to: '/farm-planner', label: 'Pineapple Farm Planner' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/chatbot', label: 'Chatbot' },
  { to: '/variety-suitability', label: 'Variety & Suitability' },
  { to: '/weather-disease-prediction', label: 'Weather Disease Prediction' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative inline-flex h-9 items-center justify-center rounded-full px-2.5 2xl:px-3 text-xs 2xl:text-[13px] font-medium whitespace-nowrap transition-colors ${
      isActive
        ? 'text-forest-900 bg-forest-100 font-bold shadow-2xs'
        : 'text-forest-600 hover:text-forest-900 hover:bg-forest-50'
    }`;

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-forest-100'
          : 'bg-white/80 backdrop-blur-sm border-b border-forest-100/60'
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="LOUMI home">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-white shadow-xs">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-2xl font-black tracking-tight text-forest-800">
            LOUMI
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <ul className="hidden xl:flex items-center gap-0.5 2xl:gap-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop Auth & Cart Controls */}
        <div className="hidden xl:flex items-center gap-2 2xl:gap-2.5 shrink-0">
          <Link
            to="/marketplace/cart"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50/70 px-3.5 text-xs font-bold text-forest-800 shadow-2xs transition hover:bg-forest-100 hover:border-forest-300 whitespace-nowrap"
            title="View Cart"
          >
            <ShoppingBag className="h-4 w-4 text-forest-700 shrink-0" />
            <span>Cart</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 items-center gap-2 rounded-full border border-forest-200 bg-forest-50/70 px-3 text-xs text-forest-800 shadow-2xs whitespace-nowrap">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-700 text-[10px] font-bold text-white shrink-0">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </span>
                <span className="max-w-[120px] truncate font-semibold text-forest-900">
                  {user?.full_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3.5 text-xs font-semibold text-forest-700 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                title="Log out of LOUMI"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                to="/login"
                className="inline-flex h-9 items-center justify-center rounded-full px-3.5 text-xs 2xl:text-sm font-semibold text-forest-700 transition hover:bg-forest-50 hover:text-forest-900 whitespace-nowrap"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-9 items-center justify-center rounded-full bg-pineapple-400 px-4 text-xs 2xl:text-sm font-bold text-forest-950 shadow-xs transition hover:bg-pineapple-500 hover:text-forest-950 whitespace-nowrap"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-forest-700 transition hover:bg-forest-50 xl:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      {open && (
        <div className="border-t border-forest-100 bg-white xl:hidden animate-fade-in shadow-lg">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-forest-100 font-bold text-forest-900'
                        : 'text-forest-700 hover:bg-forest-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}

            {/* Mobile Cart Link */}
            <li>
              <NavLink
                to="/marketplace/cart"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-forest-100 font-bold text-forest-900'
                      : 'text-forest-700 hover:bg-forest-50'
                  }`
                }
              >
                <ShoppingBag className="h-4 w-4 text-forest-600" />
                <span>Cart</span>
              </NavLink>
            </li>

            {/* Mobile Auth Actions */}
            <li className="mt-3 pt-3 border-t border-forest-100">
              {isAuthenticated ? (
                <div className="flex items-center justify-between rounded-xl bg-forest-50 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-700 text-xs font-bold text-white">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                    </span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-forest-900">{user?.full_name}</p>
                      <p className="text-[11px] text-forest-500">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="inline-flex items-center gap-1 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    className="block rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-forest-800 transition hover:bg-forest-50"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block rounded-xl bg-pineapple-400 px-4 py-2.5 text-center text-sm font-bold text-forest-900 shadow-xs transition hover:bg-pineapple-500"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
