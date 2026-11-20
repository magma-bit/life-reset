import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SubscriptionStatus, UserSubscription } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'subscriptions.json');

// Read Firebase config for Firestore sync
let firebaseProjectId = '';
let firebaseDatabaseId = '(default)';
let firebaseApiKey = '';

try {
  const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    firebaseProjectId = config.projectId || '';
    firebaseDatabaseId = config.firestoreDatabaseId || '(default)';
    firebaseApiKey = config.apiKey || '';
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json in subscriptionStore:', err);
}

export const SUBSCRIPTION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24-hour max cache TTL without live Shopify verification

export interface ServerSubscriptionRecord extends UserSubscription {
  userId: string;
  email: string;
  notes?: string;
}

class SubscriptionStore {
  private records: Map<string, ServerSubscriptionRecord> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw) as Record<string, ServerSubscriptionRecord>;
        for (const [key, val] of Object.entries(data)) {
          this.records.set(key, val);
        }
      }
    } catch (err) {
      console.error('Failed to load subscription store from disk:', err);
    }
  }

  private saveToDisk() {
    try {
      const obj: Record<string, ServerSubscriptionRecord> = {};
      for (const [key, val] of this.records.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist subscriptions to disk:', err);
    }
  }

  /**
   * Safely persists subscription updates to Firestore using Firestore REST API.
   * Uses field masks (updateMask) to strictly update subscription metadata without
   * touching or overwriting any existing user data (tasks, habits, notes, settings, etc.).
   */
  public async syncToFirestore(record: ServerSubscriptionRecord, idToken?: string): Promise<void> {
    if (!firebaseProjectId || !record.userId) return;

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/users/${record.userId}?updateMask.fieldPaths=subscriptionStatus&updateMask.fieldPaths=subscription&updateMask.fieldPaths=updatedAt${firebaseApiKey ? `&key=${firebaseApiKey}` : ''}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const subscriptionFields: Record<string, any> = {
        status: { stringValue: record.status },
        planId: { stringValue: record.planId || 'life-reset-monthly' },
        planTitle: { stringValue: record.planTitle || 'Life Reset Full Access' },
        priceIntro: { doubleValue: record.priceIntro ?? 9.99 },
        priceRecurring: { doubleValue: record.priceRecurring ?? 9.99 },
        currency: { stringValue: record.currency || 'USD' },
        billingInterval: { stringValue: record.billingInterval || 'month' },
        updatedAt: { stringValue: record.updatedAt },
      };

      if (record.billingAnchorDay !== undefined && record.billingAnchorDay !== null) {
        subscriptionFields.billingAnchorDay = { integerValue: String(record.billingAnchorDay) };
      }
      if (record.currentPeriodEnd) {
        subscriptionFields.currentPeriodEnd = { stringValue: record.currentPeriodEnd };
      }
      if (record.gracePeriodEnd) {
        subscriptionFields.gracePeriodEnd = { stringValue: record.gracePeriodEnd };
      }
      if (record.lastPaidOrderId || record.shopifyOrderId) {
        subscriptionFields.lastPaidOrderId = { stringValue: record.lastPaidOrderId || record.shopifyOrderId! };
      }
      if (record.shopifySubscriptionId) {
        subscriptionFields.shopifySubscriptionId = { stringValue: record.shopifySubscriptionId };
      }
      if (record.shopifyOrderId) {
        subscriptionFields.shopifyOrderId = { stringValue: record.shopifyOrderId };
      }
      if (record.shopifyCustomerId) {
        subscriptionFields.shopifyCustomerId = { stringValue: record.shopifyCustomerId };
      }
      if (record.initialOrderId) {
        subscriptionFields.initialOrderId = { stringValue: record.initialOrderId };
      }
      if (record.customerBindingProof) {
        subscriptionFields.customerBindingProof = { stringValue: record.customerBindingProof };
      }
      if (record.lastVerifiedAt) {
        subscriptionFields.lastVerifiedAt = { stringValue: record.lastVerifiedAt };
      }

      const body = {
        fields: {
          subscriptionStatus: { stringValue: record.status },
          subscription: {
            mapValue: {
              fields: subscriptionFields,
            },
          },
          updatedAt: { stringValue: record.updatedAt },
        },
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Non-blocking log: local store maintains availability
        console.warn(`Firestore sync note for user ${record.userId} (status ${res.status}):`, text.slice(0, 150));
      }
    } catch (err: any) {
      console.warn('Error during Firestore subscription sync:', err.message);
    }
  }

  /**
   * Attempts to retrieve user subscription data from Firestore if not in local cache.
   */
  public async loadFromFirestore(userId: string, idToken: string): Promise<ServerSubscriptionRecord | null> {
    if (!firebaseProjectId || !userId || !idToken) return null;

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/users/${userId}${firebaseApiKey ? `?key=${firebaseApiKey}` : ''}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) return null;

      const data = await res.json();
      const fields = data.fields;
      if (!fields) return null;

      const status = (fields.subscriptionStatus?.stringValue || 'pending') as SubscriptionStatus;
      const subMap = fields.subscription?.mapValue?.fields || {};

      const anchorRaw = subMap.billingAnchorDay?.integerValue || subMap.billingAnchorDay?.stringValue;
      const billingAnchorDay = anchorRaw ? parseInt(anchorRaw, 10) : undefined;

      const record: ServerSubscriptionRecord = {
        userId,
        email: fields.email?.stringValue || '',
        status,
        planId: subMap.planId?.stringValue || 'life-reset-monthly',
        planTitle: subMap.planTitle?.stringValue || 'Life Reset Full Access',
        priceIntro: subMap.priceIntro?.doubleValue ?? 9.99,
        priceRecurring: subMap.priceRecurring?.doubleValue ?? 9.99,
        currency: subMap.currency?.stringValue || 'USD',
        billingInterval: subMap.billingInterval?.stringValue || 'month',
        billingAnchorDay,
        currentPeriodEnd: subMap.currentPeriodEnd?.stringValue,
        gracePeriodEnd: subMap.gracePeriodEnd?.stringValue,
        lastPaidOrderId: subMap.lastPaidOrderId?.stringValue || subMap.shopifyOrderId?.stringValue,
        shopifyCustomerId: subMap.shopifyCustomerId?.stringValue,
        initialOrderId: subMap.initialOrderId?.stringValue,
        customerBindingProof: subMap.customerBindingProof?.stringValue,
        shopifySubscriptionId: subMap.shopifySubscriptionId?.stringValue,
        shopifyOrderId: subMap.shopifyOrderId?.stringValue,
        createdAt: fields.createdAt?.stringValue || new Date().toISOString(),
        updatedAt: fields.updatedAt?.stringValue || new Date().toISOString(),
        lastVerifiedAt: subMap.lastVerifiedAt?.stringValue || fields.updatedAt?.stringValue,
      };

      this.evaluateCacheExpiry(record);
      this.records.set(userId, record);
      this.saveToDisk();
      return record;
    } catch (err: any) {
      console.warn('Error loading subscription from Firestore:', err.message);
      return null;
    }
  }

  /**
   * Fail-safe cache expiry check:
   * Cached active/cancelled access can NEVER remain active indefinitely if Shopify is unreachable.
   * Expires the cached status if:
   * 1. The billing cycle + 72-hour grace period has elapsed (or period timestamps are missing), OR
   * 2. More than SUBSCRIPTION_CACHE_MAX_AGE_MS (24 hours) has elapsed since lastVerifiedAt (or lastVerifiedAt is missing).
   */
  public evaluateCacheExpiry(
    record: ServerSubscriptionRecord,
    referenceTimeMs: number = Date.now()
  ): { expired: boolean; reason?: string } {
    if (record.status !== 'active' && record.status !== 'cancelled') {
      return { expired: false };
    }

    const expiryCutoff = record.gracePeriodEnd
      ? new Date(record.gracePeriodEnd).getTime()
      : (record.currentPeriodEnd ? new Date(record.currentPeriodEnd).getTime() + 72 * 60 * 60 * 1000 : 0);

    const lastVerifiedMs = record.lastVerifiedAt ? new Date(record.lastVerifiedAt).getTime() : 0;

    if (!expiryCutoff || Number.isNaN(expiryCutoff) || referenceTimeMs > expiryCutoff) {
      record.status = 'expired';
      record.updatedAt = new Date(referenceTimeMs).toISOString();
      return { expired: true, reason: 'Billing cycle and 72-hour grace period expired.' };
    }

    if (!lastVerifiedMs || Number.isNaN(lastVerifiedMs) || referenceTimeMs - lastVerifiedMs > SUBSCRIPTION_CACHE_MAX_AGE_MS) {
      record.status = 'expired';
      record.updatedAt = new Date(referenceTimeMs).toISOString();
      return { expired: true, reason: 'Cached verification exceeded 24-hour outage TTL without live Shopify confirmation.' };
    }

    return { expired: false };
  }

  public getByUserId(userId: string): ServerSubscriptionRecord | null {
    const record = this.records.get(userId);
    if (!record) return null;

    const { expired } = this.evaluateCacheExpiry(record);
    if (expired) {
      this.records.set(userId, record);
      this.saveToDisk();
    }

    return record;
  }

  public getByEmail(email: string): ServerSubscriptionRecord | null {
    if (!email) return null;
    const lower = email.toLowerCase();
    for (const record of this.records.values()) {
      if (record.email && record.email.toLowerCase() === lower) {
        return record;
      }
    }
    return null;
  }

  public getByShopifySubscriptionId(shopifySubId: string): ServerSubscriptionRecord | null {
    if (!shopifySubId) return null;
    for (const record of this.records.values()) {
      if (record.shopifySubscriptionId === shopifySubId) {
        return record;
      }
    }
    return null;
  }

  public upsert(record: ServerSubscriptionRecord): ServerSubscriptionRecord {
    record.updatedAt = new Date().toISOString();
    this.records.set(record.userId, record);
    this.saveToDisk();
    return record;
  }

  public setStatus(
    userId: string,
    status: SubscriptionStatus,
    patch?: Partial<ServerSubscriptionRecord>,
    idToken?: string
  ): ServerSubscriptionRecord {
    const existing = this.getByUserId(userId);
    const now = new Date().toISOString();

    const existingCustomer = (existing?.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
    const incomingCustomer = (patch?.shopifyCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
    const customerChanged = Boolean(existingCustomer && incomingCustomer && existingCustomer !== incomingCustomer);

    const resolvedAnchorDay = customerChanged
      ? patch?.billingAnchorDay
      : (patch?.billingAnchorDay !== undefined ? patch.billingAnchorDay : existing?.billingAnchorDay);

    const anchorChanged = Boolean(
      existing?.billingAnchorDay !== undefined &&
      existing?.billingAnchorDay !== null &&
      resolvedAnchorDay !== undefined &&
      resolvedAnchorDay !== null &&
      existing.billingAnchorDay !== resolvedAnchorDay
    );

    const resolvedInitialOrderId = patch?.initialOrderId !== undefined
      ? patch.initialOrderId
      : (customerChanged ? undefined : existing?.initialOrderId);

    const initialOrderChanged = Boolean(
      existing?.initialOrderId &&
      resolvedInitialOrderId &&
      existing.initialOrderId !== resolvedInitialOrderId
    );

    const bindingChanged = customerChanged || anchorChanged || initialOrderChanged;
    const resolvedBindingProof = patch?.customerBindingProof !== undefined
      ? patch.customerBindingProof
      : (bindingChanged ? undefined : existing?.customerBindingProof);

    const updated: ServerSubscriptionRecord = {
      userId,
      email: patch?.email || existing?.email || '',
      status,
      planId: patch?.planId || existing?.planId || 'life-reset-monthly',
      planTitle: patch?.planTitle || existing?.planTitle || 'Life Reset Unlimited Access',
      priceIntro: 9.99,
      priceRecurring: 9.99,
      currency: 'USD',
      billingInterval: 'month',
      currentPeriodEnd: patch?.currentPeriodEnd !== undefined ? patch.currentPeriodEnd : (customerChanged ? undefined : existing?.currentPeriodEnd),
      gracePeriodEnd: patch?.gracePeriodEnd !== undefined ? patch.gracePeriodEnd : (customerChanged ? undefined : existing?.gracePeriodEnd),
      lastPaidOrderId: patch?.lastPaidOrderId !== undefined ? patch.lastPaidOrderId : (customerChanged ? patch?.shopifyOrderId : (existing?.lastPaidOrderId || patch?.shopifyOrderId || existing?.shopifyOrderId)),
      cancelAtPeriodEnd: patch?.cancelAtPeriodEnd !== undefined ? patch.cancelAtPeriodEnd : (customerChanged ? undefined : existing?.cancelAtPeriodEnd),
      shopifyCustomerId: patch?.shopifyCustomerId !== undefined ? patch.shopifyCustomerId : existing?.shopifyCustomerId,
      shopifySubscriptionId: patch?.shopifySubscriptionId !== undefined ? patch.shopifySubscriptionId : (customerChanged ? undefined : existing?.shopifySubscriptionId),
      shopifyOrderId: patch?.shopifyOrderId !== undefined ? patch.shopifyOrderId : (customerChanged ? undefined : existing?.shopifyOrderId),
      checkoutUrl: patch?.checkoutUrl !== undefined ? patch.checkoutUrl : existing?.checkoutUrl,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastVerifiedAt: now,
      ...patch,
      billingAnchorDay: resolvedAnchorDay,
      initialOrderId: resolvedInitialOrderId,
      customerBindingProof: resolvedBindingProof,
    };

    this.records.set(userId, updated);
    this.saveToDisk();

    // Persist safely to Firestore non-destructively
    this.syncToFirestore(updated, idToken).catch(err => {
      console.warn('Async Firestore sync error:', err);
    });

    return updated;
  }
}

export const subscriptionStore = new SubscriptionStore();
