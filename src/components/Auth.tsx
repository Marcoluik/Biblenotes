import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
}

interface AuthError {
  message: string;
  code?: string;
  status?: number;
  details?: string;
}

function parseError(error: any): AuthError {
  const status = error?.status ?? error?.code_challenge ?? undefined;
  const code = error?.code ?? error?.error_code ?? undefined;
  const message = error?.message ?? 'Unknown error';

  if (!navigator.onLine) {
    return { message: 'No internet connection. Check your network and try again.' };
  }
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || status === 0) {
    return {
      message: 'Cannot reach Supabase. The project may be paused or the URL is wrong.',
      details: `Project URL: ${import.meta.env.VITE_SUPABASE_URL}`,
      code,
      status,
    };
  }
  if (message.toLowerCase().includes('invalid login') || message.toLowerCase().includes('invalid credentials')) {
    return { message: 'Incorrect email or password.', code, status };
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return { message: 'Email not confirmed. Check your inbox for a confirmation link.', code, status };
  }
  if (message.toLowerCase().includes('rate limit') || status === 429) {
    return { message: 'Too many attempts. Please wait a minute and try again.', code, status };
  }
  return { message, code, status };
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              email_confirmed: true
            }
          }
        });
        if (signUpError) throw signUpError;

        // Automatically sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error: any) {
      setAuthError(parseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800">Bible Notes</h2>
          <p className="mt-2 text-gray-600">
            {isSignUp ? 'Create an account' : 'Sign in to your account'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          {authError && (
            <div className="p-3 text-sm bg-red-50 border border-red-200 rounded-md space-y-1">
              <p className="font-medium text-red-700">{authError.message}</p>
              {authError.details && (
                <p className="text-red-500 text-xs">{authError.details}</p>
              )}
              {(authError.code || authError.status) && (
                <p className="text-red-400 text-xs font-mono">
                  {[authError.code && `code: ${authError.code}`, authError.status && `status: ${authError.status}`].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}; 