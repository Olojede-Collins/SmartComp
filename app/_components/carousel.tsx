'use client';

import * as React from 'react';
import { Icon } from './icon';
import { RegisterRow, RegisterRowProps } from './register-row';
import {
  rubberband,
  project,
  PointerVelocityTracker,
  DECELERATION_RATE,
} from '../../lib/fluid-physics';

export const AUTO_ADVANCE_INTERVAL = 6000;

export interface CarouselProps {
  items?: (RegisterRowProps | React.ReactNode)[];
  slides?: (RegisterRowProps | React.ReactNode)[];
  children?: React.ReactNode;
  className?: string;
  loading?: boolean;
  'aria-label'?: string;
  id?: string;
  initialIndex?: number;
}

function getReducedMotionPreference(): boolean {
  if (typeof window === 'undefined') return false;
  const mq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const docState =
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-state')
      : null;
  return Boolean(mq?.matches || docState === 'reduced-motion');
}

function renderSlideItem(
  item: RegisterRowProps | React.ReactNode,
  idx: number,
  totalSlides: number,
  loading: boolean,
) {
  const slideAttrs = {
    key: idx,
    className: 'carousel__slide flex-[0_0_100%] min-w-0',
    role: 'group' as const,
    'aria-roledescription': 'slide',
    'aria-label': `Slide ${idx + 1} of ${totalSlides}`,
  };

  if (loading) {
    const row =
      typeof item === 'object' &&
      item !== null &&
      'href' in item &&
      'name' in item
        ? RegisterRow({ ...(item as RegisterRowProps), loading: true })
        : RegisterRow({ href: '', name: '', loading: true });

    if (
      React.isValidElement<React.HTMLAttributes<HTMLLIElement>>(row) &&
      row.type === 'li'
    ) {
      return React.cloneElement(row, {
        ...slideAttrs,
        className: [slideAttrs.className, row.props.className]
          .filter(Boolean)
          .join(' '),
      });
    }

    return <li {...slideAttrs}>{row}</li>;
  }

  if (React.isValidElement(item)) {
    if (item.type === RegisterRow) {
      const row = RegisterRow(item.props as RegisterRowProps);
      if (
        React.isValidElement<React.HTMLAttributes<HTMLLIElement>>(row) &&
        row.type === 'li'
      ) {
        return React.cloneElement(row, {
          ...slideAttrs,
          className: [slideAttrs.className, row.props.className]
            .filter(Boolean)
            .join(' '),
        });
      }
    }
    if (item.type === 'li') {
      return React.cloneElement(
        item as React.ReactElement<React.HTMLAttributes<HTMLLIElement>>,
        {
          ...slideAttrs,
          className: [
            slideAttrs.className,
            (item.props as React.HTMLAttributes<HTMLLIElement>).className,
          ]
            .filter(Boolean)
            .join(' '),
        },
      );
    }
    return <li {...slideAttrs}>{item}</li>;
  }

  if (
    typeof item === 'object' &&
    item !== null &&
    'href' in item &&
    'name' in item
  ) {
    const row = RegisterRow(item as RegisterRowProps);
    if (
      React.isValidElement<React.HTMLAttributes<HTMLLIElement>>(row) &&
      row.type === 'li'
    ) {
      return React.cloneElement(row, {
        ...slideAttrs,
        className: [slideAttrs.className, row.props.className]
          .filter(Boolean)
          .join(' '),
      });
    }
    return <li {...slideAttrs}>{row}</li>;
  }

  return <li {...slideAttrs}>{String(item)}</li>;
}

const BTN_BASE =
  'icon-btn size-11 inline-flex items-center justify-center rounded-md border border-border-strong ' +
  'bg-bg-surface text-fg-default hover:bg-bg-action-subtle hover:text-fg-link-hover ' +
  'active:scale-95 ' +
  'disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-border-disabled disabled:cursor-not-allowed ' +
  'cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

