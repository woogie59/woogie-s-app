import React from 'react';

/**
 * Reusable Skeleton component for loading states.
 * Uses subtle pulse animation (opacity 0.5 to 1) for premium feel.
 */
const Skeleton = ({ className = '' }) => (
  <div
    className={`bg-zinc-800/50 rounded-md animate-skeleton-pulse ${className}`}
  />
);

export default Skeleton;
