'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type DashboardHeading = {
  date: string;
  greeting: string;
  message: string;
  mobileCard?: ReactNode;
};

type DashboardHeadingContextValue = {
  heading: DashboardHeading | null;
  setHeading: (heading: DashboardHeading | null) => void;
  actionsTarget: HTMLDivElement | null;
  setActionsTarget: (target: HTMLDivElement | null) => void;
};

const DashboardHeadingContext = createContext<DashboardHeadingContextValue | null>(null);

export function DashboardHeadingProvider({ children }: { children: ReactNode }) {
  const [heading, setHeading] = useState<DashboardHeading | null>(null);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);

  return (
    <DashboardHeadingContext.Provider
      value={{ heading, setHeading, actionsTarget, setActionsTarget }}
    >
      {children}
    </DashboardHeadingContext.Provider>
  );
}

export function useDashboardHeading() {
  const context = useContext(DashboardHeadingContext);
  if (!context) throw new Error('DashboardHeadingProvider is missing.');
  return context;
}
