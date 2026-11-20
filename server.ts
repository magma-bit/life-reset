import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { subscriptionStore } from './server/subscriptionStore.js';
import { ShopifyService } from './server/shopifyService.js';
import { SubscriptionStatus } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Capture raw body for Shopify Webhook HMAC verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Fallback: capture raw body for webhook endpoint if Content-Type is non-json or omitted
app.use(
  express.raw({
    type: (req) => {
      const url = req.url || '';
      return url.startsWith('/api/webhooks');
    },
    verify: (req: any, _res, buf) => {
      if (!req.rawBody) {
        req.rawBody = buf;
      }
    },
  })
);

// Load Firebase configuration for server-side token authentication
let firebaseApiKey = '';
try {
  const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    firebaseApiKey = firebaseConfig.apiKey || '';
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json for apiKey:', err);
}

interface AuthenticatedUser {
  uid: string;
  email: string;
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      rawBody?: Buffer;
      token?: string;
    }
  }
}

/**
 * Server-side Authentication Middleware
 * Cryptographically validates the Firebase ID Token via Google Identity Toolkit API.
 * Guarantees that user identity cannot be forged or manipulated by the browser.
 */
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  if (!firebaseApiKey) {
    return res.status(500).json({ error: 'Firebase API configuration missing on server' });
  }

  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!lookupRes.ok) {
      const errBody = await lookupRes.json().catch(() => ({}));
      return res.status(401).json({ error: 'Invalid or expired authentication token', details: errBody });
    }

    const data = await lookupRes.json();
    if (!data.users || data.users.length === 0) {
      return res.status(401).json({ error: 'User account not found for this token' });
    }

    const fbUser = data.users[0];
    req.user = {
      uid: fbUser.localId,
      email: fbUser.email || '',
    };
    req.token = token;

    next();
  } catch (err: any) {
    console.error('Server error validating auth token:', err);
    return res.status(500).json({ error: 'Internal error verifying authentication token' });
  }
}

// Initialize GoogleGenAI SDK on server side with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Multi-turn chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-3.5-flash', systemInstruction } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.text }],
    }));

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction:
          systemInstruction ||
          `You are the "Life Reset Assistant". You are dedicated exclusively to helping the user with their personal life reset:
- Organizing daily tasks and life priorities
- Overcoming procrastination and task paralysis
- Breaking down overwhelming projects into microscopic, friction-free steps
- Establishing and sticking to daily habits and routines
- Defining milestones for long-term goals
- Planning their week and reflecting on progress
- Finding mental clarity and reducing overwhelm

STRICT BOUNDARY: If the user asks about anything unrelated to resetting and organizing their life, habits, tasks, focus, or routines (e.g., general trivia, entertainment, coding unrelated to their habits/goals, politics, homework, etc.), politely decline and gently guide them back to what matters today in their Life Reset journey. Keep your tone calm, empathetic, minimal, and focused on immediate action.`,
      },
    });

    const reply = response.text || "I'm here with you. What is one tiny thing we can look at together?";
    return res.json({ text: reply });
  } catch (err: any) {
    console.error('Error generating AI chat response:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to generate response. Please check your connection or API key.',
    });
  }
});

// ==============================================================================
// SUBSCRIPTION & SHOPIFY ACCESS-CONTROL SYSTEM (SERVER-AUTHORITATIVE)
// ==============================================================================

/**
 * GET /api/subscription/status
 * Evaluates the subscription status on the server.
 * Never trusts any status passed from the client browser.
 */
/**
 * GET /api/subscription/status
 * Evaluates the subscription status on the server using direct outbound verification with Shopify.
 * Requirement 2: Never trusts any status passed from the client browser.
 * Requirement 3: Confirms ownership with Shopify before granting access.
 * Requirement 4: Re-checks with Shopify when user queries status / logs in.
 * Requirement 5: Handles cancellations, expired subscriptions, and inactive contracts safely.
 */
