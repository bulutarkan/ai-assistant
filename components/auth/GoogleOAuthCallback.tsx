import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createGoogleAuthService } from '../../services/googleAuthService';

const GoogleOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`OAuth Error: ${error}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received');
          return;
        }

        // Exchange code for tokens
        const authService = createGoogleAuthService();
        const tokens = await authService.exchangeCodeForToken(code);

        // Store tokens
        authService.storeTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);

        setStatus('success');
        setMessage('Successfully authenticated with Google!');

        // Redirect back to search console after a short delay
        setTimeout(() => {
          navigate('/'); // Navigate to main app
        }, 2000);

      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-dark-card rounded-lg p-8 border border-dark-border">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Authenticating...</h2>
                <p className="text-text-secondary">Processing Google OAuth callback</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Success!</h2>
                <p className="text-text-secondary">{message}</p>
                <p className="text-sm text-text-tertiary mt-4">Redirecting...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Authentication Failed</h2>
                <p className="text-text-secondary mb-4">{message}</p>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-primary hover:bg-primary-focus text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Return to App
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleOAuthCallback;
