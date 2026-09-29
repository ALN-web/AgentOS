import React from 'react';
import { clearMissions } from '../store/persistence';

// Last line of defence: a render error shows a way back instead of a blank page.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('AgentOS crashed while rendering', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#eb6920] mb-2">Something went wrong</div>
          <h1 className="text-xl font-bold text-white mb-2">This view hit an unexpected error</h1>
          <p className="text-sm text-gray-400 mb-6">Your demo can continue. Reload to try again, or start from a clean demo.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => window.location.reload()} className="btn-orange px-5 py-2.5 rounded-xl text-sm font-semibold">
              Reload
            </button>
            <button
              onClick={() => {
                clearMissions();
                window.location.assign('/app');
              }}
              className="btn-dark px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              Start a clean demo
            </button>
          </div>
        </div>
      </div>
    );
  }
}
