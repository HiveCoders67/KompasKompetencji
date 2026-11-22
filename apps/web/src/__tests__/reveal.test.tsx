// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSectionReveal } from '../app/reveal';

/** Minimal IntersectionObserver stand-in: the test decides which elements become visible. */
let observers: FakeIO[] = [];
class FakeIO {
  observed = new Set<Element>();
  constructor(private cb: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  show(els: Element[], isIntersecting = true, top = 100) {
    const entries = els.map((target) => ({ target, isIntersecting, boundingClientRect: { top }, rootBounds: { top: 0 } }) as unknown as IntersectionObserverEntry);
    this.cb(entries, this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  observers = [];
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIO;
});
afterEach(cleanup);

function Page({ extra }: { extra?: boolean }) {
  useSectionReveal();
  return (
    <main>
      <section className="card" data-testid="a">
        <div className="card" data-testid="nested" />
      </section>
      <section className="card" data-testid="b" />
      {extra && <section className="card" data-testid="c" />}
    </main>
  );
}

describe('Section reveal on scroll', () => {
  it('hides cards until they enter the viewport, then reveals them with a stagger', () => {
    const r = render(<Page />);
    const [a, b, nested] = ['a', 'b', 'nested'].map((id) => r.getByTestId(id));
    expect(a.dataset.reveal).toBe('hidden');
    expect(b.dataset.reveal).toBe('hidden');
    expect(nested.dataset.reveal).toBeUndefined(); // moves with its parent card

    act(() => observers[0].show([a, b]));
    expect(a.dataset.reveal).toBe('shown');
    expect(b.dataset.reveal).toBe('shown');
    expect(a.style.getPropertyValue('--sf-reveal-delay')).toContain('* 0');
    expect(b.style.getPropertyValue('--sf-reveal-delay')).toContain('* 1');
  });

  it('animates out when a card leaves the viewport and back in when it returns — from the side it left', () => {
    const r = render(<Page />);
    const a = r.getByTestId('a');
    act(() => observers[0].show([a]));
    act(() => observers[0].show([a], false, -500)); // scrolled past: left through the top
    expect(a.dataset.reveal).toBe('hidden');
    expect(a.dataset.revealFrom).toBe('top');
    expect(observers[0].observed.has(a)).toBe(true); // still watched — in and out every time
    act(() => observers[0].show([a], true, -20));
    expect(a.dataset.reveal).toBe('shown');
  });

  it('does not animate anything inside the evaluation form (data-no-reveal)', () => {
    function Form() {
      useSectionReveal();
      return (
        <main>
          <div data-no-reveal>
            <section className="card" data-testid="form-card" />
          </div>
        </main>
      );
    }
    const r = render(<Form />);
    expect(r.getByTestId('form-card').dataset.reveal).toBeUndefined();
  });

  it('picks up cards that appear later (data loaded, step switched)', async () => {
    const r = render(<Page />);
    r.rerender(<Page extra />);
    await act(async () => undefined); // let the MutationObserver run
    expect(r.getByTestId('c').dataset.reveal).toBe('hidden');
  });
});
