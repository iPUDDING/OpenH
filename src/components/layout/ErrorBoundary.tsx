import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode; name: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[OpenHub:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-soft">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="font-semibold">No se pudo mostrar {this.props.name}</h2>
          <p className="mt-2 break-words text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button className="mt-4" variant="outline" onClick={() => this.setState({ error: null })}><RotateCcw className="h-4 w-4" />Reintentar</Button>
        </div>
      </div>
    );
  }
}
