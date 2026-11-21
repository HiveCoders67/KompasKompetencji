import { Component, type ReactNode } from 'react';

/** Keeps a rendering error from blanking the whole app; shows the message and a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="alert alert-error" role="alert">
        <div>
          <p className="font-semibold">Coś poszło nie tak przy wyświetlaniu tego widoku.</p>
          <p className="mono mt-1 text-sm">{this.state.error.message}</p>
          <button className="btn btn-secondary btn-sm mt-s3" onClick={() => (window.location.href = '/')}>
            Wróć do strony głównej
          </button>
        </div>
      </div>
    );
  }
}
