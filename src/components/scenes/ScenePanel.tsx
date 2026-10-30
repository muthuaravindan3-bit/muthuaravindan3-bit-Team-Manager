import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SceneProps } from './sceneTypes';
const SceneCanvas = lazy(() => import('./SceneCanvas'));
let webglAvailable: boolean | undefined;
function supportsWebGL() {
  if (webglAvailable !== undefined) return webglAvailable;
  try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }); webglAvailable = Boolean(gl); gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
  catch { webglAvailable = false; }
  return webglAvailable;
}
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function StaticScene({ kind, nodes = [] }: SceneProps) {
  return <div className={`scene-static scene-static-${kind}`} data-scene-static="true" aria-hidden="true">{kind === 'check' ? <span className="scene-static-check">✓</span> : kind === 'calendar' ? <div className="scene-static-calendar">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div> : kind === 'orb' ? <div className="scene-static-orb" /> : <div className="scene-static-network">{Array.from({ length: kind === 'hub' ? nodes.length : 6 }, (_, index) => <i key={index} />)}</div>}</div>;
}
/** Decorative canvas isolated from accessible app controls, with viewport and motion guards. */
export function ScenePanel({ title, description, compact = false, ...props }: SceneProps & { title: string; description: string; compact?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [available, setAvailable] = useState(false);
  const [failed, setFailed] = useState(false);
  const [occluded, setOccluded] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = root.current;
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); };
    element?.addEventListener('webglcontextlost', lost, true);
    return () => element?.removeEventListener('webglcontextlost', lost, true);
  }, []);
  useEffect(() => {
    const update = () => { const modals = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-scope="modal"]')).filter((modal) => modal.getClientRects().length > 0); const top = modals.at(-1); setOccluded(Boolean(top && root.current && !top.contains(root.current))); };
    const observer = new MutationObserver(update); observer.observe(document.body, { childList: true, subtree: true }); update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden');
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    if (root.current) observer.observe(root.current);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (visible && !reduced && !paused) setAvailable(supportsWebGL()); }, [visible, reduced, paused]);
  const active = visible && pageVisible && !reduced && available && !failed && !paused && !occluded;
  const fallback = <StaticScene {...props} />;
  return <section ref={root} className={`scene-panel ${compact ? 'scene-panel-compact' : ''}`} aria-label={title} data-scene-kind={props.kind} data-scene-active={active} data-scene-state={props.state ?? (props.selectedId ? 'selected' : 'idle')}>
    <div className="scene-html"><div><h2>{title}</h2><p>{description}</p>{reduced && <p className="scene-mode-note">Static preview: reduced motion is enabled on this device.</p>}{failed && <p className="scene-mode-note">Static preview: the 3D connection was interrupted.</p>}</div>{!reduced && <button type="button" className="btn-ghost" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? 'Play animation' : 'Pause animation'}</button>}</div>
    <div className="scene-stage" aria-hidden="true">{active ? <SceneBoundary fallback={fallback}><Suspense fallback={fallback}><SceneCanvas {...props} /></Suspense></SceneBoundary> : fallback}</div>
  </section>;
}
