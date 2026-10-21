'use client';

import dynamic from 'next/dynamic';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from '../../app/landing/page.module.css';

const TreeScene = dynamic(() => import('./tree-scene'), { ssr: false });

class TreeBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LandingTree() {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className={styles.treeStage}>
      <img
        className={`${styles.treeFallback} ${ready && !failed ? styles.treeHidden : ''}`}
        src="/images/plants/chrono/mature.png"
        alt="A sculptural Chrono tree with turquoise and violet leaves"
        width={512}
        height={512}
      />
      {visible && !failed && (
        <TreeBoundary onError={() => setFailed(true)}>
          <TreeScene onReady={() => setReady(true)} onUnavailable={() => setFailed(true)} />
        </TreeBoundary>
      )}
      <p className={styles.treeHint}>
        {ready && !failed ? 'Drag to explore your tree' : 'Your effort takes shape'}
      </p>
    </div>
  );
}
