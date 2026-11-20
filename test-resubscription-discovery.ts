import fs from 'fs';
import path from 'path';
import { ShopifyService } from './server/shopifyService';
import { subscriptionStore } from './server/subscriptionStore';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];
const PLAN_ID = 'gid://shopify/SellingPlan/692445053203';

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`[PASS] ${name}${details ? ` -> ${details}` : ''}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('LIFE RESET: SECURE RESUBSCRIPTION DISCOVERY & HMAC BINDING TEST SUITE');
  console.log('========================================================================\n');

  const dataFile = path.join(process.cwd(), 'server', 'subscriptions.json');
  const originalDiskContent = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf-8') : null;
  const originalGetConfig = ShopifyService.getConfigStatus;
  const originalQueryGraphQL = ShopifyService.queryAdminGraphQL;
  const originalGetCustomerId = ShopifyService.getCustomerIdForOrder;
  const originalBindingSecret = process.env.SUBSCRIPTION_BINDING_SECRET;

  process.env.SUBSCRIPTION_BINDING_SECRET = 'unit-test-binding-secret-32bytes-minimum';

  const firebaseUid = 'firebase-uid-resub-001';
  const customerA = 'gid://shopify/Customer/100001';
  const customerB = 'gid://shopify/Customer/200002';
  const victimCustomer = 'gid://shopify/Customer/999999';

  try {
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
      sellingPlanId: PLAN_ID,
      missing: [],
      missingEssentialCheckout: [],
      optionalWebhookMissing: [],
      liveCheckoutEnabled: true,
    });

    // =========================================================================
    // SCENARIOS 1 - 5: Customer A expired -> Customer B initial order on Page 2
    //                  (also expired Cycle 1) -> Customer B active renewal
    //                  (no Firebase UID attr) -> grants access with B's initial anchor
    // =========================================================================
    {
      const now = Date.now();
      const customerAExpiredAt = new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString();
      // Customer B initial order was placed 45 days ago on day 31 (use exact past ISO >35 days ago on day 31, or synthetic clock?
      // Since verifyWithShopify uses Date.now(), pick exact real UTC calendar timestamps relative to today so Cycle 1 is >35d ago
      // AND Cycle 2 is 5 days ago, AND verify O_B1 anchor day is distinct from Customer A (anchor 10) and O_B2 processed day!)
      // Compute a date ~45 days ago whose UTC date !== O_B2's UTC date and !== 10 (Customer A's anchor):
      const b1DateObj = new Date(now - 42 * 24 * 60 * 60 * 1000);
      const b2DateObj = new Date(now - 5 * 24 * 60 * 60 * 1000);
      // Ensure b1Anchor !== b2Day and b1Anchor !== 10 (shift by 1 day if needed)
      if (b1DateObj.getUTCDate() === b2DateObj.getUTCDate() || b1DateObj.getUTCDate() === 10) {
        b1DateObj.setUTCDate(b1DateObj.getUTCDate() - 1);
      }
      if (b1DateObj.getUTCDate() === b2DateObj.getUTCDate() || b1DateObj.getUTCDate() === 10) {
        b1DateObj.setUTCDate(b1DateObj.getUTCDate() - 1);
      }
      const customerBInitialIso = b1DateObj.toISOString();
      const expectedAnchorB = b1DateObj.getUTCDate();
      const customerBRenewalIso = b2DateObj.toISOString();
      const expectedRenewalPeriodEnd = ShopifyService.calculateBillingCyclePeriods(
        customerBRenewalIso,
        72,
        expectedAnchorB
      ).currentPeriodEnd;

      const customerAInitialOrderId = 'gid://shopify/Order/10001';
      const customerBInitialOrderId = 'gid://shopify/Order/20001';
      const customerBRenewalOrderId = 'gid://shopify/Order/20002';

      const customerAProof = ShopifyService.signCustomerBinding({
        firebaseUid,
        shopifyCustomerId: customerA,
        initialOrderId: customerAInitialOrderId,
        billingAnchorDay: 10,
      });

      const restLookups: string[] = [];
      let sawPageSize50 = false;
      const storeScanCursors: Array<string | null | undefined> = [];

      (ShopifyService as any).queryAdminGraphQL = async (query: string, vars: any) => {
        if (query.includes('getCustomerOrders')) {
          if (vars?.query === 'customer_id:100001') {
            return {
              orders: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    cursor: 'ca1',
                    node: {
                      id: customerAInitialOrderId,
                      name: '#A1',
                      displayFinancialStatus: 'PAID',
                      cancelledAt: null,
                      createdAt: customerAExpiredAt,
                      processedAt: customerAExpiredAt,
                      disputes: [],
                      totalRefundedSet: { shopMoney: { amount: '0.00' } },
                      totalPriceSet: { shopMoney: { amount: '9.99' } },
                      lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                    },
                  },
                ],
              },
            };
          }
          if (vars?.query === 'customer_id:200002') {
            // Scenario 3: Recurring order is active WITHOUT customAttributes / userId
            return {
              orders: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    cursor: 'cb2',
                    node: {
                      id: customerBRenewalOrderId,
                      name: '#B2',
                      displayFinancialStatus: 'PAID',
                      cancelledAt: null,
                      createdAt: customerBRenewalIso,
                      processedAt: customerBRenewalIso,
                      disputes: [],
                      totalRefundedSet: { shopMoney: { amount: '0.00' } },
                      totalPriceSet: { shopMoney: { amount: '9.99' } },
                      // Intentionally no customAttributes on recurring order!
                      lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                    },
                  },
                ],
              },
            };
          }
        }

        if (query.includes('getRecentSubscriptionOrders')) {
          if (query.includes('first: 50')) sawPageSize50 = true;
          storeScanCursors.push(vars?.after);

          if (!vars?.after) {
            // Page 1: 50 unrelated orders belonging to other users (should NEVER trigger getCustomerIdForOrder)
            const unrelatedEdges = Array.from({ length: 50 }, (_, idx) => ({
              cursor: `p1_${idx}`,
              node: {
                id: `gid://shopify/Order/500${idx}`,
                name: `#U${idx}`,
                displayFinancialStatus: 'PAID',
                cancelledAt: null,
                createdAt: customerBRenewalIso,
                processedAt: customerBRenewalIso,
                disputes: [],
                totalRefundedSet: { shopMoney: { amount: '0.00' } },
                totalPriceSet: { shopMoney: { amount: '9.99' } },
                customAttributes: [{ key: 'userId', value: `other-user-${idx}` }],
                lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
              },
            }));
            return {
              orders: {
                pageInfo: { hasNextPage: true, endCursor: 'store_page_2_cursor' },
                edges: unrelatedEdges,
              },
            };
          }

          if (vars?.after === 'store_page_2_cursor') {
            // Page 2: Customer B's initial paid order WITH Firebase UID (expired Cycle 1)
            return {
              orders: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    cursor: 'p2_b1',
                    node: {
                      id: customerBInitialOrderId,
                      name: '#B1',
                      displayFinancialStatus: 'PAID',
                      cancelledAt: null,
                      createdAt: customerBInitialIso,
                      processedAt: customerBInitialIso,
                      disputes: [],
                      totalRefundedSet: { shopMoney: { amount: '0.00' } },
                      totalPriceSet: { shopMoney: { amount: '9.99' } },
                      customAttributes: [{ key: 'userId', value: firebaseUid }],
                      lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                    },
                  },
                ],
              },
            };
          }
        }
        return { orders: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] } };
      };

      (ShopifyService as any).getCustomerIdForOrder = async (orderId: string) => {
        restLookups.push(orderId);
        if (orderId === customerAInitialOrderId) return customerA;
        if (orderId === customerBInitialOrderId || orderId === customerBRenewalOrderId) return customerB;
        return undefined;
      };

      const res = await ShopifyService.verifyWithShopify({
        userId: firebaseUid,
        userEmail: 'user@example.com',
        shopifyCustomerId: customerA,
        initialOrderId: customerAInitialOrderId,
        customerBindingProof: customerAProof,
        billingAnchorDay: 10,
      });

      assert(
        sawPageSize50 &&
          storeScanCursors.length === 2 &&
          storeScanCursors[1] === 'store_page_2_cursor' &&
          !restLookups.some(id => id.startsWith('gid://shopify/Order/500')),
        'Scenarios 1-2: Paginated store scan (50/page) locates Customer B initial order on page 2 without REST N+1 calls on non-matching orders',
        `cursors=${JSON.stringify(storeScanCursors)}, restLookups=${JSON.stringify(restLookups)}`
      );

      assert(
        res.verified === true &&
          res.hasActiveAccess === true &&
          res.status === 'active' &&
          res.shopifyCustomerId === customerB &&
          res.shopifyOrderId === customerBRenewalOrderId &&
          res.initialOrderId === customerBInitialOrderId &&
          Boolean(res.customerBindingProof),
        'Scenarios 3-4: Two-hop discovery links Customer B active recurring order (without UID attr) and generates new HMAC binding proof',
        `customer=${res.shopifyCustomerId}, order=${res.shopifyOrderId}, initialOrder=${res.initialOrderId}, proofValid=${ShopifyService.verifyCustomerBinding({
          firebaseUid,
          shopifyCustomerId: res.shopifyCustomerId,
          initialOrderId: res.initialOrderId,
          billingAnchorDay: res.billingAnchorDay,
          proof: res.customerBindingProof,
        })}`
      );

      assert(
        res.billingAnchorDay === expectedAnchorB &&
          res.billingAnchorDay !== 10 &&
          res.currentPeriodEnd === expectedRenewalPeriodEnd,
        'Scenario 5: Customer B billing anchor is derived from Customer B initial order (not Customer A anchor 10 or O_B2 day)',
        `anchor=${res.billingAnchorDay} (expected ${expectedAnchorB}, B2 day=${b2DateObj.getUTCDate()}), currentPeriodEnd=${res.currentPeriodEnd}`
      );
    }

    // =========================================================================
    // SCENARIO 6: Forged Firestore shopifyCustomerId without valid HMAC proof
    // =========================================================================
    {
      const attackerUid = 'attacker-uid-000';
      const victimActiveIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      let victimCustomerQueried = false;

      (ShopifyService as any).queryAdminGraphQL = async (query: string, vars: any) => {
        if (query.includes('getCustomerOrders') && vars?.query === 'customer_id:999999') {
          victimCustomerQueried = true;
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'v1',
                  node: {
                    id: 'gid://shopify/Order/999001',
                    name: '#V1',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: victimActiveIso,
                    processedAt: victimActiveIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        return { orders: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] } };
      };
      (ShopifyService as any).getCustomerIdForOrder = async () => victimCustomer;

      const noProofRes = await ShopifyService.verifyWithShopify({
        userId: attackerUid,
        userEmail: 'attacker@example.com',
        shopifyCustomerId: victimCustomer,
        initialOrderId: 'gid://shopify/Order/999001',
        billingAnchorDay: 15,
      });

      const forgedHexProof = 'a'.repeat(64);
      const forgedProofRes = await ShopifyService.verifyWithShopify({
        userId: attackerUid,
        userEmail: 'attacker@example.com',
        shopifyCustomerId: victimCustomer,
        initialOrderId: 'gid://shopify/Order/999001',
        customerBindingProof: forgedHexProof,
        billingAnchorDay: 15,
      });

      assert(
        !victimCustomerQueried &&
          noProofRes.verified === false &&
          noProofRes.hasActiveAccess === false &&
          forgedProofRes.verified === false &&
          forgedProofRes.hasActiveAccess === false,
        'Scenario 6: Forged Firestore customer ID (missing or fake HMAC proof) never queries victim orders and denies access',
        `victimCustomerQueried=${victimCustomerQueried}, noProofAccess=${noProofRes.hasActiveAccess}, forgedAccess=${forgedProofRes.hasActiveAccess}`
      );
    }

    // =========================================================================
    // SCENARIO 7: Invalid or legacy proof triggers Shopify ownership rediscovery
    // =========================================================================
    {
      const legacyUid = 'legacy-uid-777';
      const legacyCustomer = 'gid://shopify/Customer/777777';
      const legacyInitOrder = 'gid://shopify/Order/777001';
      const legacyInitIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const legacyRenewalOrder = 'gid://shopify/Order/777002';
      const legacyRenewalIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      let step2TrustSkippedBeforeRediscovery = true;
      let sawStepBScan = false;

      (ShopifyService as any).queryAdminGraphQL = async (query: string, vars: any) => {
        if (query.includes('getCustomerOrders')) {
          if (!sawStepBScan) {
            // If Step 2 blindly ran BEFORE Step B rediscovery, fail the check!
            step2TrustSkippedBeforeRediscovery = false;
          }
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'l2',
                  node: {
                    id: legacyRenewalOrder,
                    name: '#L2',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: legacyRenewalIso,
                    processedAt: legacyRenewalIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        if (query.includes('getRecentSubscriptionOrders')) {
          sawStepBScan = true;
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'l1',
                  node: {
                    id: legacyInitOrder,
                    name: '#L1',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: legacyInitIso,
                    processedAt: legacyInitIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: legacyUid }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        return {};
      };
      (ShopifyService as any).getCustomerIdForOrder = async () => legacyCustomer;

      const legacyRes = await ShopifyService.verifyWithShopify({
        userId: legacyUid,
        userEmail: 'legacy@example.com',
        shopifyCustomerId: legacyCustomer,
        // Legacy record has no customerBindingProof
        billingAnchorDay: 5,
      });

      const validNewProof = ShopifyService.verifyCustomerBinding({
        firebaseUid: legacyUid,
        shopifyCustomerId: legacyRes.shopifyCustomerId,
        initialOrderId: legacyRes.initialOrderId,
        billingAnchorDay: legacyRes.billingAnchorDay,
        proof: legacyRes.customerBindingProof,
      });

      assert(
        step2TrustSkippedBeforeRediscovery &&
          sawStepBScan &&
          legacyRes.verified === true &&
          legacyRes.hasActiveAccess === true &&
          legacyRes.initialOrderId === legacyInitOrder &&
          validNewProof,
        'Scenario 7: Invalid/legacy proof skips blind Step 2 lookup, rediscovers initial order on Shopify, and mints valid HMAC proof',
        `skippedUnprovedStep2=${step2TrustSkippedBeforeRediscovery}, sawStepB=${sawStepBScan}, newProofValid=${validNewProof}`
      );
    }

    // =========================================================================
    // SCENARIO 8: Refunded, unpaid, cancelled, and chargeback orders remain ineligible
    // =========================================================================
    {
      const badUid = 'bad-orders-uid';
      const recentIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      (ShopifyService as any).queryAdminGraphQL = async (query: string) => {
        if (query.includes('getRecentSubscriptionOrders')) {
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'bad1',
                  node: {
                    id: 'gid://shopify/Order/800001',
                    displayFinancialStatus: 'REFUNDED',
                    cancelledAt: null,
                    createdAt: recentIso,
                    processedAt: recentIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '9.99' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: badUid }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
                {
                  cursor: 'bad2',
                  node: {
                    id: 'gid://shopify/Order/800002',
                    displayFinancialStatus: 'UNPAID',
                    cancelledAt: null,
                    createdAt: recentIso,
                    processedAt: recentIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: badUid }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
                {
                  cursor: 'bad3',
                  node: {
                    id: 'gid://shopify/Order/800003',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: recentIso,
                    cancelReason: 'CUSTOMER',
                    createdAt: recentIso,
                    processedAt: recentIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: badUid }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
                {
                  cursor: 'bad4',
                  node: {
                    id: 'gid://shopify/Order/800004',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: recentIso,
                    processedAt: recentIso,
                    disputes: [{ id: 'dp1', initiatedAs: 'CHARGEBACK', status: 'LOST' }],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: badUid }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        return {};
      };
      (ShopifyService as any).getCustomerIdForOrder = async () => 'gid://shopify/Customer/888';

      const badRes = await ShopifyService.verifyWithShopify({
        userId: badUid,
        userEmail: 'bad@example.com',
      });

      assert(
        badRes.verified === false && badRes.hasActiveAccess === false,
        'Scenario 8: Fully refunded, unpaid, cancelled, and chargeback orders remain ineligible',
        `verified=${badRes.verified}, hasActiveAccess=${badRes.hasActiveAccess}`
      );
    }

    // =========================================================================
    // SCENARIO 9: Pagination stops strictly at configured max pages (10 pages)
    // =========================================================================
    {
      let scanPagesFetched = 0;

      (ShopifyService as any).queryAdminGraphQL = async (query: string, vars: any) => {
        if (query.includes('getRecentSubscriptionOrders')) {
          scanPagesFetched++;
          return {
            orders: {
              // Simulate infinite store history always claiming more pages
              pageInfo: { hasNextPage: true, endCursor: `cursor_page_${scanPagesFetched + 1}` },
              edges: [
                {
                  cursor: `e_${scanPagesFetched}`,
                  node: {
                    id: `gid://shopify/Order/990${scanPagesFetched}`,
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: new Date().toISOString(),
                    processedAt: new Date().toISOString(),
                    disputes: [],
                    customAttributes: [{ key: 'userId', value: 'someone-else' }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        return {};
      };

      const capRes = await ShopifyService.verifyWithShopify({
        userId: 'nonexistent-user-uid',
        userEmail: 'none@example.com',
      });

      assert(
        scanPagesFetched === ShopifyService.INITIAL_ORDER_SCAN_MAX_PAGES &&
          capRes.verified === false &&
          capRes.hasActiveAccess === false,
        'Scenario 9: Store initial-order pagination stops strictly at configured 10-page limit (500 orders max)',
        `pagesFetched=${scanPagesFetched} (max=${ShopifyService.INITIAL_ORDER_SCAN_MAX_PAGES})`
      );
    }

    // =========================================================================
    // SCENARIO 10: API failures do not accidentally grant access (initial scan & Hop 2)
    // =========================================================================
    {
      const uid10 = 'outage-hop2-uid';
      const oldExpiredIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

      // 10A: Step B finds expired O_B1, then Hop 2 verifyCustomerRecurringOrders throws 503
      (ShopifyService as any).queryAdminGraphQL = async (query: string) => {
        if (query.includes('getRecentSubscriptionOrders')) {
          return {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  cursor: 'o1',
                  node: {
                    id: 'gid://shopify/Order/10101',
                    name: '#O1',
                    displayFinancialStatus: 'PAID',
                    cancelledAt: null,
                    createdAt: oldExpiredIso,
                    processedAt: oldExpiredIso,
                    disputes: [],
                    totalRefundedSet: { shopMoney: { amount: '0.00' } },
                    totalPriceSet: { shopMoney: { amount: '9.99' } },
                    customAttributes: [{ key: 'userId', value: uid10 }],
                    lineItems: { edges: [{ node: { sellingPlan: { sellingPlanId: PLAN_ID } } }] },
                  },
                },
              ],
            },
          };
        }
        if (query.includes('getCustomerOrders')) {
          throw new Error('503 Shopify Admin API timeout during Hop 2 recurring lookup');
        }
        return {};
      };
      (ShopifyService as any).getCustomerIdForOrder = async () => 'gid://shopify/Customer/10101';

      const hop2Outage = await ShopifyService.verifyWithShopify({
        userId: uid10,
        userEmail: 'outage@example.com',
      });

      assert(
        hop2Outage.verified === false && hop2Outage.error === true && hop2Outage.hasActiveAccess === false,
        'Scenario 10: API outage during two-hop Customer B recurring lookup fails closed (no access granted)',
        `verified=${hop2Outage.verified}, error=${hop2Outage.error}, hasActiveAccess=${hop2Outage.hasActiveAccess}`
      );
    }

    // =========================================================================
    // BONUS CHECK: Store clears old proof & initialOrderId on customer/anchor switch
    // =========================================================================
    {
      const uidStore = 'test-store-proof-isolation';
      const proofA = ShopifyService.signCustomerBinding({
        firebaseUid: uidStore,
        shopifyCustomerId: customerA,
        initialOrderId: 'gid://shopify/Order/111',
        billingAnchorDay: 10,
      });

      subscriptionStore.setStatus(uidStore, 'active', {
        email: 'store@example.com',
        shopifyCustomerId: customerA,
        initialOrderId: 'gid://shopify/Order/111',
        customerBindingProof: proofA,
        billingAnchorDay: 10,
      });

      const switched = subscriptionStore.setStatus(uidStore, 'active', {
        email: 'store@example.com',
        shopifyCustomerId: customerB,
        billingAnchorDay: 22,
      });

      assert(
        switched.customerBindingProof === undefined &&
          switched.initialOrderId === undefined &&
          switched.billingAnchorDay === 22,
        'Store isolation: Switching Shopify Customer ID clears old customerBindingProof and initialOrderId',
        `proofCleared=${switched.customerBindingProof === undefined}, initialOrderCleared=${switched.initialOrderId === undefined}`
      );
    }
  } finally {
    (ShopifyService as any).getConfigStatus = originalGetConfig;
    (ShopifyService as any).queryAdminGraphQL = originalQueryGraphQL;
    (ShopifyService as any).getCustomerIdForOrder = originalGetCustomerId;

    if (originalBindingSecret === undefined) {
      delete process.env.SUBSCRIPTION_BINDING_SECRET;
    } else {
      process.env.SUBSCRIPTION_BINDING_SECRET = originalBindingSecret;
    }

    (subscriptionStore as any).records.clear();
    if (originalDiskContent !== null) {
      fs.writeFileSync(dataFile, originalDiskContent, 'utf-8');
      const parsed = JSON.parse(originalDiskContent);
      for (const [k, v] of Object.entries(parsed)) {
        (subscriptionStore as any).records.set(k, v);
      }
    }
  }

  console.log('\n========================================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
