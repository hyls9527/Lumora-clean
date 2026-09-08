import { useCallback } from 'react';
import { useImageStore } from '../stores/imageStore';
import * as api from '../lib/api/images';

// Per-image sequence numbers: a failed optimistic update must roll back even
// when a newer optimistic update was issued for a *different* image. A single
// global counter would let image B's operation invalidate image A's rollback.
const _favSeq = new Map<string, number>();
const _ratingSeq = new Map<string, number>();

export function useImageActions() {
  const updateImage = useImageStore((s) => s.updateImage);

  const toggleFavorite = useCallback(
    (id: string) => {
      const seq = (_favSeq.get(id) ?? 0) + 1;
      _favSeq.set(id, seq);
      const prev = useImageStore.getState().images.find((img) => img.id === id)?.favorite;
      updateImage(id, (img) => ({ ...img, favorite: !img.favorite }));
      api.toggleFavorite(id).then(
        () => {
          // Clean up the per-image seq entry on success too — an all-succeed
          // session must not leak map entries either (F-23).
          if (seq === _favSeq.get(id)) _favSeq.delete(id);
        },
        (err) => {
          if (seq === _favSeq.get(id) && prev !== undefined) {
            updateImage(id, (img) => ({ ...img, favorite: prev }));
          }
          console.error('Failed to toggle favorite:', { id, err });
          // Clean up the per-image seq entry once this is the newest settled
          // operation, so the map cannot grow unbounded (F-23).
          if (seq === _favSeq.get(id)) _favSeq.delete(id);
        },
      );
    },
    [updateImage],
  );

  const setRating = useCallback(
    (id: string, rating: number) => {
      const seq = (_ratingSeq.get(id) ?? 0) + 1;
      _ratingSeq.set(id, seq);
      const prev = useImageStore.getState().images.find((img) => img.id === id)?.rating;
      updateImage(id, (img) => ({ ...img, rating }));
      api.updateRating(id, rating).then(
        () => {
          if (seq === _ratingSeq.get(id)) _ratingSeq.delete(id);
        },
        (err) => {
          if (prev !== undefined && seq === _ratingSeq.get(id)) {
            updateImage(id, (img) => ({ ...img, rating: prev }));
            console.error('Failed to set rating:', err);
          }
          // Clean up the per-image seq entry (F-23).
          if (seq === _ratingSeq.get(id)) _ratingSeq.delete(id);
        },
      );
    },
    [updateImage],
  );

  return { toggleFavorite, setRating };
}
