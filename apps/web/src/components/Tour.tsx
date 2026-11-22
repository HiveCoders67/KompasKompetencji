import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppUser, Role } from '@kompas/domain';
import { homePath, useSession } from '../app/session';

/*
 * Quick onboarding tour shown once per account (jury demo: supervisor, department head, HR) — on the first visit of its home
 * page; finishing or skipping it is remembered in localStorage, so it does not come back on the next sign-in.
 * Each step points at an element marked with `data-tour="…"` on the role's home page or in the sidebar;
 * a step without a target (or whose target is not on screen) is shown as a centred card.
 * The tour can be skipped at any moment and replayed from the sidebar („Samouczek”).
 */

export interface TourStep {
  /** `data-tour` value of the element to highlight; omitted → centred card. */
  target?: string;
  title: string;
  body: ReactNode;
}

const STORAGE_KEY = (uid: string) => `kompas.tour.v1.${uid}`;

export function tourSeen(uid: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY(uid)) === 'done';
  } catch {
    return false; // storage unavailable — better to show the tour again than never
  }
}
function markTourSeen(uid: string) {
  try {
    localStorage.setItem(STORAGE_KEY(uid), 'done');
  } catch {
    /* storage unavailable — nothing to remember */
  }
}

const firstName = (u: AppUser) => u.displayName.split(' ')[0];

const SUPERVISOR_STEPS = (u: AppUser): TourStep[] => [
  {
    title: `Dzień dobry, ${firstName(u)}!`,
    body: (
      <>
        <p>Kompas Kompetencji prowadzi przełożonego krok po kroku przez <strong>pierwszą ocenę</strong> (nowi pracownicy) i <strong>ocenę okresową</strong>.</p>
        <p className="mt-2">Pokażę w kilku krokach, gdzie co jest. Zajmie to minutę.</p>
      </>
    ),
  },
  {
    target: 'evals-active',
    title: 'Oceny w toku',
    body: (
      <p>
        Każda trwająca ocena z jej statusem i terminami ustawowymi. Termin <em>wkrótce</em> i <em>po terminie</em> są wyróżnione. Kliknij wiersz, aby wrócić do oceny.
      </p>
    ),
  },
  {
    target: 'evals-start',
    title: 'Rozpoczęcie nowej oceny',
    body: <p>Tu rozpoczynasz nową ocenę — lista pracowników, którzy nie mają oceny w toku. System sam dobiera ścieżkę (pierwsza / okresowa) i arkusz na podstawie umowy i opisu stanowiska (OSP).</p>,
  },
  {
    target: 'nav-reminders',
    title: 'Przypomnienia',
    body: <p>Przypomnienia od komórki kadr o terminach ustawowych. Licznik przy pozycji menu pokazuje nieprzeczytane.</p>,
  },
  {
    target: 'nav-assistant',
    title: 'Asystent formalny',
    body: <p>Pytania o przepisy: terminy, nieobecności, dobór arkusza, sprzeciw. Każda odpowiedź ma cytat źródła; gdy baza wiedzy milczy, asystent odmawia zamiast zgadywać.</p>,
  },
];

const HEAD_STEPS = (u: AppUser, alsoSupervisor: boolean): TourStep[] => [
  ...(alsoSupervisor
    ? []
    : [
        {
          title: `Dzień dobry, ${firstName(u)}!`,
          body: (
            <>
              <p>Jako <strong>kierujący komórką organizacyjną</strong> zatwierdzasz pierwsze oceny pracowników swojej komórki — arkusz pierwszej oceny podpisują przełożony i kierujący.</p>
              <p className="mt-2">Krótko pokażę, gdzie to zrobić.</p>
            </>
          ),
        },
      ]),
  {
    target: 'approvals-waiting',
    title: 'Do zatwierdzenia',
    body: <p>Tu trafia pierwsza ocena po rozmowie oceniającej przeprowadzonej przez przełożonego. Otwórz ją, przejrzyj i kliknij „Zatwierdzam pierwszą ocenę” w ostatnim kroku.</p>,
  },
  {
    target: 'approvals-all',
    title: 'Wszystkie pierwsze oceny',
    body: <p>Podgląd postępu i terminów każdej pierwszej oceny w komórce — także tych, które nie dotarły jeszcze do zatwierdzenia.</p>,
  },
  ...(alsoSupervisor
    ? []
    : [
        {
          target: 'nav-assistant',
          title: 'Asystent formalny',
          body: <p>Masz wątpliwość prawną? Zapytaj asystenta — odpowiada wyłącznie na podstawie przepisów i poradników, zawsze z cytatem źródła.</p>,
        },
      ]),
];

