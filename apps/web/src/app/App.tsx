/**
 * App shell — renderiza el nuevo editor tipo Canva (`EditorShell`). El legacy
 * sigue disponible bajo `?legacy=1` para comparación visual hasta hito 16.
 */
import { useEffect, useState } from 'react';
import { EditorShell } from '@/features/editor/EditorShell';
import { LegacyCarouselApp } from '../legacy';

export function App() {
  const [showLegacy, setShowLegacy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowLegacy(params.get('legacy') === '1');
  }, []);

  if (showLegacy) return <LegacyCarouselApp />;
  return <EditorShell />;
}
