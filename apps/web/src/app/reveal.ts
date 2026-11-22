import { useEffect } from 'react';

/*
 * Section reveal on scroll (STYLE_GUIDE § 7): cards (and anything marked `data-reveal`) inside <main> fade and zoom in
 * when they enter the viewport and fade out again when they leave it — in both scroll directions (an element entering
 * from above slides down, one entering from below slides up). Elements entering together are staggered.
 * Works for content that appears later too (data loaded, step switched) — a MutationObserver picks it up.
 * Nested targets are skipped: a card inside a revealed card moves with its parent.
 * Opt-out: nothing inside `[data-no-reveal]` animates (the evaluation form — a form should just be there).
 */

const SELECTOR = 'main .card, main [data-reveal]';
const STAGGER_CAP = 6;

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useSectionReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || reducedMotion()) return;

    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        for (const e of entries) {
          const el = e.target as HTMLElement;
          // which edge the element is at: it leaves / comes back through the top or the bottom of the screen
          el.dataset.revealFrom = e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'top' : 'bottom';
          if (e.isIntersecting) {
            el.style.setProperty('--sf-reveal-delay', `calc(var(--sf-reveal-stagger) * ${Math.min(i++, STAGGER_CAP)})`);
            el.dataset.reveal = 'shown';
          } else {
            el.style.setProperty('--sf-reveal-delay', '0ms');
            el.dataset.reveal = 'hidden';
          }
        }
      },
      // a thin band at both edges: an element fades out just before it is gone and in as soon as it shows up
      { rootMargin: '-24px 0px -24px 0px' },
    );

    const scan = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.dataset.reveal) return;
        if (el.closest('[data-no-reveal]')) return;
        // nested inside another reveal target → it animates with the parent
        if (el.parentElement?.closest(SELECTOR)) return;
        el.dataset.reveal = 'hidden';
        el.dataset.revealFrom = 'bottom';
        io.observe(el);
      });
    };

    scan(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n.parentElement ?? n));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
