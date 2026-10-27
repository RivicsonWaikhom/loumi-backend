import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home as HomeIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('loumi_smart_farm_planner_farms');
      localStorage.removeItem('loumi_smart_farms');
    } catch (e) {
      console.error(e);
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-red-950">
              {this.props.fallbackTitle || 'Something went wrong on this page'}
            </h2>
            <p className="mt-2 text-xs text-red-800">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Storage & Reload</span>
              </button>
              <Link
                to="/"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-50"
              >
                <HomeIcon className="h-3.5 w-3.5" />
                <span>Go to Home</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
