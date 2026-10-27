import { useState, useEffect } from 'react';
import {
  Microscope,
  CalendarRange,
  MessageSquare,
  Sprout,
  CloudSun,
  ArrowRight,
  ScanLine,
  Cpu,
  ClipboardCheck,
  Leaf,
  TrendingUp,
  MapPin,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import FeatureCard from '@/components/FeatureCard';
import { LinkButton } from '@/components/ui/Button';

export interface ManipurPhoto {
  id: string;
  title: string;
  location: string;
  crop: string;
  source: string;
  sourceUrl: string;
  image1200: string;
  image454: string;
  tag: string;
  description: string;
}

export const MANIPUR_PHOTOS: ManipurPhoto[] = [
  {
    id: 'pineapple_nongmaiching_02',
    title: 'Hillside Pineapple Plantation',
    location: 'Nongmaiching Ching, Imphal East',
    crop: 'Pineapple (Queen & Kew)',
    source: 'Wikimedia Commons (CC BY 4.0, Haoreima)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Pineapple_crop_plantation_in_a_slope_of_the_Nongmaiching_Ching_(meaning_%22Nongmaijing_Hill%22_in_Classical_Meitei_language)_in_Imphal_East_District,_Kangleipak_(Manipur)_02.jpg',
    image1200: '/images/manipur_agriculture/pineapple_nongmaiching_02_1200x800.jpg',
    image454: '/images/manipur_agriculture/pineapple_nongmaiching_02_454x303.jpg',
    tag: 'Pineapple Slopes',
    description: 'Commercial pineapple cultivation planted along the contour slopes of Nongmaijing Hill in Imphal East.',
  },
  {
    id: 'paddy_noney_district',
    title: 'Hybrid Paddy Terraces & Farmers',
    location: 'Noney District, Manipur',
    crop: 'Rice / Hybrid Paddy',
    source: 'Govt. of Manipur (Noney District Portal)',
    sourceUrl: 'https://noney.nic.in/gallery/image-gallery/',
    image1200: '/images/manipur_agriculture/paddy_noney_district_1200x800.jpg',
    image454: '/images/manipur_agriculture/paddy_noney_district_454x303.jpg',
    tag: 'Paddy Terraces',
    description: 'Local farmers tending to hybrid paddy crops across the terraced fields of Noney District.',
  },
  {
    id: 'pineapple_nongmaiching_01',
    title: 'Terraced Commercial Pineapple Rows',
    location: 'Nongmaiching Reserved Forest, Imphal East',
    crop: 'Pineapple Cultivation',
    source: 'Wikimedia Commons (CC BY 4.0, Haoreima)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/Category:Pineapple_fields_in_India',
    image1200: '/images/manipur_agriculture/pineapple_nongmaiching_01_1200x800.jpg',
    image454: '/images/manipur_agriculture/pineapple_nongmaiching_01_454x303.jpg',
    tag: 'Commercial Rows',
    description: 'Terraced commercial pineapple rows flourishing in the sub-tropical climate of eastern Manipur hills.',
  },
  {
    id: 'rice_planting_epao',
    title: 'Women Farmers Transplanting Rice',
    location: 'Paddy Fields, Manipur',
    crop: 'Rice Cultivation',
    source: 'E-Pao Photo Documentation Archive',
    sourceUrl: 'https://www.e-pao.net/epGallery.asp?id=6&src=Food/Rice201006',
    image1200: '/images/manipur_agriculture/rice_planting_epao_1200x800.jpg',
    image454: '/images/manipur_agriculture/rice_planting_epao_454x303.jpg',
    tag: 'Farmers at Work',
    description: 'Traditional transplantation of rice seedlings in fertile wetland fields during monsoon in Manipur.',
  },
  {
    id: 'rice_paddy_unt',
    title: 'Manipur Valley Rice Field Landscape',
    location: 'Manipur, India',
    crop: 'Wetland Rice Paddy',
    source: 'UNT Digital Library (Item metadc1631579)',
    sourceUrl: 'https://digital.library.unt.edu/ark:/67531/metadc1631579/',
    image1200: '/images/manipur_agriculture/rice_paddy_unt_1200x800.jpg',
    image454: '/images/manipur_agriculture/rice_paddy_unt_454x303.jpg',
    tag: 'Valley Landscape',
    description: 'Expansive alluvial rice paddies showing mature crop coverage in the heart of Manipur valley.',
  },
  {
    id: 'horticulture_noney_cabbage',
    title: 'Highland Horticulture & Crop Diversity',
    location: 'Noney District, Manipur',
    crop: 'Cabbage & Organic Crops',
    source: 'Govt. of Manipur (Noney District Portal)',
    sourceUrl: 'https://noney.nic.in/gallery/image-gallery/',
    image1200: '/images/manipur_agriculture/horticulture_noney_cabbage_1200x800.jpg',
    image454: '/images/manipur_agriculture/horticulture_noney_cabbage_454x303.jpg',
    tag: 'Highland Horticulture',
    description: 'Highland vegetable and cabbage horticulture under organic farming practices in Noney District.',
  },
];

const features = [
  {
    icon: Microscope,
    title: 'Disease Detection',
    description:
      'Upload or capture a photo of a pineapple leaf and let the model flag diseases and suggest next steps.',
    to: '/disease-detection',
    accent: 'forest' as const,
  },
  {
    icon: CalendarRange,
    title: 'Pineapple Farm Planner',
    description:
      'Turn your land, soil, water, and budget into a staged cultivation plan with a timeline and task checklist.',
    to: '/farm-planner',
    accent: 'pineapple' as const,
  },
  {
    icon: MessageSquare,
    title: 'Chatbot',
    description:
      'Ask farming questions in English or Hindi and get guidance grounded in pineapple cultivation practices.',
    to: '/chatbot',
    accent: 'earth' as const,
  },
  {
    icon: Sprout,
    title: 'Variety & Suitability',
    description:
      'Find out whether your land suits pineapple cultivation and which varieties fit your conditions best.',
    to: '/variety-suitability',
    accent: 'forest' as const,
  },
  {
    icon: CloudSun,
    title: 'Weather Disease Prediction',
    description:
      'See how local weather and location could raise disease risk — distinct from image-based detection.',
    to: '/weather-disease-prediction',
    accent: 'pineapple' as const,
  },
  {
    icon: ShoppingBag,
    title: 'Marketplace',
    description:
      'Find agricultural products, quality farming supplies, organic fertilizers, tools, and local shop listings.',
    to: '/marketplace',
    accent: 'earth' as const,
  },
];

export default function Home() {
  // Hero auto-moving background index
  const [heroIndex, setHeroIndex] = useState(0);

  // Benefits section moving card index
  const [benefitIndex, setBenefitIndex] = useState(0);

  // Gallery slider active index
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);

  // Auto-advance hero background every 6.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % 4);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  // Auto-advance benefits secondary image every 5s
  useEffect(() => {
    const timer = setInterval(() => {
      setBenefitIndex((prev) => (prev + 1) % MANIPUR_PHOTOS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Auto-advance gallery slider every 4.5s unless paused
  useEffect(() => {
    if (isGalleryPaused) return;
    const timer = setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % MANIPUR_PHOTOS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isGalleryPaused]);

  const activeHeroPhoto = MANIPUR_PHOTOS[heroIndex];
  const activeBenefitPhoto = MANIPUR_PHOTOS[benefitIndex];

  return (
    <div className="bg-white">
      {/* Hero with Authentic Moving Background Slideshow */}
      <section className="relative overflow-hidden min-h-[580px] sm:min-h-[640px] flex items-center">
        {/* Moving Background Layers */}
        <div className="absolute inset-0 overflow-hidden">
          {MANIPUR_PHOTOS.slice(0, 4).map((photo, idx) => (
            <div
              key={photo.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                heroIndex === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <img
                src={photo.image1200}
                alt={photo.title}
                className="h-full w-full object-cover animate-kenburns scale-105"
              />
            </div>
          ))}
          {/* Subtle gradient overlays to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-950/70 to-forest-900/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:py-36 w-full">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-pineapple-300 ring-1 ring-white/20 backdrop-blur-md">
              <Leaf className="h-3.5 w-3.5" /> AI for smarter farming in Manipur
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Smart farming, made simple.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-forest-100/90">
              Your companion for smarter farming decisions, crop health monitoring,
              and data-driven agricultural guidance grounded in Manipur's fields.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/disease-detection" size="lg" variant="secondary">
                Explore Loumi <ArrowRight className="h-5 w-5" />
              </LinkButton>
              <LinkButton to="/disease-detection" size="lg" variant="outlineLight">
                <ScanLine className="h-5 w-5" /> Detect a Disease
              </LinkButton>
            </div>
          </div>
        </div>

        {/* Live Photo Info Badge on Hero Bottom Right */}
        <div className="absolute bottom-6 right-6 z-10 hidden sm:flex items-center gap-3 rounded-2xl bg-forest-950/75 backdrop-blur-md border border-white/20 px-4 py-2.5 text-xs text-forest-100 shadow-xl max-w-md">
          <MapPin className="h-4 w-4 text-pineapple-400 shrink-0" />
          <div className="truncate">
            <p className="font-semibold text-white truncate">{activeHeroPhoto.location}</p>
            <p className="text-[11px] text-forest-300 truncate">
              {activeHeroPhoto.title} • {activeHeroPhoto.crop}
            </p>
          </div>
          <div className="ml-2 flex items-center gap-1.5 shrink-0">
            {MANIPUR_PHOTOS.slice(0, 4).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setHeroIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  heroIndex === idx ? 'w-5 bg-pineapple-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`View hero photo ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8" id="features">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-forest-500">
            What Loumi can do
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
            Six tools, one growing companion
          </h2>
          <p className="mt-3 text-base leading-relaxed text-forest-600">
            Each feature is built to plug into your own trained models — the
            interface is ready now, the intelligence connects directly.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.to} {...f} />
          ))}
        </div>
      </section>

      {/* NEW: Authentic Manipur Agriculture Moving Showcase */}
      <section className="border-y border-forest-100 bg-forest-50/50 py-16 overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-forest-600">
                <Sparkles className="h-3.5 w-3.5 text-pineapple-600" /> Authentic Manipur Farm Documentation
              </span>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-forest-900 tracking-tight">
                Real Fields, Real Farmers, Real Crops
              </h2>
              <p className="mt-1.5 text-sm text-forest-600 max-w-2xl">
                Authentic field photography from Nongmaiching Ching (Imphal East), Noney District, and Manipur valley paddies. No fabricated stock visuals.
              </p>
            </div>

            {/* Slider Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setGalleryIndex((prev) => (prev === 0 ? MANIPUR_PHOTOS.length - 1 : prev - 1))
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-forest-200 bg-white text-forest-700 shadow-2xs hover:bg-forest-100 hover:border-forest-300 transition cursor-pointer"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setGalleryIndex((prev) => (prev + 1) % MANIPUR_PHOTOS.length)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-forest-200 bg-white text-forest-700 shadow-2xs hover:bg-forest-100 hover:border-forest-300 transition cursor-pointer"
                aria-label="Next photo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Moving Continuous Photos Marquee (Hover to Pause) */}
        <div
          className="relative w-full overflow-hidden py-2"
          onMouseEnter={() => setIsGalleryPaused(true)}
          onMouseLeave={() => setIsGalleryPaused(false)}
        >
          <div className="animate-marquee flex gap-6 px-4">
            {/* Duplicated list creates an infinite seamless loop */}
            {[...MANIPUR_PHOTOS, ...MANIPUR_PHOTOS].map((photo, index) => (
              <div
                key={`${photo.id}-${index}`}
                className="group relative w-[340px] sm:w-[454px] shrink-0 rounded-2xl border border-forest-100 bg-white shadow-card transition-all duration-300 hover:shadow-cardHover hover:-translate-y-1 overflow-hidden"
              >
                {/* 454 × 303 px exact 3:2 render container with object-fit cover */}
                <div className="relative w-full h-[226px] sm:h-[303px] overflow-hidden bg-forest-900/10">
                  <img
                    src={photo.image1200}
                    alt={photo.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/20 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest-950/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white border border-white/20">
                      <MapPin className="h-3 w-3 text-pineapple-400" />
                      <span>{photo.location}</span>
                    </span>
                    <span className="rounded-full bg-pineapple-400/90 px-2.5 py-1 text-[10px] font-bold text-forest-950 uppercase tracking-wider">
                      {photo.tag}
                    </span>
                  </div>

                  {/* Bottom Text Content */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="font-display text-base sm:text-lg font-bold text-white leading-snug drop-shadow-sm">
                      {photo.title}
                    </h3>
                    <p className="mt-1 text-xs text-forest-200 line-clamp-2 leading-relaxed">
                      {photo.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-forest-300/90 pt-1.5 border-t border-white/10">
                      <span className="inline-flex items-center gap-1 truncate max-w-[280px]">
                        <Camera className="h-3 w-3 shrink-0" />
                        <span className="truncate">{photo.source}</span>
                      </span>
                      <a
                        href={photo.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-0.5 text-pineapple-300 hover:text-pineapple-200 font-medium underline shrink-0"
                      >
                        Source <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gallery Dots */}
        <div className="mx-auto max-w-7xl px-5 sm:px-8 mt-6 flex items-center justify-center gap-2">
          {MANIPUR_PHOTOS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setGalleryIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                galleryIndex === idx ? 'w-6 bg-forest-700' : 'w-2 bg-forest-200 hover:bg-forest-300'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20" id="how-it-works">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-500">
              How it works
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
              Three simple steps
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: ClipboardCheck,
                step: '01',
                title: 'Provide information',
                body: 'Upload a photo, fill in your farm details, or share your location. Forms are simple and optional fields are clearly marked.',
              },
              {
                icon: Cpu,
                step: '02',
                title: 'AI analysis',
                body: 'Your input is sent to the connected backend model for that feature. Loumi handles uploads, JSON, loading states, and errors.',
              },
              {
                icon: TrendingUp,
                step: '03',
                title: 'Receive recommendations',
                body: 'Results render in clean cards — diseases, plans, varieties, or weather risk — with clear next steps you can act on.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="relative rounded-2xl border border-forest-100 bg-white p-6 shadow-card animate-fade-up"
              >
                <span className="font-display text-sm font-bold text-pineapple-600">
                  {s.step}
                </span>
                <span className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest-600 text-white">
                  <s.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-forest-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits with Authentic Moving Photo Frame */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-500">
              Why it matters
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
              Catch disease early. Plan with confidence.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-600">
              Pineapple diseases can spread quickly once symptoms appear. Early
              detection and proactive planning help farmers protect yield, reduce
              avoidable losses, and make better use of land, water, and budget.
            </p>
            <ul className="mt-6 space-y-4">
              {[
                'Spot disease from a photo before it spreads across the field.',
                'Plan planting, irrigation, and harvest around your actual land.',
                'Choose varieties that fit your soil, climate, and elevation.',
                'Anticipate weather-driven disease risk, not just react to it.',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-700">
                    <Leaf className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm leading-relaxed text-forest-700">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <LinkButton to="/farm-planner" size="lg">
                Start planning your farm <ArrowRight className="h-5 w-5" />
              </LinkButton>
            </div>
          </div>

          {/* Authentic Moving Farmer & Field Photo Frame */}
          <div className="relative group">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl shadow-cardHover border border-forest-100 bg-forest-900">
              {MANIPUR_PHOTOS.map((photo, idx) => (
                <div
                  key={photo.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    benefitIndex === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <img
                    src={photo.image1200}
                    alt={photo.title}
                    className="h-full w-full object-cover animate-kenburns scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <div className="flex items-center gap-1.5 text-xs text-pineapple-300 font-medium">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{photo.location}</span>
                    </div>
                    <p className="mt-1 font-display text-base font-semibold text-white drop-shadow">
                      {photo.title}
                    </p>
                    <p className="text-[11px] text-forest-300 truncate">
                      Source: {photo.source}
                    </p>
                  </div>
                </div>
              ))}

              {/* Slider Dots on Frame */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-forest-950/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                {MANIPUR_PHOTOS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBenefitIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      benefitIndex === idx ? 'w-4 bg-pineapple-400' : 'w-1.5 bg-white/40'
                    }`}
                    aria-label={`Show benefit slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Bottom floating badge */}
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-forest-100 bg-white p-5 shadow-card sm:block">
              <p className="font-display text-2xl font-bold text-forest-800">5</p>
              <p className="text-xs font-medium text-forest-600">AI features grounded in Manipur</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-forest-900 py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to put AI to work on your farm?
          </h2>
          <p className="mt-3 text-base text-forest-200">
            Start with any feature — no account needed to explore the interface.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton to="/disease-detection" size="lg" variant="secondary">
              Detect a disease <ArrowRight className="h-5 w-5" />
            </LinkButton>
            <LinkButton to="/chatbot" size="lg" variant="outlineLight">
              Ask the chatbot
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
