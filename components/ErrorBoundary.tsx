// /components/ErrorBoundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Placeholder } from '@/components/placeholder';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Caught in boundary:', error, errorInfo);
    // Optional: Toast here
    toast.error('Component Error', {
      description: error.message || 'Something went wrong in this section.',
      duration: 3000,
    });
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || <Placeholder label={this.state.error?.message || 'Component failed'} />;
    }
    return this.props.children;
  }
}

export { ErrorBoundary };