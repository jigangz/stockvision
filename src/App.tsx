import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ff4444', background: '#111', padding: 20, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          <h2>React Crash</h2>
          <p><strong>{this.state.error.message}</strong></p>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}
