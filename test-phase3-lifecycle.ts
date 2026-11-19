import { ShopifyService } from './server/shopifyService';
import { subscriptionStore } from './server/subscriptionStore';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`[PASS] ${name}${details ? ` -> ${details}` : ''}`);
  } else {
    results.push({ name, passed: false, details, error: 'Assertion failed' });
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('LIFE RESET PHASE 3: SUBSCRIPTION LIFECYCLE TEST SUITE');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test Case 1: Jan 31 to Feb 28 (non-leap year, e.g. 2025 or 2026)
  // -------------------------------------------------------------------------
  try {
    const jan31NonLeap = new Date(Date.UTC(2026, 0, 31, 14, 30, 0)); // 2026-01-31 14:30:00 UTC
    const feb28Result = ShopifyService.addOneCalendarMonthUtc(jan31NonLeap);

    const year = feb28Result.getUTCFullYear();
    const month = feb28Result.getUTCMonth(); // 1 = Feb
    const day = feb28Result.getUTCDate();
    const hours = feb28Result.getUTCHours();
    const minutes = feb28Result.getUTCMinutes();

    const isExactFeb28 = year === 2026 && month === 1 && day === 28 && hours === 14 && minutes === 30;
    assert(
      isExactFeb28,
      'Test Case 1: Jan 31 to Feb 28 (non-leap year)',
      `2026-01-31T14:30:00Z -> ${feb28Result.toISOString()} (Year: ${year}, Month: ${month + 1}, Day: ${day})`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 1: Jan 31 to Feb 28', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 2: Jan 31 to Feb 29 in a leap year (e.g. 2024 or 2028)
  // -------------------------------------------------------------------------
  try {
    const jan31Leap = new Date(Date.UTC(2024, 0, 31, 9, 15, 0)); // 2024-01-31 09:15:00 UTC
    const feb29Result = ShopifyService.addOneCalendarMonthUtc(jan31Leap);

    const year = feb29Result.getUTCFullYear();
    const month = feb29Result.getUTCMonth(); // 1 = Feb
    const day = feb29Result.getUTCDate();
    const hours = feb29Result.getUTCHours();
    const minutes = feb29Result.getUTCMinutes();

    const isExactFeb29 = year === 2024 && month === 1 && day === 29 && hours === 9 && minutes === 15;
    assert(
      isExactFeb29,
      'Test Case 2: Jan 31 to Feb 29 in a leap year',
      `2024-01-31T09:15:00Z -> ${feb29Result.toISOString()} (Year: ${year}, Month: ${month + 1}, Day: ${day})`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 2: Jan 31 to Feb 29 leap year', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 3: Aug 31 to Sep 30
  // -------------------------------------------------------------------------
  try {
    const aug31 = new Date(Date.UTC(2026, 7, 31, 23, 59, 0)); // 2026-08-31 23:59:00 UTC
    const sep30Result = ShopifyService.addOneCalendarMonthUtc(aug31);

    const year = sep30Result.getUTCFullYear();
    const month = sep30Result.getUTCMonth(); // 8 = Sep
    const day = sep30Result.getUTCDate();
    const hours = sep30Result.getUTCHours();
    const minutes = sep30Result.getUTCMinutes();

    const isExactSep30 = year === 2026 && month === 8 && day === 30 && hours === 23 && minutes === 59;
    assert(
      isExactSep30,
      'Test Case 3: Aug 31 to Sep 30',
      `2026-08-31T23:59:00Z -> ${sep30Result.toISOString()} (Year: ${year}, Month: ${month + 1}, Day: ${day})`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 3: Aug 31 to Sep 30', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 4: Successful renewal
  // -------------------------------------------------------------------------
  try {
    // Initial order was 2026-01-15T12:00:00Z
    // Renewal order occurs on 2026-02-15T12:00:00Z
    const renewalOrder = {
      id: 'gid://shopify/Order/900000000001',
      name: '#1002',
      displayFinancialStatus: 'PAID',
      processedAt: '2026-02-15T12:00:00Z',
      createdAt: '2026-02-15T12:00:00Z',
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '0.00' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // Evaluated on 2026-02-20 (5 days into the renewed cycle)
    const refTime = new Date('2026-02-20T12:00:00Z').getTime();
    const lifecycle = ShopifyService.evaluateOrderSubscriptionLifecycle(renewalOrder, refTime);

    const renewalValid =
      lifecycle.eligible &&
      lifecycle.status === 'active' &&
      lifecycle.hasActiveAccess === true &&
      lifecycle.currentPeriodEnd === '2026-03-15T12:00:00.000Z' &&
      lifecycle.gracePeriodEnd === '2026-03-18T12:00:00.000Z';

    assert(
      renewalValid,
      'Test Case 4: Successful renewal',
      `Order processed 2026-02-15, periodEnd: ${lifecycle.currentPeriodEnd}, graceEnd: ${lifecycle.gracePeriodEnd}, hasActiveAccess: ${lifecycle.hasActiveAccess}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 4: Successful renewal', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 5: Cancelled subscription with remaining paid time
  // -------------------------------------------------------------------------
  try {
    // Customer subscribed on 2026-01-15 (paid until 2026-02-15).
    // User cancels the recurring subscription in their account on 2026-01-20.
    // In our system, the paid order covers them through 2026-02-15.
    const activePaidOrder = {
      id: 'gid://shopify/Order/900000000002',
      name: '#1003',
      displayFinancialStatus: 'PAID',
      processedAt: '2026-01-15T10:00:00Z',
      createdAt: '2026-01-15T10:00:00Z',
      cancelledAt: null, // Note: Order payment was not cancelled, recurring subscription cancelled
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '0.00' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // Reference time is 2026-01-25 (mid-billing period, after cancellation)
    const midPeriodRefTime = new Date('2026-01-25T10:00:00Z').getTime();
    const lifecycle = ShopifyService.evaluateOrderSubscriptionLifecycle(activePaidOrder, midPeriodRefTime);

    // Save record with cancelled status but active period
    const testUserId = 'test-cancelled-user-' + Date.now();
    subscriptionStore.setStatus(testUserId, 'cancelled', {
      email: 'test@example.com',
      currentPeriodEnd: lifecycle.currentPeriodEnd,
      gracePeriodEnd: lifecycle.gracePeriodEnd,
      lastPaidOrderId: activePaidOrder.id,
      cancelAtPeriodEnd: true,
    });

    const storeRecord = subscriptionStore.getByUserId(testUserId);
    const hasRemainingPaidTime =
      lifecycle.hasActiveAccess === true &&
      midPeriodRefTime < new Date(storeRecord!.currentPeriodEnd!).getTime();

    assert(
      hasRemainingPaidTime,
      'Test Case 5: Cancelled subscription with remaining paid time',
      `Cancelled status preserved, but hasActiveAccess is true until ${lifecycle.currentPeriodEnd}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 5: Cancelled subscription with remaining paid time', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 6: Failed renewal followed by 72-hour grace expiry
  // -------------------------------------------------------------------------
  try {
    // Order processed on 2026-01-15T00:00:00Z
    // currentPeriodEnd: 2026-02-15T00:00:00Z
    // gracePeriodEnd: 2026-02-18T00:00:00Z (+72 hours)
    const originalOrder = {
      id: 'gid://shopify/Order/900000000003',
      name: '#1004',
      displayFinancialStatus: 'PAID',
      processedAt: '2026-01-15T00:00:00Z',
      createdAt: '2026-01-15T00:00:00Z',
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '0.00' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // Subtest 6A: During 72-hour grace (2026-02-16T12:00:00Z - 36 hours into grace)
    const duringGraceRefTime = new Date('2026-02-16T12:00:00Z').getTime();
    const graceLifecycle = ShopifyService.evaluateOrderSubscriptionLifecycle(originalOrder, duringGraceRefTime);

    // Subtest 6B: Past 72-hour grace (2026-02-18T01:00:00Z - 1 hour past grace)
    const pastGraceRefTime = new Date('2026-02-18T01:00:00Z').getTime();
    const expiredLifecycle = ShopifyService.evaluateOrderSubscriptionLifecycle(originalOrder, pastGraceRefTime);

    const gracePassed =
      graceLifecycle.hasActiveAccess === true &&
      graceLifecycle.isGraceActive === true &&
      graceLifecycle.status === 'active';

    const expiryPassed =
      expiredLifecycle.hasActiveAccess === false &&
      expiredLifecycle.status === 'expired';

    assert(
      gracePassed && expiryPassed,
      'Test Case 6: Failed renewal followed by 72-hour grace expiry',
      `During grace (Feb 16): access=${graceLifecycle.hasActiveAccess}, isGrace=${graceLifecycle.isGraceActive}; Past grace (Feb 18): access=${expiredLifecycle.hasActiveAccess}, status=${expiredLifecycle.status}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 6: Failed renewal followed by 72-hour grace expiry', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 7: Full refund
  // -------------------------------------------------------------------------
  try {
    // 7A: Order with displayFinancialStatus = 'REFUNDED'
    const fullRefundOrderA = {
      id: 'gid://shopify/Order/900000000004',
      name: '#1005',
      displayFinancialStatus: 'REFUNDED',
      processedAt: '2026-01-15T00:00:00Z',
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '9.99' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // 7B: Order where refundedAmount >= totalAmount
    const fullRefundOrderB = {
      id: 'gid://shopify/Order/900000000005',
      name: '#1006',
      displayFinancialStatus: 'PAID', // edge case: financial status not yet updated, but refunded sum equals total
      processedAt: '2026-01-15T00:00:00Z',
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '9.99' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    const resA = ShopifyService.evaluateOrderSubscriptionLifecycle(fullRefundOrderA);
    const resB = ShopifyService.evaluateOrderSubscriptionLifecycle(fullRefundOrderB);

    const fullRefundPassed =
      resA.eligible === false &&
      resA.hasActiveAccess === false &&
      resB.eligible === false &&
      resB.hasActiveAccess === false;

    assert(
      fullRefundPassed,
      'Test Case 7: Full refund',
      `Order A: eligible=${resA.eligible}, access=${resA.hasActiveAccess}; Order B: eligible=${resB.eligible}, access=${resB.hasActiveAccess}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 7: Full refund', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 8: Partial refund
  // -------------------------------------------------------------------------
  try {
    // Order with displayFinancialStatus = 'PARTIALLY_REFUNDED' ($2.00 goodwill credit out of $9.99)
    const partialRefundOrder = {
      id: 'gid://shopify/Order/900000000006',
      name: '#1007',
      displayFinancialStatus: 'PARTIALLY_REFUNDED',
      processedAt: '2026-01-15T00:00:00Z',
      createdAt: '2026-01-15T00:00:00Z',
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '2.00' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // Evaluated within the valid period (2026-01-20)
    const withinPeriodRefTime = new Date('2026-01-20T00:00:00Z').getTime();
    const partialRes = ShopifyService.evaluateOrderSubscriptionLifecycle(partialRefundOrder, withinPeriodRefTime);

    const partialRefundPassed =
      partialRes.eligible === true &&
      partialRes.hasActiveAccess === true &&
      partialRes.isPartialRefund === true &&
      partialRes.status === 'active';

    assert(
      partialRefundPassed,
      'Test Case 8: Partial refund',
      `Partial refund ($2.00/$9.99) preserved access: eligible=${partialRes.eligible}, hasActiveAccess=${partialRes.hasActiveAccess}, isPartialRefund=${partialRes.isPartialRefund}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 8: Partial refund', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Test Case 9: Resubscription after expiry
  // -------------------------------------------------------------------------
  try {
    const resubUserId = 'test-resub-user-' + Date.now();

    // 1. Initial state: user is expired
    subscriptionStore.setStatus(resubUserId, 'expired', {
      email: 'resub@example.com',
      currentPeriodEnd: '2026-01-15T00:00:00.000Z',
      gracePeriodEnd: '2026-01-18T00:00:00.000Z',
      shopifyCustomerId: 'gid://shopify/Customer/31266047000851',
    });

    const initialRecord = subscriptionStore.getByUserId(resubUserId);
    const wasExpired = initialRecord?.status === 'expired';

    // 2. User resubscribes: new paid order is created now
    const nowIso = new Date().toISOString();
    const newResubOrder = {
      id: 'gid://shopify/Order/900000000007',
      name: '#1008',
      displayFinancialStatus: 'PAID',
      processedAt: nowIso,
      createdAt: nowIso,
      cancelledAt: null,
      disputes: [],
      totalRefundedSet: { shopMoney: { amount: '0.00' } },
      totalPriceSet: { shopMoney: { amount: '9.99' } },
    };

    // Evaluated at resubscription time
    const resubLifecycle = ShopifyService.evaluateOrderSubscriptionLifecycle(newResubOrder);

    // Update status to active with new order data
    subscriptionStore.setStatus(resubUserId, 'active', {
      shopifyOrderId: newResubOrder.id,
      lastPaidOrderId: newResubOrder.id,
      currentPeriodEnd: resubLifecycle.currentPeriodEnd,
      gracePeriodEnd: resubLifecycle.gracePeriodEnd,
    });

    const finalRecord = subscriptionStore.getByUserId(resubUserId);
    const resubPassed =
      wasExpired &&
      resubLifecycle.hasActiveAccess === true &&
      resubLifecycle.status === 'active' &&
      finalRecord?.status === 'active' &&
      finalRecord?.lastPaidOrderId === newResubOrder.id &&
      Boolean(finalRecord?.currentPeriodEnd);

    assert(
      resubPassed,
      'Test Case 9: Resubscription after expiry',
      `User transitioned from expired to active: status=${finalRecord?.status}, newPeriodEnd=${finalRecord?.currentPeriodEnd}`
    );
  } catch (e: any) {
    results.push({ name: 'Test Case 9: Resubscription after expiry', passed: false, error: e.message });
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL 9 TESTS PASSED SUCCESSFUL' : 'TEST FAILURES DETECTED'}`);
  console.log('====================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
