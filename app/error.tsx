// /app/error.tsx
'use client';

import { useEffect } from 'react';
import { Placeholder } from '@/components/placeholder';
import { toast } from 'sonner'; // If you want to toast here too

type ErrorProps = {
  error: Error & { digest?: string }; // Next.js adds digest for production logging
  reset: () => void; // Retry function
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    
    console.error('[error.tsx]: Unhandled render error:', error);
    
    // Optional: Toast if this is a fallback (e.g., for severe errors)
    toast.error('App Error', {
      description: error.message || 'Something went wrong. Retrying...',
      duration: 5000,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Placeholder label={error.message || 'Something went wrong'} />
      <button 
        onClick={reset} 
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try Again
      </button>
    </div>
  );
}