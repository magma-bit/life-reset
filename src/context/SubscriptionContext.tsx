import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { SubscriptionStatus, UserSubscription } from '../types';

interface SubscriptionContextType {
  status: SubscriptionStatus;
  hasActiveAccess: boolean;
  subscription: UserSubscription | null;
  loading: boolean;
  shopifyConfigured: boolean;
  missingShopifyConfig: string[];
  error: string | null;
  refreshStatus: () => Promise<void>;
  createCheckout: () => Promise<{
    success: boolean;
    checkoutUrl?: string;
    message?: string;
    missingKeys?: string[];
    requiresCredentials?: boolean;
  }>;
  verifyPayment: (orderOrContractId?: string) => Promise<{
    verified: boolean;
    status: SubscriptionStatus;
    hasActiveAccess: boolean;
    message: string;
  }>;
  clearError: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('pending');
  const [hasActiveAccess, setHasActiveAccess] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopifyConfigured, setShopifyConfigured] = useState(false);
  const [missingShopifyConfig, setMissingShopifyConfig] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  /**
   * Securely queries the server for the user's authoritative subscription status.
   * Sends the user's cryptographic Firebase ID Token in the Authorization header.
   */
  const refreshStatus = useCallback(async () => {
    if (!user) {
      setStatus('pending');
      setHasActiveAccess(false);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/subscription/status', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      setStatus(data.status || 'pending');
      setHasActiveAccess(Boolean(data.hasActiveAccess));
      setSubscription(data.subscription || null);
      setShopifyConfigured(Boolean(data.shopifyConfigured));
      setMissingShopifyConfig(data.missingShopifyConfig || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching subscription status from server:', err);
      // Default safely to non-active on server check failure
      setStatus('pending');
      setHasActiveAccess(false);
      setError('Unable to verify subscription with server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Request checkout creation from server-side endpoint.
   */
  const createCheckout = async () => {
    if (!user) {
      return { success: false, message: 'You must be signed in to subscribe.' };
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Error initiating checkout:', err);
      return { success: false, message: err.message || 'Failed to initiate checkout.' };
    }
  };

  /**
   * Asks the server to verify with Shopify.
   * Never blindly trusts client URL query parameters.
   */
  const verifyPayment = async (orderOrContractId?: string) => {
    if (!user) {
      return {
        verified: false,
        status: 'pending' as SubscriptionStatus,
        hasActiveAccess: false,
        message: 'User is not signed in.',
      };
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/subscription/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderOrContractId }),
      });

      const data = await res.json();
      console.log('[Shopify Diagnostics: Return Handling] Server verification response:', {
        verified: data.verified,
        status: data.status,
        hasActiveAccess: data.hasActiveAccess,
        message: data.message,
      });
      setStatus(data.status);
      setHasActiveAccess(Boolean(data.hasActiveAccess));
      return data;
    } catch (err: any) {
      console.error('[Shopify Diagnostics: Return Handling] Error verifying payment with server:', err);
      return {
        verified: false,
        status: 'pending' as SubscriptionStatus,
        hasActiveAccess: false,
        message: 'Could not connect to verification server.',
      };
    } finally {
      setLoading(false);
    }
  };

  // Initial check upon user authentication or change
  useEffect(() => {
    if (user) {
      setLoading(true);
      refreshStatus();
    } else {
      setStatus('pending');
      setHasActiveAccess(false);
      setSubscription(null);
      setLoading(false);
    }
  }, [user, refreshStatus]);

  // Inspect URL parameters for checkout returns and trigger server verification
  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const checkoutParam = params.get('checkout');
    const orderIdParam = params.get('order_id') || params.get('orderId');

    if (checkoutParam === 'success' || orderIdParam) {
      console.log('[Shopify Diagnostics: Return Handling] Checkout return detected. Params:', {
        checkout: checkoutParam,
        orderId: orderIdParam || null,
      });

      // Trigger genuine server verification
      verifyPayment(orderIdParam || undefined);

      // Clean URL query parameters to avoid re-triggering
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      url.searchParams.delete('order_id');
      url.searchParams.delete('orderId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{
        status,
        hasActiveAccess,
        subscription,
        loading,
        shopifyConfigured,
        missingShopifyConfig,
        error,
        refreshStatus,
        createCheckout,
        verifyPayment,
        clearError,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
