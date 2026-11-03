"use client";

import { useEffect, useRef, type RefObject } from "react";
import { animate, stagger } from "animejs";

// Re-export so pages can import from this single file
export { animate, stagger };

/* ─── Reusable Hooks ─── */

/**
 * useFadeInUp – fades + slides up an element when it enters the viewport.
 *
 * Usage:
 *   const ref = useFadeInUp<HTMLDivElement>();
 *   return <div ref={ref}>…</div>
 */
export function useFadeInUp<T extends HTMLElement>(
  options?: {
    delay?: number;
    duration?: number;
    translateY?: number;
  }
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial invisible state
    el.style.opacity = "0";
    el.style.transform = `translateY(${options?.translateY ?? 30}px)`;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(el, {
              opacity: [0, 1],
              translateY: [options?.translateY ?? 30, 0],
              duration: options?.duration ?? 800,
              delay: options?.delay ?? 0,
              ease: "outCubic",
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.delay, options?.duration, options?.translateY]);

  return ref;
}

/**
 * useStaggerFadeIn – staggers the fade-in of child elements.
 *
 * Usage:
 *   const containerRef = useStaggerFadeIn<HTMLDivElement>(".card-item");
 *   return <div ref={containerRef}><div className="card-item">…</div></div>
 */
export function useStaggerFadeIn<T extends HTMLElement>(
  childSelector: string,
  options?: {
    delay?: number;
    staggerDelay?: number;
    duration?: number;
  }
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.querySelectorAll(childSelector);
    if (children.length === 0) return;

    // Set initial state
    children.forEach((child) => {
      (child as HTMLElement).style.opacity = "0";
      (child as HTMLElement).style.transform = "translateY(20px)";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(container.querySelectorAll(childSelector), {
              opacity: [0, 1],
              translateY: [20, 0],
              duration: options?.duration ?? 600,
              delay: stagger(options?.staggerDelay ?? 100, {
                start: options?.delay ?? 0,
              }),
              ease: "outCubic",
            });
            observer.unobserve(container);
          }
        });
      },
      { threshold: 0.05 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [childSelector, options?.delay, options?.staggerDelay, options?.duration]);

  return ref;
}

/**
 * useCountUp – animates a number from 0 to `endValue` when the element enters the viewport.
 *
 * Usage:
 *   const ref = useCountUp<HTMLSpanElement>(256);
 *   return <span ref={ref}>0</span>
 */
export function useCountUp<T extends HTMLElement>(
  endValue: number,
  options?: {
    duration?: number;
    suffix?: string;
  }
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const counter = { value: 0 };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(counter, {
              value: endValue,
              round: 1,
              duration: options?.duration ?? 1500,
              ease: "outExpo",
              onUpdate: () => {
                el.textContent = `${counter.value}${options?.suffix ?? ""}`;
              },
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [endValue, options?.duration, options?.suffix]);

  return ref;
}