const HR_STEPS = (u: AppUser): TourStep[] => [
  {
    title: `Dzień dobry, ${firstName(u)}!`,
    body: (
      <>
        <p>Panel HR służy do pilnowania <strong>terminów i statusów</strong> ocen w całym urzędzie.</p>
        <p className="mt-2">Treści ocen, oceny cząstkowe i wyniki są tu niewidoczne — to celowa minimalizacja danych (RODO).</p>
      </>
    ),
  },
  {
    target: 'hr-tiles',
    title: 'Szybki przegląd',
    body: <p>Kafelki to skróty: kliknięcie filtruje tabelę poniżej (oceny w toku, po terminie, termin w ciągu 14 dni) albo przenosi do listy przypomnień.</p>,
  },
  {
    target: 'hr-table',
    title: 'Procesy ocen',
    body: <p>Wszystkie procesy ocen z terminami ustawowymi. Filtruj po komórce, statusie lub terminie i wyślij przełożonemu przypomnienie jednym kliknięciem.</p>,
  },
  {
    target: 'hr-reminders',
    title: 'Ostatnie przypomnienia',
    body: <p>Historia wysłanych przypomnień: treść, data wysłania i czy przełożony już je przeczytał.</p>,
  },
];

const CLOSING: TourStep = {
  target: 'tour-replay',
  title: 'To wszystko!',
  body: <p>Samouczek możesz uruchomić ponownie w każdej chwili tym przyciskiem. Obok przełączysz jasny / ciemny motyw.</p>,
};

export function stepsForUser(u: AppUser): TourStep[] {
  const has = (r: Role) => u.roles.includes(r);
  const steps: TourStep[] = [];
  if (has('SUPERVISOR')) steps.push(...SUPERVISOR_STEPS(u));
  if (has('DEPARTMENT_HEAD')) steps.push(...HEAD_STEPS(u, has('SUPERVISOR')));
  if (has('HR_ADMIN')) steps.push(...HR_STEPS(u));
  return steps.length ? [...steps, CLOSING] : [];
}

/** The element a step highlights, if it is on the page. */
const findTarget = (step: TourStep) => (step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null);

/**
 * Waits until the page shows the first highlighted element (its data may still be loading), then drops the steps
 * whose element is not on the page (e.g. „Pracownicy bez oceny w toku” when every employee already has an evaluation).
 * Each step is then shown at once, without searching for a missing element.
 */
function whenPageReady(all: TourStep[], cb: (steps: TourStep[]) => void): () => void {
  const first = all.find((s) => s.target);
  const started = Date.now();
  let timer = 0;
  const check = () => {
    if (first && !findTarget(first) && Date.now() - started < 3000) {
      timer = window.setTimeout(check, 100);
      return;
    }
    cb(all.filter((s) => !s.target || findTarget(s)));
  };
  check();
  return () => window.clearTimeout(timer);
}

// ------------------------------------------------------------------ context

const TourCtx = createContext<{ start: () => void }>({ start: () => undefined });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const [steps, setSteps] = useState<TourStep[] | null>(null);

  // signing out closes a running tour
  useEffect(() => {
    if (!user) setSteps(null);
  }, [user]);

  // first visit of an account (not seen in this browser) → start once its home page is shown
  useEffect(() => {
    if (!user || tourSeen(user.uid) || loc.pathname !== homePath(user)) return;
    let cancel = () => undefined as void;
    const t = window.setTimeout(() => {
      cancel = whenPageReady(stepsForUser(user), (ready) => setSteps((cur) => cur ?? ready));
    }, 300);
    return () => {
      window.clearTimeout(t);
      cancel();
    };
  }, [user, loc.pathname]);

  const start = useCallback(() => {
    if (!user) return;
    if (loc.pathname !== homePath(user)) nav(homePath(user));
    whenPageReady(stepsForUser(user), setSteps);
  }, [user, loc.pathname, nav]);

  // finishing or skipping counts as seen
  const finish = useCallback(() => {
    if (user) markTourSeen(user.uid);
    setSteps(null);
  }, [user]);

  return (
    <TourCtx.Provider value={{ start }}>
      {children}
      {steps && steps.length > 0 && <TourOverlay steps={steps} onFinish={finish} />}
    </TourCtx.Provider>
  );
}

// ------------------------------------------------------------------ overlay

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}
/** Space between the target and the spotlight ring: roomy around sections, tight around small controls
 *  (the sidebar items sit 4 px apart — a wider ring would cut into the neighbouring item). */
