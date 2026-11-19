import express from 'express';
import crypto from 'crypto';
import { Firestore } from '@google-cloud/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Configuration
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'central-shade-hn2tx';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-lifereset-fa0dc91d-56b1-4b07-9d16-6c4304654eab';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;

// Initialize Firestore client with target database
const firestore = new Firestore({
  projectId: GCP_PROJECT_ID,
  databaseId: FIRESTORE_DATABASE_ID,
});

// Cache for webhook secret retrieved from Secret Manager or environment
let cachedWebhookSecret: string | null = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || null;

/**
 * Retrieves the Shopify Webhook Secret safely.
 * If not in process.env, attempts to fetch from Google Secret Manager.
 * Never prints or logs the secret value.
 */
async function getWebhookSecret(): Promise<string | null> {
  if (cachedWebhookSecret) {
    return cachedWebhookSecret;
  }

  try {
    const client = new SecretManagerServiceClient();
    const secretName = `projects/${GCP_PROJECT_ID}/secrets/SHOPIFY_WEBHOOK_SECRET/versions/latest`;
    const [version] = await client.accessSecretVersion({ name: secretName });
    const payload = version.payload?.data?.toString();
    if (payload) {
      cachedWebhookSecret = payload.trim();
      return cachedWebhookSecret;
    }
  } catch (err: any) {
    // Keep error message safe and generic
    console.error('[SecretManager] Unable to fetch SHOPIFY_WEBHOOK_SECRET from Secret Manager:', err.message);
  }

  return null;
}

/**
 * Timing-safe HMAC verification against Shopify raw body.
 */
function verifyHmac(rawBody: Buffer, headerHmac: string, secret: string): boolean {
  try {
    const generatedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const generatedBuffer = Buffer.from(generatedHmac, 'utf8');
    const headerBuffer = Buffer.from(headerHmac.trim(), 'utf8');

    if (generatedBuffer.length !== headerBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(generatedBuffer, headerBuffer);
  } catch {
    return false;
  }
}

interface WebhookAuditEntry {
  id: string;
  timestamp: string;
  topic: string;
  hmacValid: boolean;
  isTest: boolean;
  userId?: string | null;
  email?: string | null;
  message: string;
  httpStatus: number;
}

const auditLogs: WebhookAuditEntry[] = [];

function recordAudit(entry: WebhookAuditEntry) {
  auditLogs.push(entry);
  if (auditLogs.length > 50) {
    auditLogs.shift();
  }

  // Persist audit record non-destructively to Firestore for distributed auditing
  firestore
    .collection('system')
    .doc('shopifyWebhookAudit')
    .collection('logs')
    .doc(entry.id)
    .set(entry)
    .catch((err) => {
      console.warn('[Audit] Firestore audit log error:', err.message);
    });
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'life-reset-shopify-webhook',
    projectId: GCP_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    timestamp: new Date().toISOString(),
  });
});

// Audit query endpoint (accessible for backend verification)
app.get('/api/subscription/webhook-audit', (req, res) => {
  // If an internal service key is set, require it; otherwise return sanitized logs
  const providedKey = req.headers['x-internal-key'] || req.query.key;
  if (INTERNAL_SERVICE_KEY && providedKey !== INTERNAL_SERVICE_KEY) {
    return res.status(401).json({ error: 'Unauthorized internal audit access' });
  }

  return res.json({
    totalReceived: auditLogs.length,
    recent: auditLogs.slice(-20),
    service: 'life-reset-shopify-webhook',
  });
});

/**
 * POST /api/webhooks/shopify
 * Shopify Webhook Ingress
 * Uses express.raw() to capture the exact bytes for HMAC validation.
 */
