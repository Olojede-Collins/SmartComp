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
  const [dragStartX, setDragStartX] = React.useState<number | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
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

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragStartX(e.clientX);
    setIsPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX === null) return;
    setDragOffset(e.clientX - dragStartX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX !== null) {
      const delta = e.clientX - dragStartX;
      if (delta < -50) {
        handleNext();
      } else if (delta > 50) {
        handlePrev();
      }
    }
    setDragStartX(null);
    setDragOffset(0);
    setIsPaused(false);
  };

  return (
    <section
      className="hero relative overflow-hidden rounded-2xl border border-white/10 mb-8 bg-neutral-900 text-white select-none touch-pan-y"
      aria-roledescription="carousel"
      aria-label="Smart Classroom Hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className={[
            'flex h-full w-full',
            dragStartX !== null
              ? 'transition-none'
              : 'transition-transform ease-standard',
          ].join(' ')}
          style={{
            transform:
              dragOffset !== 0
                ? `translateX(calc(-${currentIndex} * 100% + ${dragOffset}px))`
                : `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {HERO_SLIDES.map((slide) => (
            <div
              key={slide.image}
              className="relative h-full w-full flex-[0_0_100%] min-w-full"
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="h-full w-full object-cover object-center"
              />
            </div>
          ))}
        </div>
        <div
          className="absolute inset-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-black/30"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-30 px-6 py-10 md:px-10 md:py-14 flex flex-col justify-between min-h-[420px] md:min-h-[460px] pointer-events-auto">
        <div className="max-w-[var(--layout-measure)]">
          <p className="text-caption font-semibold tracking-caps text-emerald-300 font-mono mb-3">
            DEPARTMENT OF COMPUTER ENGINEERING · FACULTY OF ENGINEERING
          </p>

          <h1 className="text-h1 tracking-h1 mb-4 font-serif text-white font-bold leading-tight drop-shadow-sm">
            The smart class, on the record.
          </h1>

          <p className="text-body-lg text-slate-200 mb-6 text-base md:text-lg leading-relaxed">
            A digital register and interactive laboratory archive for the smart
            classroom in the Computer Engineering Department, Faculty of
            Engineering, Ahmadu Bello University. Maintained directly by the lab
            team for accreditation, research, and technical operations.
          </p>

          <div className="hero__actions flex flex-wrap items-center gap-3">
            <Link
              href="/room"
              className="btn btn--primary inline-flex items-center justify-center min-h-12 px-6 rounded-lg bg-bg-action text-fg-on-action font-semibold text-base no-underline hover:bg-bg-action-hover active:scale-[0.98] transition-transform focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Browse the collection
            </Link>
            <a
              href="#register-title"
              className="inline-flex items-center justify-center min-h-12 px-5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-medium text-sm border border-white/20 transition-transform focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                    'h-2 rounded-full transition-all active:scale-95',
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