const padFor = (r: DOMRect) => (r.height < 64 ? 2 : 8);
const CARD_W = 380;
const GAP = 14;


export function TourOverlay({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const restoreFocus = useRef<Element | null>(null);

  useEffect(() => {
    restoreFocus.current = document.activeElement;
    // while the tour runs, sections skip their scroll reveal: a highlighted section must not still be sliding in
    // when the spotlight measures it (that showed as a jump of the spotlight a moment later)
    document.documentElement.dataset.tourActive = 'true';
    return () => {
      delete document.documentElement.dataset.tourActive;
      (restoreFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  // locate (and scroll to) the target; retry while the page is still loading its data
  useEffect(() => {
    setReady(false);
    let tries = 0;
    let timer = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el || !el.isConnected) return setBox(null);
      const r = el.getBoundingClientRect();
      const pad = padFor(r);
      // the ring follows the target's own shape (a pill stays a pill), grown by the padding
      const radius = (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) + pad;
      setBox({ top: r.top - pad, left: r.left - pad, width: r.width + 2 * pad, height: r.height + 2 * pad, radius: Math.min(radius, r.height / 2 + pad) });
    };
    const locate = () => {
      el = findTarget(step);
      if (!el && step.target && tries++ < 3) {
        timer = window.setTimeout(locate, 100);
        return;
      }
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      measure();
      setReady(true);
    };
    locate();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [i, ready, box]);

  useEffect(() => {
    if (ready) card.current?.focus();
  }, [ready, i]);

  const next = () => (last ? onFinish() : setI((x) => x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onFinish();
    } else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Tab') {
      // keep focus inside the tour card
      const f = card.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
      if (!f || !f.length) return;
      const first = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card.current)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // card placement: next to the target (below, above, right, left) with a clear gap, so the card's edges never run along
  // the spotlight's; a target too big for any side (a whole table) gets the card inside it, inset from its corner
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = 16; // viewport margin
  const INSET = 28; // distance from the spotlight's edges when the card sits inside it
  let pos: { top: number; left: number };
  let placement: 'below' | 'above' | 'right' | 'left' | 'inside' | 'center' = 'center';
  if (box) {
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    const clampTop = (t: number) => Math.min(Math.max(M, t), vh - cardH - M);
    const clampLeft = (l: number) => Math.min(Math.max(M, l), vw - CARD_W - M);
    if (bottom + GAP + cardH < vh - M) {
      placement = 'below';
      pos = { top: bottom + GAP, left: clampLeft(box.left) };
    } else if (box.top - GAP - cardH > M) {
      placement = 'above';
      pos = { top: box.top - GAP - cardH, left: clampLeft(box.left) };
    } else if (right + GAP + CARD_W < vw - M) {
      placement = 'right';
      pos = { top: clampTop(box.top), left: right + GAP };
    } else if (box.left - GAP - CARD_W > M) {
      placement = 'left';
      pos = { top: clampTop(box.top), left: box.left - GAP - CARD_W };
    } else {
      placement = 'inside';
      const visibleBottom = Math.min(bottom, vh - M);
      pos = { top: clampTop(visibleBottom - INSET - cardH), left: clampLeft(right - INSET - CARD_W) };
    }
  } else {
    pos = { top: Math.max(M, (vh - cardH) / 2), left: (vw - CARD_W) / 2 };
  }

  return (
    <div className="tour-root" onKeyDown={onKeyDown}>
      {/* click-catcher: the page is not usable while the tour runs */}
      <div className="tour-backdrop" data-spot={!!box} aria-hidden="true" />
      {box && <div className="tour-spotlight" aria-hidden="true" style={{ top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: box.radius }} />}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="tour-card"
        data-placement={placement}
        data-ready={ready}
        style={{ top: pos.top, left: pos.left, width: CARD_W }}
      >
        <div className="flex items-center justify-between gap-s3">
          <p className="tour-count mono">
            {i + 1} / {steps.length}
          </p>
          <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onFinish}>
            Pomiń samouczek
          </button>
        </div>
        <h5 id="tour-title" className="mt-s2">
          {step.title}
        </h5>
        <div id="tour-body" className="tour-body mt-s2">
          {step.body}
        </div>
        <div className="mt-s4 flex items-center justify-between gap-s3">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((_, k) => (
              <span key={k} data-active={k === i} data-done={k < i} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={back}>
                Wstecz
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={next}>
              {i === 0 ? 'Zaczynamy' : last ? 'Zakończ' : 'Dalej'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
