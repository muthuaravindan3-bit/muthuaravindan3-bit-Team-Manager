import { Component, type ReactNode } from 'react';

export class WorkspaceBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <section className="ops-surface p-6 space-y-4" role="alert"><h1 className="font-display text-2xl">This workspace could not render</h1><p className="text-sm text-slate-400">Your saved local data is retained. Reload the workspace to recover, or choose another destination.</p><button className="attention-button attention-primary" onClick={() => window.location.reload()}>Reload workspace</button></section>;
    return this.props.children;
  }
}