export function Carousel({
  items,
  slides,
  children,
  className,
  loading = false,
  'aria-label': ariaLabel,
  id,
  initialIndex = 0,
}: CarouselProps) {
  const slideList = React.useMemo(() => {
    if (items && items.length > 0) return items;
    if (slides && slides.length > 0) return slides;
    if (children) return React.Children.toArray(children);
    if (items) return items;
    if (slides) return slides;
    return [];
  }, [items, slides, children]);

  const totalSlides = slideList.length;
  const [index, setIndex] = React.useState(initialIndex);
  const [userInteracted, setUserInteracted] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isReducedMotion, setIsReducedMotion] = React.useState(() =>
    getReducedMotionPreference(),
  );
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const pointerTracker = React.useRef(new PointerVelocityTracker());
  const dragStartX = React.useRef(0);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateMotion = () => {
      setIsReducedMotion(getReducedMotionPreference());
    };

    updateMotion();

    const mq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    if (mq?.addEventListener) {
      mq.addEventListener('change', updateMotion);
    }

    let observer: MutationObserver | null = null;
    if (
      typeof MutationObserver !== 'undefined' &&
      typeof document !== 'undefined'
    ) {
      observer = new MutationObserver(() => {
        updateMotion();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-state'],
      });
    }

    return () => {
      if (mq?.removeEventListener) {
        mq.removeEventListener('change', updateMotion);
      }
      observer?.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (
      userInteracted ||
      isHovered ||
      isFocused ||
      isReducedMotion ||
      getReducedMotionPreference() ||
      totalSlides < 2 ||
      loading
    ) {
      return;
    }

    if (index >= totalSlides - 1) {
      return;
    }

    const timer = setInterval(() => {
      setIndex((prev) => {
        if (prev >= totalSlides - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, AUTO_ADVANCE_INTERVAL);

    return () => {
      clearInterval(timer);
    };
  }, [
    index,
    userInteracted,
    isHovered,
    isFocused,
    isReducedMotion,
    totalSlides,
    loading,
  ]);

  const handlePrev = React.useCallback(() => {
    setUserInteracted(true);
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = React.useCallback(() => {
    setUserInteracted(true);
    setIndex((prev) => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (index > 0 && !loading && totalSlides > 1) {
          handlePrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (index < totalSlides - 1 && !loading && totalSlides > 1) {
          handleNext();
        }
      }
    },
    [index, loading, totalSlides, handlePrev, handleNext],
  );

  const handleMouseEnter = React.useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setIsFocused(false);
      }
    },
    [],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (totalSlides <= 1 || loading) return;
      dragStartX.current = e.clientX;
      pointerTracker.current.reset();
      pointerTracker.current.addPoint(e.clientX, e.clientY);
      setIsDragging(true);
      setUserInteracted(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [totalSlides, loading],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      pointerTracker.current.addPoint(e.clientX, e.clientY);
      const deltaX = e.clientX - dragStartX.current;
      const viewportWidth = viewportRef.current?.clientWidth || 400;

      if (
        (index === 0 && deltaX > 0) ||
        (index === totalSlides - 1 && deltaX < 0)
      ) {
        setDragOffset(rubberband(deltaX, viewportWidth));
      } else {
        setDragOffset(deltaX);
      }
    },
    [isDragging, index, totalSlides],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      const { vx } = pointerTracker.current.getVelocity();
      const projected = project(vx, DECELERATION_RATE);
      const effectiveDelta = dragOffset + projected;
      const threshold = 60;

      if (effectiveDelta < -threshold && index < totalSlides - 1) {
        setIndex((prev) => Math.min(totalSlides - 1, prev + 1));
      } else if (effectiveDelta > threshold && index > 0) {
        setIndex((prev) => Math.max(0, prev - 1));
      }
      setDragOffset(0);
    },
    [isDragging, dragOffset, index, totalSlides],
  );

  const prevDisabled = loading || index === 0 || totalSlides <= 1;
  const nextDisabled = loading || index >= totalSlides - 1 || totalSlides <= 1;

  const trackClasses = [
    'carousel__track flex gap-6 list-none m-0 p-0',
    isReducedMotion || isDragging
      ? 'transition-none'
      : 'transition-transform ease-standard',
  ]
    .filter(Boolean)
    .join(' ');

  const countText =
    totalSlides === 0 ? '0 / 0' : `${index + 1} / ${totalSlides}`;

  const liveMode = userInteracted || isHovered || isFocused ? 'polite' : 'off';

  return (
    <div
      id={id}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel ?? 'Featured items'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={['carousel relative', className].filter(Boolean).join(' ')}
    >
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="carousel__viewport overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        <ul
          className={trackClasses}
          style={{
            transform:
              dragOffset !== 0
                ? `translateX(calc(-${index} * (100% + var(--space-6)) + ${dragOffset}px))`
                : `translateX(calc(-${index} * (100% + var(--space-6))))`,
          }}
        >
          {slideList.map((item, idx) =>
            renderSlideItem(item, idx, totalSlides, loading),
          )}
        </ul>
      </div>
      <div className="carousel__controls flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={prevDisabled}
          aria-label="Previous slide"
          className={BTN_BASE}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          aria-label="Next slide"
          className={BTN_BASE}
        >
          <Icon name="chevron-right" />
        </button>
        <p
          className="carousel__count text-micro text-fg-muted font-mono ml-2"
          aria-live={liveMode}
        >
          {countText}
        </p>
      </div>
    </div>
  );
}
