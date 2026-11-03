import { useEffect, useRef, useState } from 'react';
import { photoFingerprint, repeatedPhotoIndexes } from '../utils/photoSimilarity';

/**
 * Qué fotos de la lista repiten a una anterior (utils/photoSimilarity.ts): `repeatOf[i]` es el índice de la foto que repite la foto i, o null si es distinta.
 * `checking` es true mientras la lista de fotos a la vista todavía no se revisó (el formulario no debe dejar confirmar hasta entonces).
 * Se revisa la lista completa en cada cambio, así que también atrapa las fotos que vuelven de un borrador guardado.
 */
export function usePhotoRepeats(photos: string[]): { repeatOf: (number | null)[]; checking: boolean } {
  const prints = useRef(new Map<string, string | null>());
  const [checked, setChecked] = useState<{ photos: string[]; repeatOf: (number | null)[] }>({ photos: [], repeatOf: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let repeatOf: (number | null)[];
      try {
        const list: (string | null)[] = [];
        for (const photo of photos) {
          if (!prints.current.has(photo)) prints.current.set(photo, await photoFingerprint(photo));
          list.push(prints.current.get(photo) ?? null);
        }
        repeatOf = repeatedPhotoIndexes(list);
      } catch (err) {
        // ante cualquier fallo la revisión deja pasar: el botón de confirmar nunca debe quedar bloqueado por esto (el servidor sigue exigiendo fotos válidas y distintas)
        console.warn('[Fotos] No se pudo revisar si hay fotos repetidas.', err);
        repeatOf = photos.map(() => null);
      }
      if (!cancelled) setChecked({ photos, repeatOf });
    })();
    return () => { cancelled = true; };
  }, [photos]);

  const checking = photos.length > 0 && checked.photos !== photos;
  return { repeatOf: checking ? photos.map(() => null) : checked.repeatOf, checking };
}
