import fs from 'fs';
import path from 'path';
import { ShopifyService } from './server/shopifyService';
import { subscriptionStore, SUBSCRIPTION_CACHE_MAX_AGE_MS, ServerSubscriptionRecord } from './server/subscriptionStore';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, category: string, name: string, details?: string) {
  if (condition) {
    results.push({ category, name, passed: true, details });
    console.log(`[PASS] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  } else {
    results.push({ category, name, passed: false, details });
    console.error(`[FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('BILLING ANCHOR & API OUTAGE / CACHE EXPIRY VERIFICATION SUITE');
  console.log('================================================================\n');

  // Preserve original store state & config methods
  const dataFile = path.join(process.cwd(), 'server', 'subscriptions.json');
  const originalDiskContent = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf-8') : null;
  const originalGetConfig = ShopifyService.getConfigStatus;
  const originalQueryGraphQL = ShopifyService.queryAdminGraphQL;
  const originalGetCustomerId = ShopifyService.getCustomerIdForOrder;

  const testUid = 'test-resub-outage-uid';

  try {
    // Stub config status so unit tests do not depend on live env secrets
    (ShopifyService as any).getConfigStatus = () => ({
      configured: true,
      storeDomainConfigured: true,
      storefrontTokenConfigured: true,
      variantConfigured: true,
      sellingPlanConfigured: true,
      webhookSecretConfigured: false,
      webhookDeliveryConfirmed: false,
      apiKeyConfigured: true,
      apiSecretConfigured: true,
      adminTokenConfigured: true,
      clientCredentialsActive: true,
      directVerificationActive: true,
      verificationMode: 'outbound_api',
      storeDomain: 'wv5cat-vm.myshopify.com',
      variantId: 'gid://shopify/ProductVariant/67632091955475',
      sellingPlanId: 'gid://shopify/SellingPlan/692445053203',
      missing: [],
      missingEssentialCheckout: [],
      optionalWebhookMissing: [],
      liveCheckoutEnabled: true,
    });

    // =========================================================================
    // 1. BILLING ANCHOR PERSISTENCE ON RESUBSCRIPTION
    // =========================================================================
    console.log('--- 1. BILLING ANCHOR ON RESUBSCRIPTION (DIFFERENT VS SAME CUSTOMER) ---');

    // 1A: Explicit orderOrContractId resubscription under Customer B (Nov 12) when old record was Customer A (anchor 31)
    {
      const nowIso = new Date().toISOString();
      const processedDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 12, 14, 0, 0)).toISOString();

      (ShopifyService as any).queryAdminGraphQL = async () => ({
        order: {
          id: 'gid://shopify/Order/900002',
          name: '#2002',
          displayFinancialStatus: 'PAID',
          cancelledAt: null,
          createdAt: processedDate,
          processedAt: processedDate,
          disputes: [],
          totalRefundedSet: { shopMoney: { amount: '0.00' } },
          totalPriceSet: { shopMoney: { amount: '9.99' } },
          customAttributes: [{ key: 'userId', value: testUid }],
          lineItems: {
            edges: [
              { node: { id: 'li-1', title: 'Life Reset', sellingPlan: { sellingPlanId: 'gid://shopify/SellingPlan/692445053203' } } },
            ],
          },
        },
      });
      (ShopifyService as any).getCustomerIdForOrder = async () => 'gid://shopify/Customer/222';

      const res = await ShopifyService.verifyWithShopify({
        userId: testUid,
        userEmail: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/111',
        orderOrContractId: 'gid://shopify/Order/900002',
        billingAnchorDay: 31,
      });

      assert(
        res.verified === true &&
          res.shopifyCustomerId === 'gid://shopify/Customer/222' &&
          res.billingAnchorDay === 12 &&
          res.hasActiveAccess === true,
        'BILLING ANCHOR',
        'Explicit order verification with DIFFERENT Customer ID derives new anchor (12) instead of inheriting old anchor (31)',
        `customerId=${res.shopifyCustomerId}, billingAnchorDay=${res.billingAnchorDay}`
      );
    }

    // 1B: Auto-scan resubscription under Customer B when Customer A has an expired order on file
    {
      const now = new Date();
      const oldExpiredDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4, 31, 12, 0, 0)).toISOString();
      const newResubDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12, 12, 0, 0)).toISOString();
      // Guarantee newResubDate isn't in the future beyond today if test runs before day 12; use UTC day 5 for safety
      const safeResubDay = 5;
      const safeNewResubDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), safeResubDay, 12, 0, 0)).toISOString();

      (ShopifyService as any).queryAdminGraphQL = async (query: string, vars: any) => {
        if (query.includes('getCustomerOrders')) {
          // Old Customer 111 only has an expired order from 4 months ago
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'c1',
                  node: {
                    id: 'gid://shopify/Order/900001',
                    name: '#1001',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: oldExpiredDate,
                    processedAt: oldExpiredDate,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    lineItems: {
                      edges: [{ node: { sellingPlan: { sellingPlanId: 'gid://shopify/SellingPlan/692445053203' } } }],
                    },
                  },
                },
              ],
            },
          };
        }
        if (query.includes('getRecentSubscriptionOrders')) {
          return {
            orders: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Order/900003',
                    name: '#2003',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: safeNewResubDate,
                    processedAt: safeNewResubDate,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: testUid }],
                    lineItems: {
                      edges: [{ node: { sellingPlan: { sellingPlanId: 'gid://shopify/SellingPlan/692445053203' } } }],
                    },
                  },
                },
              ],
            },
          };
        }
        return {};
      };

      (ShopifyService as any).getCustomerIdForOrder = async (orderId: string) => {
        if (orderId === 'gid://shopify/Order/900001') return 'gid://shopify/Customer/111';
        if (orderId === 'gid://shopify/Order/900003') return 'gid://shopify/Customer/222';
        return undefined;
      };

      const res = await ShopifyService.verifyWithShopify({
        userId: testUid,
        userEmail: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/111',
        billingAnchorDay: 31,
      });

      assert(
        res.verified === true &&
          res.hasActiveAccess === true &&
          res.shopifyCustomerId === 'gid://shopify/Customer/222' &&
          res.billingAnchorDay === safeResubDay,
        'BILLING ANCHOR',
        'Auto-scan does not short-circuit on old expired Customer A order and derives fresh anchor for Customer B',
        `customerId=${res.shopifyCustomerId}, anchor=${res.billingAnchorDay} (expected ${safeResubDay}, not 31)`
      );
    }

    // 1C: Store isolation - setStatus clears/replaces anchor when shopifyCustomerId changes
    {
      const nowIso = new Date().toISOString();
      const futurePeriodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      const futureGraceEnd = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString();

      subscriptionStore.setStatus(testUid, 'active', {
        email: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/111',
        shopifyOrderId: 'gid://shopify/Order/900001',
        lastPaidOrderId: 'gid://shopify/Order/900001',
        billingAnchorDay: 31,
        currentPeriodEnd: futurePeriodEnd,
        gracePeriodEnd: futureGraceEnd,
      });

      // Resubscribe under Customer 222 without passing anchor (or passing new anchor 12)
      const updatedNoAnchor = subscriptionStore.setStatus(testUid, 'active', {
        email: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/222',
        shopifyOrderId: 'gid://shopify/Order/900003',
        billingAnchorDay: undefined,
      });

      const updatedNewAnchor = subscriptionStore.setStatus(testUid, 'active', {
        email: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/333',
        shopifyOrderId: 'gid://shopify/Order/900004',
        billingAnchorDay: 12,
      });

      assert(
        updatedNoAnchor.billingAnchorDay === undefined &&
          updatedNoAnchor.currentPeriodEnd === undefined &&
          updatedNewAnchor.billingAnchorDay === 12 &&
          updatedNewAnchor.shopifyCustomerId === 'gid://shopify/Customer/333',
        'BILLING ANCHOR',
        'subscriptionStore.setStatus resets old anchor and period timestamps when Shopify Customer ID changes',
        `clearedOnSwitch=${updatedNoAnchor.billingAnchorDay === undefined}, newAnchor=${updatedNewAnchor.billingAnchorDay}`
      );
    }

    // 1D: Same customer renewal STILL preserves billingAnchorDay (31)
    {
      const recentFeb28 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      (ShopifyService as any).queryAdminGraphQL = async () => ({
        orders: {
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              cursor: 'c1',
              node: {
                id: 'gid://shopify/Order/900010',
                name: '#1010',
                displayFinancialStatus: 'PAID',
                cancelledAt: null,
                createdAt: recentFeb28,
                processedAt: recentFeb28,
                disputes: [],
                totalRefundedSet: { shopMoney: { amount: '0.00' } },
                totalPriceSet: { shopMoney: { amount: '9.99' } },
                lineItems: {
                  edges: [{ node: { sellingPlan: { sellingPlanId: 'gid://shopify/SellingPlan/692445053203' } } }],
                },
              },
            },
          ],
        },
      });
      (ShopifyService as any).getCustomerIdForOrder = async () => 'gid://shopify/Customer/111';

      const res = await ShopifyService.verifyWithShopify({
        userId: testUid,
        userEmail: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/111',
        billingAnchorDay: 31,
      });

      assert(
        res.verified === true && res.shopifyCustomerId === 'gid://shopify/Customer/111' && res.billingAnchorDay === 31,
        'BILLING ANCHOR',
        'Same Customer ID renewal still preserves existing billingAnchorDay (31)',
        `customerId=${res.shopifyCustomerId}, anchor=${res.billingAnchorDay}`
      );
    }

    // =========================================================================
    // 2. API OUTAGE BEHAVIOR & BOUNDED CACHE EXPIRY POLICY
    // =========================================================================
    console.log('\n--- 2. API OUTAGE BEHAVIOR & CACHE EXPIRY POLICY ---');

    // 2A: Shopify Admin API outage sets error: true and fail-closed hasActiveAccess: false
    {
      (ShopifyService as any).queryAdminGraphQL = async () => {
        throw new Error('503 Service Unavailable (simulated Shopify Admin API outage)');
      };

      const outageRes = await ShopifyService.verifyWithShopify({
        userId: testUid,
        userEmail: 'test@example.com',
        shopifyCustomerId: 'gid://shopify/Customer/111',
        billingAnchorDay: 31,
      });

      assert(
        outageRes.verified === false && outageRes.error === true && outageRes.hasActiveAccess === false,
        'API OUTAGE',
        'verifyWithShopify flags error=true and fails closed (hasActiveAccess=false) on Shopify Admin API outage',
        `verified=${outageRes.verified}, error=${outageRes.error}, hasActiveAccess=${outageRes.hasActiveAccess}`
      );
    }

    // 2B: Cache expiry within 24h TTL & valid grace period stays non-expired in cache
    {
      const nowMs = Date.now();
      const record: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        currentPeriodEnd: new Date(nowMs + 20 * 24 * 60 * 60 * 1000).toISOString(),
        gracePeriodEnd: new Date(nowMs + 23 * 24 * 60 * 60 * 1000).toISOString(),
        lastVerifiedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        createdAt: new Date(nowMs - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
      };

      const check = subscriptionStore.evaluateCacheExpiry(record, nowMs);
      assert(
        check.expired === false && record.status === 'active',
        'CACHE EXPIRY',
        'Cache record within 24h TTL and within gracePeriodEnd stays valid in store',
        `expired=${check.expired}, status=${record.status}`
      );
    }

    // 2C: Cache expiry triggers at >24h without live verification EVEN if currentPeriodEnd is 20 days away
    {
      const nowMs = Date.now();
      const record: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        currentPeriodEnd: new Date(nowMs + 20 * 24 * 60 * 60 * 1000).toISOString(),
        gracePeriodEnd: new Date(nowMs + 23 * 24 * 60 * 60 * 1000).toISOString(),
        lastVerifiedAt: new Date(nowMs - (SUBSCRIPTION_CACHE_MAX_AGE_MS + 60 * 60 * 1000)).toISOString(), // 25 hours ago
        createdAt: new Date(nowMs - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(nowMs - 25 * 60 * 60 * 1000).toISOString(),
      };

      const check = subscriptionStore.evaluateCacheExpiry(record, nowMs);
      assert(
        check.expired === true && record.status === 'expired',
        'CACHE EXPIRY',
        'Cache expires after 24h without live Shopify confirmation even when billing period has not ended',
        `expired=${check.expired}, status=${record.status}, reason="${check.reason}"`
      );
    }

    // 2D: Cache expiry triggers when billing cycle + 72h grace period has elapsed even if lastVerifiedAt is recent
    {
      const nowMs = Date.now();
      const record: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        currentPeriodEnd: new Date(nowMs - 80 * 60 * 60 * 1000).toISOString(),
        gracePeriodEnd: new Date(nowMs - 8 * 60 * 60 * 1000).toISOString(), // Expired 8h ago
        lastVerifiedAt: new Date(nowMs - 60 * 60 * 1000).toISOString(), // 1h ago
        createdAt: new Date(nowMs - 40 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
      };

      const check = subscriptionStore.evaluateCacheExpiry(record, nowMs);
      assert(
        check.expired === true && record.status === 'expired',
        'CACHE EXPIRY',
        'Cache expires when gracePeriodEnd has elapsed even if lastVerifiedAt is recent',
        `expired=${check.expired}, status=${record.status}`
      );
    }

    // 2E: Cache fails safe if period timestamps or lastVerifiedAt are missing
    {
      const nowMs = Date.now();
      const missingLastVerified: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        currentPeriodEnd: new Date(nowMs + 10 * 24 * 60 * 60 * 1000).toISOString(),
        gracePeriodEnd: new Date(nowMs + 13 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(nowMs).toISOString(),
        updatedAt: new Date(nowMs).toISOString(),
      };
      const missingPeriods: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        lastVerifiedAt: new Date(nowMs).toISOString(),
        createdAt: new Date(nowMs).toISOString(),
        updatedAt: new Date(nowMs).toISOString(),
      };

      const c1 = subscriptionStore.evaluateCacheExpiry(missingLastVerified, nowMs);
      const c2 = subscriptionStore.evaluateCacheExpiry(missingPeriods, nowMs);
      assert(
        c1.expired === true && missingLastVerified.status === 'expired' &&
          c2.expired === true && missingPeriods.status === 'expired',
        'CACHE EXPIRY',
        'Cache fails safe (expires) when lastVerifiedAt or period bounds are missing',
        `missingLastVerified=${c1.expired}, missingPeriods=${c2.expired}`
      );
    }

    // 2F: getByUserId automatically expires stale active records from disk/memory
    {
      const staleRecord: ServerSubscriptionRecord = {
        userId: testUid,
        email: 'test@example.com',
        status: 'active',
        planId: 'life-reset-monthly',
        planTitle: 'Life Reset Unlimited Access',
        priceIntro: 9.99,
        priceRecurring: 9.99,
        currency: 'USD',
        billingInterval: 'month',
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        gracePeriodEnd: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        lastVerifiedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      };
      (subscriptionStore as any).records.set(testUid, staleRecord);
      const fetched = subscriptionStore.getByUserId(testUid);
      assert(
        fetched?.status === 'expired',
        'CACHE EXPIRY',
        'subscriptionStore.getByUserId automatically downgrades stale (>24h) cached active records to expired',
        `status=${fetched?.status}`
      );
    }
  } finally {
    // Restore original methods & original subscriptions.json cleanly
    (ShopifyService as any).getConfigStatus = originalGetConfig;
    (ShopifyService as any).queryAdminGraphQL = originalQueryGraphQL;
    (ShopifyService as any).getCustomerIdForOrder = originalGetCustomerId;

    (subscriptionStore as any).records.clear();
    if (originalDiskContent !== null) {
      fs.writeFileSync(dataFile, originalDiskContent, 'utf-8');
      const parsed = JSON.parse(originalDiskContent) as Record<string, ServerSubscriptionRecord>;
      for (const [k, v] of Object.entries(parsed)) {
        (subscriptionStore as any).records.set(k, v);
      }
    }
  }

  console.log('\n================================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
