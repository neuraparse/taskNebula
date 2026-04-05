'use client';

import { useEffect } from 'react';

export function AppUiScope() {
  useEffect(() => {
    document.body.classList.add('app-square-ui');

    return () => {
      document.body.classList.remove('app-square-ui');
    };
  }, []);

  return null;
}
