/**
 * Standalone mount of the production VirtualGrid with 10K synthetic items,
 * used by perf-scroll.spec.ts to measure TC-PERF-002 frame budget locally.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { VirtualGrid } from '/src/components/ui/VirtualGrid';

const COUNT = 10_000;
const items = Array.from({ length: COUNT }, (_, i) => ({
  id: `img-${i}`,
  label: `图片 ${i}`,
}));

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#1b1b1b' }}>
      <VirtualGrid
        items={items}
        columnCount={4}
        rowHeight={220}
        gap={12}
        renderItem={(item) => (
          <div
            style={{
              height: 220,
              background: '#2a2a2a',
              color: '#e8e2d5',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'sans-serif',
            }}
          >
            {item.label}
          </div>
        )}
      />
    </div>,
  );
}
