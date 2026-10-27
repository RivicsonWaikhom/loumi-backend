import { Link } from 'react-router-dom';
import { Sprout, Mail, Phone, MapPin } from 'lucide-react';

const linkClass =
  'text-sm text-forest-200/90 transition-colors duration-200 hover:text-white hover:underline underline-offset-4 decoration-pineapple-400/60';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-forest-900 bg-forest-950 text-forest-100">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-12 md:grid-cols-4">
          {/* About LOUMI */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-white shadow-xs">
                <Sprout className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-display text-2xl font-black tracking-tight text-white">
                LOUMI
              </span>
            </Link>
            <h4 className="mt-5 font-display text-sm font-semibold uppercase tracking-wider text-white">
              About LOUMI
            </h4>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-forest-300">
              LOUMI is an AI-powered agriculture platform designed to help farmers
              make informed decisions about crop health, cultivation planning, crop
              suitability, and potential farming risks in Manipur.
            </p>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Features
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/disease-detection" className={linkClass}>Disease Detection</Link></li>
              <li><Link to="/farm-planner" className={linkClass}>Pineapple Farm Planner</Link></li>
              <li><Link to="/marketplace" className={linkClass}>Marketplace</Link></li>
              <li><Link to="/chatbot" className={linkClass}>Chatbot</Link></li>
              <li><Link to="/variety-suitability" className={linkClass}>Variety &amp; Suitability</Link></li>
              <li><Link to="/weather-disease-prediction" className={linkClass}>Weather Disease Prediction</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Contact &amp; Support
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-forest-200">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-pineapple-400 shrink-0" aria-hidden />
                <span>support&#64;loumi.example</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-pineapple-400 shrink-0" aria-hidden />
                <span>+91 98620 12345</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-pineapple-400 shrink-0" aria-hidden />
                <span>Manipur, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Privacy + Disclaimer */}
        <div className="mt-10 grid gap-6 border-t border-forest-800/60 pt-6 md:grid-cols-2">
          <div>
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
              Privacy
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-forest-300">
              LOUMI aims to handle user information responsibly. Personal details,
              uploaded images, and location data are collected solely to provide requested
              features and are isolated strictly per authenticated farmer.
            </p>
          </div>
          <div>
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-white">
              Disclaimer
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-forest-300">
              LOUMI provides AI-generated predictions and agricultural guidance for
              informational purposes only. Results should not replace advice from
              qualified agricultural experts and local KVK officers.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-forest-400">
          &copy; {new Date().getFullYear()} LOUMI. Built for farmers in Manipur.
        </p>
      </div>
    </footer>
  );
}
