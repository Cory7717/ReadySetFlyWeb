import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

type ActiveFlightSessionScope = {
  scopeId: string;
};

const ActiveFlightSessionScopeContext = createContext<ActiveFlightSessionScope | null>(null);

export function ActiveFlightSessionProvider({ children }: { children: ReactNode }) {
  const scopeIdRef = useRef(`flight-deck-scope-${Date.now().toString(36)}`);
  const value = useMemo(() => ({ scopeId: scopeIdRef.current }), []);
  return (
    <ActiveFlightSessionScopeContext.Provider value={value}>
      {children}
    </ActiveFlightSessionScopeContext.Provider>
  );
}

export function useActiveFlightSessionScope() {
  return useContext(ActiveFlightSessionScopeContext);
}
