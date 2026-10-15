import { useCallback, useEffect, useRef, useState } from 'react';
import { EXAMPLE_PLAN, planFromHash, planStore, type Plan } from './plan';

export interface PlanState {
  plan: Plan;
  notice: string | null;
  update: (patch: Partial<Plan> | ((plan: Plan) => Partial<Plan>)) => void;
  reset: () => void;
  dismissNotice: () => void;
}

const LINK_NOTICE = 'That link could not be read, so this is the example plan instead.';

function initial(): { plan: Plan; notice: string | null } {
  const fromLink = planFromHash(window.location.hash);
  if (fromLink === null) {
    return {
      plan: EXAMPLE_PLAN,
      notice: LINK_NOTICE,
    };
  }
  if (fromLink !== 'none') return { plan: fromLink, notice: null };
  const stored = planStore.load();
  return {
    plan: stored.value,
    notice:
      stored.status === 'recovered'
        ? 'Your saved plan could not be read, so this is the example plan instead.'
        : null,
  };
}

export function usePlan(): PlanState {
  const [state, setState] = useState(initial);
  const cleaned = useRef(false);

  // A shared link seeds the plan once; after that the address bar must not
  // pretend to describe edits made since.
  useEffect(() => {
    if (cleaned.current) return;
    cleaned.current = true;
    if (window.location.hash.startsWith('#p=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    planStore.save(state.plan);
  }, [state.plan]);

  const update = useCallback(
    (patch: Partial<Plan> | ((plan: Plan) => Partial<Plan>)) =>
      setState((s) => ({
        ...s,
        plan: { ...s.plan, ...(typeof patch === 'function' ? patch(s.plan) : patch) },
      })),
    [],
  );
  const reset = useCallback(() => setState({ plan: EXAMPLE_PLAN, notice: null }), []);
  const dismissNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  // Pasting a different share link into the same tab only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const fromLink = planFromHash(window.location.hash);
      if (fromLink === 'none') return;
      setState(
        fromLink === null
          ? { plan: EXAMPLE_PLAN, notice: LINK_NOTICE }
          : { plan: fromLink, notice: null },
      );
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return { plan: state.plan, notice: state.notice, update, reset, dismissNotice };
}