app.get('/api/subscription/status', requireAuth, async (req, res) => {
  const user = req.user!;
  const shopifyConfig = ShopifyService.getConfigStatus(user.email);

  let record = subscriptionStore.getByUserId(user.uid);
  if (req.token) {
    const firestoreRecord = await subscriptionStore.loadFromFirestore(user.uid, req.token);
    if (firestoreRecord) {
      record = firestoreRecord;
    }
  }

  let verifiedActive = false;
  let finalStatus: SubscriptionStatus = 'pending';
  let apiOutage = false;

  // Direct Outbound Verification with Shopify Admin API:
  // Access is NEVER granted based on email, cached state, or local storage.
  // ONLY a genuine active subscription contract confirmed live by Shopify Admin API grants access.
  if (shopifyConfig.directVerificationActive) {
    try {
      const verification = await ShopifyService.verifyWithShopify({
        userId: user.uid,
        userEmail: user.email,
        shopifyCustomerId: record?.shopifyCustomerId || undefined,
        initialOrderId: record?.initialOrderId || undefined,
        customerBindingProof: record?.customerBindingProof || undefined,
        existingSubscriptionId: record?.shopifySubscriptionId || undefined,
        billingAnchorDay: record?.billingAnchorDay || undefined,
      });

      if (verification.verified) {
        verifiedActive = Boolean(verification.hasActiveAccess);
        finalStatus = verification.status as SubscriptionStatus;

        const cleanVerifiedCust = (verification.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
        const cleanExistingCust = (record?.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
        const isDifferentCustomer = Boolean(
          cleanVerifiedCust &&
          cleanExistingCust &&
          cleanVerifiedCust !== cleanExistingCust
        );

        record = subscriptionStore.setStatus(
          user.uid,
          finalStatus,
          {
            email: user.email,
            shopifySubscriptionId: verification.shopifyContractId || (isDifferentCustomer ? undefined : record?.shopifySubscriptionId) || undefined,
            shopifyOrderId: verification.shopifyOrderId || (isDifferentCustomer ? undefined : record?.shopifyOrderId) || undefined,
            shopifyCustomerId: verification.shopifyCustomerId || record?.shopifyCustomerId || undefined,
            initialOrderId: verification.initialOrderId || (isDifferentCustomer ? undefined : record?.initialOrderId) || undefined,
            customerBindingProof: verification.customerBindingProof || (isDifferentCustomer ? undefined : record?.customerBindingProof) || undefined,
            billingAnchorDay: isDifferentCustomer
              ? verification.billingAnchorDay
              : (verification.billingAnchorDay || record?.billingAnchorDay || undefined),
            currentPeriodEnd: verification.currentPeriodEnd || (isDifferentCustomer ? undefined : record?.currentPeriodEnd),
            gracePeriodEnd: verification.gracePeriodEnd || (isDifferentCustomer ? undefined : record?.gracePeriodEnd),
            lastPaidOrderId: verification.shopifyOrderId || (isDifferentCustomer ? undefined : (record?.lastPaidOrderId || record?.shopifyOrderId)) || undefined,
          },
          req.token
        );
      } else if (verification.error) {
        // Fail-safe outage policy: Shopify API could not be reached.
        // Never extend or grant unverified cached access when Shopify is unreachable.
        apiOutage = true;
        verifiedActive = false;
        if (record) {
          subscriptionStore.evaluateCacheExpiry(record);
          if (record.status === 'expired') {
            record = subscriptionStore.setStatus(user.uid, 'expired', { email: user.email, lastVerifiedAt: record.lastVerifiedAt }, req.token);
          }
        }
        finalStatus = record?.status === 'expired' ? 'expired' : 'pending';
      } else {
        // Shopify confirmed that no active subscription order/contract exists for this user
        verifiedActive = false;
        finalStatus = record?.status === 'cancelled' ? 'cancelled' : (record?.status === 'expired' ? 'expired' : 'pending');
        if (record?.status === 'active') {
          console.warn(`[Subscription Status] Downgrading user ${user.uid} - no active contract verified on Shopify`);
          record = subscriptionStore.setStatus(
            user.uid,
            'expired',
            {
              email: user.email,
            },
            req.token
          );
        }
      }
    } catch (err: any) {
      console.warn('[Subscription Status] Shopify verification error:', err.message);
      // Fail-safe outage policy: If Shopify cannot be reached, never grant unverified cached access
      apiOutage = true;
      verifiedActive = false;
      if (record) {
        subscriptionStore.evaluateCacheExpiry(record);
        if (record.status === 'expired') {
          record = subscriptionStore.setStatus(user.uid, 'expired', { email: user.email, lastVerifiedAt: record.lastVerifiedAt }, req.token);
        }
      }
      finalStatus = record?.status === 'expired' ? 'expired' : 'pending';
    }
  } else {
    // If Shopify direct verification is not active, access is strictly blocked
    verifiedActive = false;
    finalStatus = 'pending';
    if (record?.status === 'active') {
      record = subscriptionStore.setStatus(user.uid, 'expired', { email: user.email }, req.token);
    }
  }

  // INVARIANT: Only an active subscription verified live with Shopify can ever grant access.
  // For any user without a confirmed active Shopify contract, access is strictly false.
  const hasActiveAccess = verifiedActive;
  const status = finalStatus;

  console.log('[Shopify Diagnostics: Access Status] Evaluated for UID:', user.uid, 'hasActiveAccess:', hasActiveAccess, 'status:', status, 'apiOutage:', apiOutage);

  const sanitizedSubscription = record
    ? (() => {
        const { customerBindingProof: _hiddenProof, ...safeRecord } = record;
        return { ...safeRecord, status };
      })()
    : {
        status,
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Full Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
      };

  return res.json({
    authenticated: true,
    userId: user.uid,
    email: user.email,
    status,
    hasActiveAccess,
    apiOutage,
    cachePolicy: 'fail_closed_24h_ttl',
    billingAnchorDay: record?.billingAnchorDay || null,
    currentPeriodEnd: record?.currentPeriodEnd || null,
    gracePeriodEnd: record?.gracePeriodEnd || null,
    lastPaidOrderId: record?.lastPaidOrderId || record?.shopifyOrderId || null,
    subscription: sanitizedSubscription,
    shopifyConfigured: shopifyConfig.configured,
    missingShopifyConfig: shopifyConfig.missing,
    verificationMode: 'outbound_api',
  });
});

/**
 * POST /api/subscription/create-checkout
 * Generates a secure Shopify subscription checkout URL using Storefront API cartCreate.
 * Pricing is strictly $9.99 USD per month recurring.
 */
app.post('/api/subscription/create-checkout', requireAuth, async (req, res) => {
  const user = req.user!;
  const returnUrl = req.body.returnUrl || `${process.env.APP_URL || ''}/`;

  console.log('[Shopify Diagnostics: Checkout Creation] POST /api/subscription/create-checkout for UID:', user.uid, 'Return URL:', returnUrl);

  const result = await ShopifyService.createCheckoutSession({
    userId: user.uid,
    userEmail: user.email,
    returnUrl,
  });

  console.log('[Shopify Diagnostics: Checkout Creation] Session response for UID:', user.uid, 'Success:', result.success, 'Locked:', result.locked);

  return res.json(result);
});

/**
 * POST /api/subscription/verify
 * Cryptographically verifies subscription validity directly with Shopify Admin API.
 * Requirement 2: Never trusts payment status supplied by the browser.
 * Requirement 3: Confirms the contract belongs to the authenticated Firebase user.
 * Requirement 5 & 6: Preserves existing Firestore data and updates status safely.
 */
app.post('/api/subscription/verify', requireAuth, async (req, res) => {
  const user = req.user!;
  const { orderOrContractId } = req.body || {};

  console.log('[Shopify Diagnostics: Return Handling] POST /api/subscription/verify for UID:', user.uid, 'Target ID:', orderOrContractId || 'auto-scan');

  let record = subscriptionStore.getByUserId(user.uid);
  if (req.token) {
    const firestoreRecord = await subscriptionStore.loadFromFirestore(user.uid, req.token);
    if (firestoreRecord) {
      record = firestoreRecord;
    }
  }

  let verification: Awaited<ReturnType<typeof ShopifyService.verifyWithShopify>>;
  try {
    verification = await ShopifyService.verifyWithShopify({
      userId: user.uid,
      userEmail: user.email,
      shopifyCustomerId: record?.shopifyCustomerId || undefined,
      initialOrderId: record?.initialOrderId || undefined,
      customerBindingProof: record?.customerBindingProof || undefined,
      orderOrContractId,
      existingSubscriptionId: record?.shopifySubscriptionId || undefined,
      billingAnchorDay: record?.billingAnchorDay || undefined,
    });
  } catch (err: any) {
    verification = {
      verified: false,
      error: true,
      status: 'pending',
      hasActiveAccess: false,
      message: `Shopify Admin API unreachable: ${err.message}`,
    };
  }

  const apiOutage = Boolean(verification.error);

  if (verification.verified) {
    const cleanVerifiedCust = (verification.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
    const cleanExistingCust = (record?.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
    const isDifferentCustomer = Boolean(
      cleanVerifiedCust &&
      cleanExistingCust &&
      cleanVerifiedCust !== cleanExistingCust
    );

    record = subscriptionStore.setStatus(
      user.uid,
      verification.status as any,
      {
        email: user.email,
        shopifySubscriptionId: verification.shopifyContractId || (isDifferentCustomer ? undefined : record?.shopifySubscriptionId) || undefined,
        shopifyOrderId: verification.shopifyOrderId || (isDifferentCustomer ? undefined : record?.shopifyOrderId) || undefined,
        shopifyCustomerId: verification.shopifyCustomerId || record?.shopifyCustomerId || undefined,
        initialOrderId: verification.initialOrderId || (isDifferentCustomer ? undefined : record?.initialOrderId) || undefined,
        customerBindingProof: verification.customerBindingProof || (isDifferentCustomer ? undefined : record?.customerBindingProof) || undefined,
        billingAnchorDay: isDifferentCustomer
          ? verification.billingAnchorDay
          : (verification.billingAnchorDay || record?.billingAnchorDay || undefined),
        currentPeriodEnd: verification.currentPeriodEnd || (isDifferentCustomer ? undefined : record?.currentPeriodEnd),
        gracePeriodEnd: verification.gracePeriodEnd || (isDifferentCustomer ? undefined : record?.gracePeriodEnd),
        lastPaidOrderId: verification.shopifyOrderId || (isDifferentCustomer ? undefined : (record?.lastPaidOrderId || record?.shopifyOrderId)) || undefined,
      },
      req.token
    );
  } else if (apiOutage) {
    if (record) {
      subscriptionStore.evaluateCacheExpiry(record);
      if (record.status === 'expired') {
        record = subscriptionStore.setStatus(user.uid, 'expired', { email: user.email, lastVerifiedAt: record.lastVerifiedAt }, req.token);
      }
    }
  } else if (record?.status === 'active') {
    record = subscriptionStore.setStatus(
      user.uid,
      'expired',
      {
        email: user.email,
      },
      req.token
    );
  }

  const currentRecord = subscriptionStore.getByUserId(user.uid);
  const status: SubscriptionStatus = apiOutage
    ? (currentRecord?.status === 'expired' ? 'expired' : 'pending')
    : (currentRecord?.status || 'pending');
  const hasActiveAccess = !apiOutage && Boolean(verification.hasActiveAccess ?? (status === 'active' && verification.verified));

  console.log('[Shopify Diagnostics: Return Handling] Verification completed for UID:', user.uid, 'Result: verified =', verification.verified, 'status =', status, 'hasActiveAccess =', hasActiveAccess, 'apiOutage =', apiOutage);

  return res.json({
    verified: verification.verified,
    status,
    hasActiveAccess,
    apiOutage,
    cachePolicy: 'fail_closed_24h_ttl',
    billingAnchorDay: currentRecord?.billingAnchorDay || verification.billingAnchorDay || null,
    currentPeriodEnd: currentRecord?.currentPeriodEnd || verification.currentPeriodEnd || null,
    gracePeriodEnd: currentRecord?.gracePeriodEnd || verification.gracePeriodEnd || null,
    lastPaidOrderId: currentRecord?.lastPaidOrderId || currentRecord?.shopifyOrderId || null,
    message: verification.message,
    shopifyCustomerId: currentRecord?.shopifyCustomerId || undefined,
    shopifyOrderId: currentRecord?.shopifyOrderId || undefined,
    verificationMode: 'outbound_api',
  });
});

/**
 * GET /api/subscription/config-info
 * Returns configuration requirements and current setup status
 * without leaking sensitive tokens or secrets.
 */
app.get('/api/subscription/config-info', async (req, res) => {
  const userEmail = (req.query.email as string)?.trim() || undefined;
  const status = ShopifyService.getConfigStatus(userEmail);
  const appUrl = process.env.APP_URL || 'https://your-domain.com';

  return res.json({
    isComplete: status.configured,
    storeDomainConfigured: status.storeDomainConfigured,
    storefrontTokenConfigured: status.storefrontTokenConfigured,
    variantConfigured: status.variantConfigured,
    sellingPlanConfigured: status.sellingPlanConfigured,
    sellingPlanId: status.sellingPlanId,
    webhookSecretConfigured: status.webhookSecretConfigured,
    webhookDeliveryConfirmed: status.webhookDeliveryConfirmed,
    apiKeyConfigured: status.apiKeyConfigured,
    apiSecretConfigured: status.apiSecretConfigured,
    adminTokenConfigured: status.adminTokenConfigured,
    clientCredentialsActive: status.clientCredentialsActive,
    directVerificationActive: status.directVerificationActive,
    verificationMode: 'outbound_api',
    liveCheckoutEnabled: status.liveCheckoutEnabled,
    lockReason: status.lockReason,
    testAccount: 'chongjun2205@gmail.com',
    storeDomain: status.storeDomain || null,
    variantId: status.variantId,
    missing: status.missing,
    missingEssentialCheckout: status.missingEssentialCheckout,
    optionalWebhookMissing: status.optionalWebhookMissing,
    pricing: {
      introPrice: 9.99,
      recurringPrice: 9.99,
      currency: 'USD',
      firstPeriod: '1 month',
      recurringInterval: 'monthly',
    },
    verificationMethod: 'Direct Outbound Server-to-Server Shopify API',
    note: 'Subscription status is verified directly against Shopify Admin API on checkout return, user login, and session refresh. No external webhooks or paid services required.',
    instructions: [
      {
        step: 1,
        title: 'Shopify Storefront & Admin API Access',
        detail: 'Connected via Client Credentials with scopes: read_own_subscription_contracts, read_orders, unauthenticated_write_checkouts, unauthenticated_read_product_listings, unauthenticated_read_selling_plans.',
      },
      {
        step: 2,
        title: 'Recurring Subscription Product ($9.99/mo)',
        detail: 'Verified product variant gid://shopify/ProductVariant/67632091955475 and Selling Plan gid://shopify/SellingPlan/692445053203.',
      },
      {
        step: 3,
        title: 'Direct Outbound Verification Active',
        detail: 'After Shopify checkout, the server verifies the contract directly with Shopify Admin API and maps to the authenticated Firebase user.',
      },
    ],
  });
});

/**
 * GET /api/subscription/selling-plans
 * Queries Storefront API for selling plans attached to the $9.99 Life Reset Premium product variant.
 */
app.get('/api/subscription/selling-plans', async (_req, res) => {
  const result = await ShopifyService.fetchVariantSellingPlans();
  return res.json(result);
});

/**
 * POST /api/subscription/register-webhooks
 * Attempts to register the required webhook subscriptions via Shopify Admin GraphQL API.
 */
app.post('/api/subscription/register-webhooks', async (req, res) => {
  try {
    const callbackUrl = req.body?.callbackUrl;
    const result = await ShopifyService.registerWebhooks(callbackUrl);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

interface WebhookAuditEntry {
  timestamp: string;
  topic: string;
  hmacHeaderPresent: boolean;
  hmacValid: boolean;
  isTestNotification: boolean;
  userId?: string | null;
  email?: string | null;
  message: string;
}

const webhookAuditLogs: WebhookAuditEntry[] = [];

/**
 * GET /api/subscription/webhook-audit
 * Allows inspection of received webhook requests, HMAC verification status, and guards.
 * If SHOPIFY_WEBHOOK_SERVICE_URL is set, queries the dedicated Cloud Run webhook service.
 */
app.get('/api/subscription/webhook-audit', async (req, res) => {
  let remoteLogs: WebhookAuditEntry[] = [];
  let remoteServiceConnected = false;
  const webhookServiceUrl = process.env.SHOPIFY_WEBHOOK_SERVICE_URL?.trim();

  if (webhookServiceUrl) {
    try {
      const headers: Record<string, string> = {};
      if (process.env.INTERNAL_SERVICE_KEY) {
        headers['x-internal-key'] = process.env.INTERNAL_SERVICE_KEY;
      }
      const remoteRes = await fetch(`${webhookServiceUrl.replace(/\/$/, '')}/api/subscription/webhook-audit`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });
      if (remoteRes.ok) {
        const remoteData: any = await remoteRes.json();
        if (Array.isArray(remoteData.recent)) {
          remoteLogs = remoteData.recent;
          remoteServiceConnected = true;
        }
      }
    } catch (err: any) {
      console.warn('Could not contact Cloud Run webhook service:', err.message);
    }
  }

  const combined = [...webhookAuditLogs, ...remoteLogs].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return res.json({
    totalReceived: combined.length,
    recent: combined.slice(-20),
    liveCheckoutEnabled: false, // Invariant: live checkout strictly locked
    webhookDeliveryConfirmed: false, // Invariant: kept false until full verification
    webhookService: {
      configured: Boolean(webhookServiceUrl),
      url: webhookServiceUrl || null,
      connected: remoteServiceConnected,
    },
  });
});

/**
 * POST /api/webhooks/shopify
 * Secure server-to-server webhook endpoint for Shopify.
 * Validates HMAC-SHA256 signature using SHOPIFY_WEBHOOK_SECRET.
 * Automatically updates customer subscription status when payment succeeds,
 * renews, cancels, or fails.
 * STRICT GUARD: Example/test notifications never unlock live checkout or grant access.
 */
app.post('/api/webhooks/shopify', async (req, res) => {
  const rawHmac = req.headers['x-shopify-hmac-sha256'];
  const hmacHeader = (Array.isArray(rawHmac) ? rawHmac[0] : (rawHmac || '')).trim();

  const rawTopic = req.headers['x-shopify-topic'];
  const topic = (Array.isArray(rawTopic) ? rawTopic[0] : (rawTopic || 'unknown')).trim();

  const isShopifyTest =
    req.headers['x-shopify-test'] === 'true' ||
    (Array.isArray(req.headers['x-shopify-test']) && req.headers['x-shopify-test'][0] === 'true');

  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})));
  const isValidHmac = ShopifyService.verifyWebhookHmac(rawBody, hmacHeader);

  if (!isValidHmac) {
    console.warn(`[Shopify Webhook] Rejected webhook for ${topic}: Invalid or missing HMAC signature`);
    webhookAuditLogs.push({
      timestamp: new Date().toISOString(),
      topic,
      hmacHeaderPresent: Boolean(hmacHeader),
      hmacValid: false,
      isTestNotification: isShopifyTest,
      message: 'Rejected: HMAC signature verification failed',
    });
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  // Handle Shopify "Send test notification" or example event
  if (isShopifyTest) {
    console.log(`[Shopify Webhook] Verified HMAC for test notification on topic: ${topic}. Keeping live checkout locked.`);
    webhookAuditLogs.push({
      timestamp: new Date().toISOString(),
      topic,
      hmacHeaderPresent: true,
      hmacValid: true,
      isTestNotification: true,
      message: 'Shopify HMAC test notification verified. Live checkout remains locked per security policy.',
    });
    return res.status(200).json({
      received: true,
      isTest: true,
      note: 'Test notification verified. Live checkout remains safely locked until real subscription flow is confirmed.',
    });
  }

  try {
    let payload = req.body || {};
    if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString('utf8'));
      } catch {
        payload = {};
      }
    }

    console.log(`Processing verified genuine Shopify webhook for topic: ${topic}`);

    let userId: string | null = null;
    let email: string | null = null;

    // Extract customer identifiers from custom_attributes, note_attributes, or attributes array
    const attributesList = [
      ...(Array.isArray(payload.custom_attributes) ? payload.custom_attributes : []),
      ...(Array.isArray(payload.note_attributes) ? payload.note_attributes : []),
      ...(Array.isArray(payload.attributes) ? payload.attributes : []),
    ];

    const match = attributesList.find((attr: any) => attr.name === 'userId' || attr.key === 'userId');
    if (match) userId = match.value;

    if (payload.customer && payload.customer.email) {
      email = payload.customer.email;
    } else if (payload.email) {
      email = payload.email;
    }

    // Locate target user record
    let targetUserId = userId;
    if (!targetUserId && email) {
      const byEmail = subscriptionStore.getByEmail(email);
      if (byEmail) targetUserId = byEmail.userId;
    }

    if (!targetUserId) {
      console.warn(`Webhook ${topic} received with valid HMAC, but could not match user ID or email:`, { userId, email });
      webhookAuditLogs.push({
        timestamp: new Date().toISOString(),
        topic,
        hmacHeaderPresent: true,
        hmacValid: true,
        isTestNotification: false,
        userId,
        email,
        message: 'Verified HMAC received, but no registered user account mapped. Live checkout remains locked.',
      });
      return res.status(200).json({ received: true, note: 'User not currently mapped. Live checkout remains locked.' });
    }

    // Process topic for verified user
    if (topic.includes('subscription_contracts/create') || topic.includes('subscription_contracts/update')) {
      const contractStatus = (payload.status || '').toUpperCase();
      if (contractStatus === 'ACTIVE') {
        subscriptionStore.setStatus(targetUserId, 'active', {
          shopifySubscriptionId: String(payload.id || ''),
          email: email || undefined,
          currentPeriodEnd: payload.next_billing_date || undefined,
        });
        // Invariant (Requirement 7): Keep webhookDeliveryConfirmed: false and liveCheckoutEnabled: false
        // until HMAC verification and the real subscription activation flow have both been tested.
      } else if (contractStatus === 'CANCELLED') {
        subscriptionStore.setStatus(targetUserId, 'cancelled', {
          cancelAtPeriodEnd: true,
        });
      } else if (contractStatus === 'EXPIRED') {
        subscriptionStore.setStatus(targetUserId, 'expired');
      }
    } else if (topic.includes('orders/paid')) {
      // Monthly recurring order paid
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      subscriptionStore.setStatus(targetUserId, 'active', {
        shopifyOrderId: String(payload.id || ''),
        email: email || undefined,
        currentPeriodEnd: nextMonth.toISOString(),
      });
      // Invariant (Requirement 7): Keep webhookDeliveryConfirmed: false and liveCheckoutEnabled: false
      // until HMAC verification and the real subscription activation flow have both been tested.
    }

    webhookAuditLogs.push({
      timestamp: new Date().toISOString(),
      topic,
      hmacHeaderPresent: true,
      hmacValid: true,
      isTestNotification: false,
      userId: targetUserId,
      email,
      message: `Successfully processed genuine ${topic} for user ${targetUserId}`,
    });

    return res.status(200).json({ received: true, processed: true });
  } catch (err: any) {
    console.error('Error handling Shopify webhook payload:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist'), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
