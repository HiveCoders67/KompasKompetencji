import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppUser, Role } from '@kompas/domain';
import { homePath, useSession } from '../app/session';

/*
 * Quick onboarding tour shown right after every sign-in (jury demo: supervisor, department head, HR) — not after a page refresh
 * of an already signed-in session.
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
  const { user, loading } = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  // true once the login screen has been shown in this tab: the next user that appears has just signed in
  // (a refresh with a remembered session goes loading → user, without the signed-out state, and shows no tour)
  const signedOut = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      signedOut.current = true;
      setSteps(null); // signing out closes a running tour
    }
    if (user && signedOut.current) {
      signedOut.current = false;
      pending.current = true;
    }
  }, [user, loading]);

  // start as soon as the role's home page is shown after the sign-in
  useEffect(() => {
    if (!user || !pending.current || loc.pathname !== homePath(user)) return;
    // the flag is cleared only when the tour really starts, so a re-render that cancels the timer does not lose it
    let cancel = () => undefined as void;
    const t = window.setTimeout(() => {
      cancel = whenPageReady(stepsForUser(user), (ready) => {
        pending.current = false;
        setSteps(ready);
      });
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

  const finish = useCallback(() => setSteps(null), []);

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
}
const PAD = 8;
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
    return () => (restoreFocus.current as HTMLElement | null)?.focus?.();
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
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD });
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

  // card placement: below the target, else above, else to the right; centred when there is no target
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let pos: { top: number; left: number };
  let placement: 'below' | 'above' | 'right' | 'center' = 'center';
  if (box) {
    const left = Math.min(Math.max(16, box.left), vw - CARD_W - 16);
    if (box.top + box.height + GAP + cardH < vh - 16) {
      placement = 'below';
      pos = { top: box.top + box.height + GAP, left };
    } else if (box.top - GAP - cardH > 16) {
      placement = 'above';
      pos = { top: box.top - GAP - cardH, left };
    } else {
      placement = 'right';
      pos = { top: Math.min(Math.max(16, box.top), vh - cardH - 16), left: Math.min(box.left + box.width + GAP, vw - CARD_W - 16) };
    }
  } else {
    pos = { top: Math.max(16, (vh - cardH) / 2), left: (vw - CARD_W) / 2 };
  }

  return (
    <div className="tour-root" onKeyDown={onKeyDown}>
      {/* click-catcher: the page is not usable while the tour runs */}
      <div className="tour-backdrop" data-spot={!!box} aria-hidden="true" />
      {box && <div className="tour-spotlight" aria-hidden="true" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />}
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
