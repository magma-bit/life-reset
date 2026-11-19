import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  LogOut, 
  ExternalLink, 
  AlertCircle, 
  HelpCircle,
  CreditCard,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';

interface ConfigInfoData {
  isComplete: boolean;
  storeDomainConfigured: boolean;
  storefrontTokenConfigured: boolean;
  variantConfigured: boolean;
  sellingPlanConfigured: boolean;
  sellingPlanId?: string;
  webhookSecretConfigured: boolean;
  webhookDeliveryConfirmed?: boolean;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  adminTokenConfigured: boolean;
  clientCredentialsActive?: boolean;
  directVerificationActive?: boolean;
  verificationMode?: string;
  liveCheckoutEnabled?: boolean;
  lockReason?: string;
  storeDomain: string | null;
  variantId?: string;
  missing: string[];
  webhookUrl?: string;
  webhookTopics?: string[];
  verificationMethod?: string;
  note?: string;
  pricing: {
    introPrice: number;
    recurringPrice: number;
    currency: string;
    firstPeriod: string;
    recurringInterval: string;
  };
  instructions: Array<{ step: number; title: string; detail: string }>;
}

export const SubscriptionView: React.FC = () => {
  const { user, logOut } = useAuth();
  const { 
    status, 
    createCheckout, 
    verifyPayment, 
    refreshStatus, 
    loading: checkingStatus,
    missingShopifyConfig,
    shopifyConfigured
  } = useSubscription();

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configInfo, setConfigInfo] = useState<ConfigInfoData | null>(null);

  // Fetch setup details from server
  useEffect(() => {
    const url = user?.email
      ? `/api/subscription/config-info?email=${encodeURIComponent(user.email)}`
      : '/api/subscription/config-info';
    fetch(url)
      .then(res => res.json())
      .then(data => setConfigInfo(data))
      .catch(err => console.error('Failed to load Shopify config info:', err));
  }, [user?.email]);

  const handleSubscribe = async () => {
    setIsCheckoutLoading(true);
    setNotification(null);
    try {
      const result = await createCheckout();
      if (result.success && result.checkoutUrl) {
        // Redirect to authentic Shopify checkout
        window.location.href = result.checkoutUrl;
      } else {
        // Shopify credentials not configured yet or error
        setNotification({
          type: 'info',
          message: result.message || 'Shopify store credentials are not yet configured on the server. Please view the Setup Guide below.',
        });
        if (result.requiresCredentials) {
          setShowConfigModal(true);
        }
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to initiate checkout.',
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setNotification(null);
    try {
      const result = await verifyPayment();
      if (result.verified && result.hasActiveAccess) {
        setNotification({
          type: 'success',
          message: 'Subscription confirmed! Loading your workspace...',
        });
      } else {
        setNotification({
          type: 'info',
          message: result.message || 'Payment has not been confirmed by Shopify yet. The server cannot grant access until payment is verified by Shopify.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Verification check failed.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check className="w-3.5 h-3.5" /> Active Subscription
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Subscription Cancelled
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Subscription Expired
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
            Pending Payment
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-neutral-800">
      {/* Top Bar */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-950 font-bold flex items-center justify-center text-sm shadow-sm">
              LR
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-neutral-100">Life Reset</span>
              <span className="ml-2 text-xs text-neutral-500 hidden sm:inline">Paid Membership</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-neutral-400 truncate max-w-[200px]">{user?.email}</div>
              <div className="text-[10px] text-neutral-500 font-mono">UID: {user?.uid.slice(0, 8)}...</div>
            </div>

            <button
              onClick={() => logOut()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 border border-neutral-800 transition"
              title="Sign out or switch accounts"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col justify-center">
        {/* Notification Banner */}
        {notification && (
          <div
            className={`mb-8 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === 'error'
                ? 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                : notification.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                : 'bg-neutral-900/80 border-neutral-800 text-neutral-300'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-neutral-400" />
            <div className="flex-1 text-xs sm:text-sm leading-relaxed">{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-neutral-500 hover:text-neutral-300 text-xs px-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            {getStatusBadge()}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-100 leading-tight">
            Unlock your full <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-neutral-300 to-neutral-400">
              Life Reset workspace.
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed max-w-xl mx-auto">
            A private, science-backed sanctuary to conquer task paralysis, organize daily priorities,
            and rebuild momentum one calm step at a time.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-neutral-700/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-neutral-800/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left: Pricing & Value */}
            <div className="md:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                Monthly Membership
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-extrabold text-neutral-100 tracking-tight">$9.99</span>
                  <span className="text-sm sm:text-base font-medium text-neutral-400">USD</span>
                  <span className="text-xs sm:text-sm text-neutral-400 font-medium ml-1">/ month</span>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-neutral-400">
                  Full Life Reset workspace recurring at <strong className="text-neutral-200 font-semibold">$9.99 USD monthly</strong>. 
                  Cancel anytime with zero commitments.
                </p>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-3 pt-2">
                {[
                  'Anti-Procrastination "Break It Down" micro-task generator',
                  'Daily Calm Planner with top 3 focus commitments',
                  'Streak-preserving Habit Tracker & streak history',
                  'Dedicated 1-on-1 Life Reset AI Coach (no fluff, strict focus)',
                  'Weekly reflection blueprint & milestone mapping',
                  'Encrypted multi-device cloud synchronization',
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-neutral-300">
                    <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-neutral-300">
                      <Check className="w-3 h-3" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Checkout CTA Box */}
            <div className="md:col-span-5 flex flex-col justify-center bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-6 sm:p-7 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-4 text-neutral-200">
                <CreditCard className="w-6 h-6" />
              </div>

              <h2 className="text-base font-semibold text-neutral-100">
                Ready to take control?
              </h2>
              <p className="text-xs text-neutral-400 mt-1 mb-6">
                Instant access upon verified payment. All your existing data is preserved.
              </p>

              <button
                onClick={handleSubscribe}
                disabled={isCheckoutLoading}
                className="w-full py-3.5 px-5 rounded-xl bg-neutral-100 text-neutral-950 hover:bg-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isCheckoutLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Checking Storefront...</span>
                  </>
                ) : (
                  <>
                    <span>Subscribe for $9.99 / mo</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              {configInfo && !configInfo.liveCheckoutEnabled && (
                <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-center gap-1.5 text-center">
                  <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span>{configInfo.lockReason || 'Live checkout locked: Awaiting end-to-end verification'}</span>
                </div>
              )}

              {configInfo && configInfo.liveCheckoutEnabled && (
                <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center justify-center gap-1.5 text-center">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Stripe Test Mode Active ({user?.email})</span>
                </div>
              )}

              <div className="mt-3.5 flex items-center justify-center gap-3 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Encrypted via Shopify
                </span>
                <span>•</span>
                <span>Cancel Anytime</span>
              </div>

              {/* Server Verification Action */}
              <div className="mt-6 pt-5 border-t border-neutral-800/80 flex flex-col gap-2">
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || checkingStatus}
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800 transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                  <span>Verify Existing Payment</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Integration & Credentials Status Section */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-neutral-300" />
            <span>
              Server Subscription Foundation:{' '}
              <strong className="text-neutral-200">Active & Enforcing Access</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white underline underline-offset-4 font-medium transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Shopify Credentials & Setup Guide</span>
            </button>
          </div>
        </div>
      </main>

      {/* Configuration & Requirements Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700 mb-2">
                  Shopify Storefront Subscriptions
                </div>
                <h3 className="text-xl font-bold text-neutral-100">
                  Required Shopify Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-neutral-400 hover:text-neutral-100 p-1 rounded-lg hover:bg-neutral-800 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              The application uses Shopify's official Storefront API <code className="text-neutral-200">cartCreate</code> mutation 
              to generate genuine recurring subscription checkouts, and processes webhook events to securely verify access.
            </p>

            {/* Checklist of Variables */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Environment Variables & Authentication Status
              </h4>

              {[
                {
                  key: 'SHOPIFY_STORE_DOMAIN',
                  desc: 'Store domain (wv5cat-vm.myshopify.com)',
                  statusLabel: configInfo?.storeDomainConfigured ? 'Connected' : 'Missing',
                  set: configInfo?.storeDomainConfigured,
                },
                {
                  key: 'DEV DASHBOARD CLIENT CREDENTIALS',
                  desc: 'Installed app authentication (exchanged server-side via OAuth client_credentials grant)',
                  statusLabel: configInfo?.clientCredentialsActive ? 'Verified & Active' : 'Missing',
                  set: configInfo?.clientCredentialsActive,
                },
                {
                  key: 'STOREFRONT API PRIVATE AUTHENTICATION',
                  desc: 'Private token passed securely in Shopify-Storefront-Private-Token header (with unauthenticated_read_selling_plans scope)',
                  statusLabel: configInfo?.storefrontTokenConfigured ? 'Verified & Authorized' : 'Missing',
                  set: configInfo?.storefrontTokenConfigured,
                },
                {
                  key: 'PRODUCT VARIANT ($9.99 USD)',
                  desc: 'Life Reset Premium variant (gid://shopify/ProductVariant/67632091955475)',
                  statusLabel: configInfo?.variantConfigured ? 'Discovered on Store' : 'Missing',
                  set: configInfo?.variantConfigured,
                },
                {
                  key: 'RECURRING SELLING PLAN ($9.99/mo)',
                  desc: 'Verified on store: Deliver every month (gid://shopify/SellingPlan/692445053203)',
                  statusLabel: configInfo?.sellingPlanConfigured ? 'Verified & Saved' : 'Pending',
                  set: configInfo?.sellingPlanConfigured,
                },
                {
                  key: 'DIRECT OUTBOUND VERIFICATION',
                  desc: 'Server-to-server cryptographic contract check via Shopify Admin GraphQL API',
                  statusLabel: configInfo?.directVerificationActive ? 'Verified & Active' : 'Configuring',
                  set: configInfo?.directVerificationActive,
                },
                {
                  key: 'SHOPIFY CONTRACT READ PERMISSION',
                  desc: 'Admin API scope read_own_subscription_contracts & read_orders verified on store',
                  statusLabel: configInfo?.adminTokenConfigured ? 'Authorized' : 'Pending',
                  set: configInfo?.adminTokenConfigured,
                },
              ].map(item => (
                <div
                  key={item.key}
                  className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-neutral-200">{item.key}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                      item.set
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {item.statusLabel}
                  </span>
                </div>
              ))}
            </div>

            {/* Direct Verification Architecture Info */}
            <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 mb-6">
              <div className="text-xs font-semibold text-neutral-200 mb-1">Direct Outbound Server Verification (Option 1)</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">
                This applet directly calls Shopify’s Admin GraphQL API to confirm genuine subscription contract status and ownership.
                No third-party webhook relays, external paid services, or Google Cloud upgrades are needed.
              </p>
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Re-checked automatically on checkout return, user login, and session refresh.</span>
              </div>
            </div>

            {/* Setup Steps */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Active Verification Architecture
              </h4>
              <ol className="space-y-2 text-xs text-neutral-400 list-decimal list-inside">
                <li>User initiates subscription checkout through Shopify hosted checkout for $9.99/mo.</li>
                <li>Shopify redirects customer back to Life Reset upon completion.</li>
                <li>The server cryptographically validates the contract directly against Shopify Admin API (<code className="text-neutral-300">read_own_subscription_contracts</code>).</li>
                <li>Customer identity is confirmed against custom attributes and email before granting access.</li>
                <li>Status is re-validated directly on each login or session refresh to catch cancellations and expirations.</li>
              </ol>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-950 hover:bg-white text-xs font-semibold transition"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
