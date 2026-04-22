/**
 * Hook reactivo al ancho del viewport para decidir el layout del editor.
 *
 *   - desktop:  ≥ 1100px — layout clásico de 3 columnas (340px + 1fr + 340px)
 *   - tablet:   900–1099px — centro ensanchado, sidebars colapsables por botón
 *   - mobile:   < 900px   — sidebars escondidas; barra de tabs abajo; panel
 *                            de propiedades como bottom-sheet
 *
 * Usamos `matchMedia` + `addEventListener('change', ...)` que es más barato
 * que un resize listener manual y se actualiza solo cuando cruzamos el
 * breakpoint — no en cada pixel de resize.
 */
import { useEffect, useState } from 'react';

export type Layout = 'desktop' | 'tablet' | 'mobile';

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(() => computeLayout(typeof window !== 'undefined' ? window.innerWidth : 1400));

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 899px)');
    const mqTablet = window.matchMedia('(min-width: 900px) and (max-width: 1099px)');
    const update = () => setLayout(computeLayout(window.innerWidth));
    mqMobile.addEventListener('change', update);
    mqTablet.addEventListener('change', update);
    return () => {
      mqMobile.removeEventListener('change', update);
      mqTablet.removeEventListener('change', update);
    };
  }, []);

  return layout;
}

function computeLayout(width: number): Layout {
  if (width < 900) return 'mobile';
  if (width < 1100) return 'tablet';
  return 'desktop';
}
