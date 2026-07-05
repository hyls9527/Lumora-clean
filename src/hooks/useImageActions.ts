import { useCallback } from 'react';
import { useImageStore } from '../stores/imageStore';
import * as api from '../lib/api/images';

let _favSeq = 0;
let _ratingSeq = 0;

export function useImageActions() {
  const updateImage = useImageStore((s) => s.updateImage);

  const toggleFavorite = useCallback(
    (id: string) => {
      const seq = ++_favSeq;
      const prev = useImageStore.getState().images.find((img) => img.id === id)?.favorite;
      updateImage(id, (img) => ({ ...img, favorite: !img.favorite }));
      api.toggleFavorite(id).catch((err) => {
        if (seq === _favSeq && prev !== undefined) {
          updateImage(id, (img) => ({ ...img, favorite: prev }));
        }
        console.error('Failed to toggle favorite:', { id, err });
      });
    },
    [updateImage],
  );

  const setRating = useCallback(
    (id: string, rating: number) => {
      const seq = ++_ratingSeq;
      const prev = useImageStore.getState().images.find((img) => img.id === id)?.rating;
      updateImage(id, (img) => ({ ...img, rating }));
      api.updateRating(id, rating).catch((err) => {
        if (prev !== undefined && seq === _ratingSeq) {
          updateImage(id, (img) => ({ ...img, rating: prev }));
          console.error('Failed to set rating:', err);
        }
      });
    },
    [updateImage],
  );

  return { toggleFavorite, setRating };
}