app.post(
  '/api/webhooks/shopify',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res) => {
    const auditId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const rawHmac = req.headers['x-shopify-hmac-sha256'];
    const hmacHeader = (Array.isArray(rawHmac) ? rawHmac[0] : (rawHmac || '')).trim();

    const rawTopic = req.headers['x-shopify-topic'];
    const topic = (Array.isArray(rawTopic) ? rawTopic[0] : (rawTopic || 'unknown')).trim();

    const isTest =
      req.headers['x-shopify-test'] === 'true' ||
      (Array.isArray(req.headers['x-shopify-test']) && req.headers['x-shopify-test'][0] === 'true');

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    // 1. Verify Secret Availability
    const secret = await getWebhookSecret();
    if (!secret) {
      console.error('[Shopify Webhook] Secret not configured or unavailable');
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: false,
        isTest,
        message: 'Rejected: SHOPIFY_WEBHOOK_SECRET unavailable on server',
        httpStatus: 500,
      });
      return res.status(500).json({ error: 'Webhook signature key not configured' });
    }

    // 2. Validate HMAC
    const isValid = verifyHmac(rawBody, hmacHeader, secret);

    if (!isValid) {
      console.warn(`[Shopify Webhook] Invalid HMAC signature for topic: ${topic}`);
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: false,
        isTest,
        message: 'Rejected: Invalid HMAC signature',
        httpStatus: 401,
      });
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    // 3. Handle Shopify Test Notifications
    if (isTest) {
      console.log(`[Shopify Webhook] Verified HMAC for test notification on topic: ${topic}`);
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: true,
        isTest: true,
        message: 'Test notification verified with valid HMAC-SHA256 signature.',
        httpStatus: 200,
      });
      return res.status(200).json({ received: true, isTest: true });
    }

    // 4. Parse Payload
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: true,
        isTest: false,
        message: 'Valid HMAC, but payload was not valid JSON',
        httpStatus: 400,
      });
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // 5. Extract User Identifiers
    const attributesList = [
      ...(Array.isArray(payload.custom_attributes) ? payload.custom_attributes : []),
      ...(Array.isArray(payload.note_attributes) ? payload.note_attributes : []),
      ...(Array.isArray(payload.attributes) ? payload.attributes : []),
    ];

    let userId: string | null = null;
    const match = attributesList.find((a: any) => a.name === 'userId' || a.key === 'userId');
    if (match && typeof match.value === 'string') {
      userId = match.value.trim();
    }

    let email: string | null = null;
    if (payload.customer && typeof payload.customer.email === 'string') {
      email = payload.customer.email.trim();
    } else if (typeof payload.email === 'string') {
      email = payload.email.trim();
    }

    // 6. Resolve Target User in Firestore
    let targetUserId = userId;
    if (!targetUserId && email) {
      try {
        const querySnapshot = await firestore
          .collection('users')
          .where('email', '==', email.toLowerCase())
          .limit(1)
          .get();

        if (!querySnapshot.empty) {
          targetUserId = querySnapshot.docs[0].id;
        }
      } catch (err: any) {
        console.warn('[Shopify Webhook] Error resolving user by email:', err.message);
      }
    }

    if (!targetUserId) {
      console.warn(`[Shopify Webhook] Verified HMAC received, but no user could be mapped for topic ${topic}`);
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: true,
        isTest: false,
        userId,
        email,
        message: 'Verified HMAC received, but user account could not be found in Firestore.',
        httpStatus: 200,
      });
      return res.status(200).json({ received: true, note: 'User not mapped' });
    }

    // 7. Update Firestore Non-Destructively
    // Only updates subscription fields; leaves all user tasks, habits, and profile data completely untouched.
    const now = new Date().toISOString();
    let newStatus = 'pending';

    if (topic.includes('subscription_contracts/create') || topic.includes('subscription_contracts/update')) {
      const contractStatus = String(payload.status || '').toUpperCase();
      if (contractStatus === 'ACTIVE') {
        newStatus = 'active';
      } else if (contractStatus === 'CANCELLED') {
        newStatus = 'cancelled';
      } else if (contractStatus === 'EXPIRED') {
        newStatus = 'expired';
      } else if (contractStatus === 'PAUSED') {
        newStatus = 'paused';
      }
    } else if (topic.includes('orders/paid')) {
      newStatus = 'active';
    }

    const subscriptionData: Record<string, any> = {
      status: newStatus,
      planId: 'life-reset-monthly',
      planTitle: 'Life Reset Full Access',
      priceIntro: 9.99,
      priceRecurring: 9.99,
      currency: 'USD',
      billingInterval: 'month',
      updatedAt: now,
    };

    if (payload.id) {
      subscriptionData.shopifySubscriptionId = String(payload.id);
    }
    if (payload.next_billing_date) {
      subscriptionData.currentPeriodEnd = payload.next_billing_date;
    }

    try {
      await firestore
        .collection('users')
        .doc(targetUserId)
        .set(
          {
            subscriptionStatus: newStatus,
            subscription: subscriptionData,
            updatedAt: now,
          },
          { merge: true } // CRITICAL: Never overwrite other fields
        );

      console.log(`[Shopify Webhook] Successfully updated subscription for user ${targetUserId} to ${newStatus}`);

      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: true,
        isTest: false,
        userId: targetUserId,
        email,
        message: `Subscription successfully updated to ${newStatus} via verified webhook.`,
        httpStatus: 200,
      });

      return res.status(200).json({ received: true, status: newStatus });
    } catch (err: any) {
      console.error('[Shopify Webhook] Error updating Firestore:', err.message);
      recordAudit({
        id: auditId,
        timestamp,
        topic,
        hmacValid: true,
        isTest: false,
        userId: targetUserId,
        email,
        message: `HMAC verified but Firestore write failed: ${err.message}`,
        httpStatus: 500,
      });
      return res.status(500).json({ error: 'Database update failed' });
    }
  }
);

app.listen(PORT, () => {
  console.log(`[Shopify Webhook Service] Listening on port ${PORT}`);
});
