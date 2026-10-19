'use client';

import {useEffect, useState} from 'react';

/** Expanded video remains in the call; Escape restores the initiating control. */
export function useExpandedMedia<T extends string>() {
  const [expanded, setExpanded] = useState<T | null>(null);
  useEffect(() => {
    if (expanded === null) return;
    const trigger = document.activeElement;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(null);
      }
    };
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('keydown', dismiss);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll: true});
    };
  }, [expanded]);
  return [expanded, setExpanded] as const;
}
