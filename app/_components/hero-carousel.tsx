'use client';

import * as React from 'react';
import Link from 'next/link';
import { Icon } from './icon';

interface HeroSlide {
  image: string;
  alt: string;
  caption: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    image: '/images/hero/smart-class-lab-1.jpg',
    alt: 'Smart Classroom & Computer Engineering Laboratory at Ahmadu Bello University',
    caption: 'Smart Classroom & Engineering Lab',
  },
  {
    image: '/images/hero/smart-class-lab-2.jpg',
    alt: 'Interactive Digital Lectern and Smart Classroom Workstations at ABU Zaria',
    caption: 'Interactive Smart Workstations',
  },
  {
    image: '/images/hero/abu-monument.jpg',
    alt: 'Ahmadu Bello University Main Entrance Monument',
    caption: 'Ahmadu Bello University, Zaria',
  },
];

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const total = HERO_SLIDES.length;

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = React.useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (media?.matches || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(handleNext, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, handleNext]);

  return (
    <section
      className="hero relative overflow-hidden rounded-2xl border border-border-rule shadow-card mb-8 bg-neutral-900 text-white"
      aria-roledescription="carousel"
      aria-label="Smart Classroom Hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="absolute inset-0 z-0">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.image}
            className={[
              'absolute inset-0 transition-opacity duration-1000 ease-in-out',
              idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0',
            ].join(' ')}
            aria-hidden={idx !== currentIndex}
          >
            <img
              src={slide.image}
              alt={slide.alt}
              className="h-full w-full object-cover object-center"
            />
          </div>
        ))}
        <div
          className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-black/40 backdrop-blur-[0.5px]"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-30 px-6 py-10 md:px-10 md:py-14 flex flex-col justify-between min-h-[420px] md:min-h-[460px]">
        <div className="max-w-[var(--layout-measure)]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green-800/80 border border-brand-green-500/40 text-xs md:text-sm font-medium text-emerald-100 mb-4 shadow-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Department of Computer Engineering · Faculty of Engineering
            </span>
          </div>

          <h1 className="text-h1 tracking-h1 mb-4 font-serif text-white font-bold leading-tight drop-shadow-sm">
            The smart class, on the record.
          </h1>

          <p className="text-body-lg text-slate-200 mb-6 text-base md:text-lg leading-relaxed">
            A register of every item in the smart classroom in the Computer
            Engineering Department, Faculty of Engineering, Ahmadu Bello
            University — what it does, how many there are, and what state it is
            in. Kept by the lab team, in their own words.
          </p>

          <div className="hero__actions flex flex-wrap items-center gap-3">
            <Link
              href="/room"
              className="btn btn--primary inline-flex items-center justify-center min-h-12 px-6 rounded-lg bg-bg-action text-fg-on-action font-semibold text-base no-underline hover:bg-bg-action-hover active:scale-[0.98] shadow-raised transition-all focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Browse the collection
            </Link>
            <a
              href="#register-title"
              className="inline-flex items-center justify-center min-h-12 px-5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-medium text-sm border border-white/20 backdrop-blur-md transition-all focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View register entries ↓
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 mt-6 border-t border-white/15">
          <div className="text-caption text-white/80 font-medium">
            <span>{HERO_SLIDES[currentIndex]?.caption}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {HERO_SLIDES.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setCurrentIndex(dotIdx)}
                  className={[
                    'h-2 rounded-full transition-all duration-300',
                    dotIdx === currentIndex
                      ? 'w-6 bg-emerald-400'
                      : 'w-2 bg-white/40 hover:bg-white/60',
                  ].join(' ')}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous slide"
                className="w-9 h-9 min-h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all focus-visible:outline-2 focus-visible:outline-white"
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next slide"
                className="w-9 h-9 min-h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all focus-visible:outline-2 focus-visible:outline-white"
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
