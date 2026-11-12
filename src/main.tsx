import React from 'react';
import ReactDOM from 'react-dom/client';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App';
import { PomodoroProvider } from '@/hooks/usePomodoro';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary name="OpenHub">
      <TooltipPrimitive.Provider skipDelayDuration={250}>
        <PomodoroProvider>
          <App />
        </PomodoroProvider>
      </TooltipPrimitive.Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
