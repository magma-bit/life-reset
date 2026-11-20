import crypto from 'crypto';

export interface ShopifyConfigStatus {
  configured: boolean;
  storeDomainConfigured: boolean;
  storefrontTokenConfigured: boolean;
  variantConfigured: boolean;
  sellingPlanConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookDeliveryConfirmed: boolean;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  adminTokenConfigured: boolean;
  clientCredentialsActive: boolean;
  directVerificationActive: boolean;
  verificationMode: 'outbound_api' | 'webhook';
  storeDomain?: string;
  variantId?: string;
  sellingPlanId?: string;
  missing: string[];
  missingEssentialCheckout: string[];
  optionalWebhookMissing: string[];
  liveCheckoutEnabled: boolean;
  lockReason?: string;
}

export class ShopifyService {
  private static tokenCache: {
    accessToken: string;
    expiresAt: number;
    scopes: string[];
  } | null = null;

  // Verified Selling Plan ID discovered and confirmed on store variant gid://shopify/ProductVariant/67632091955475
  private static verifiedSellingPlanId: string | null = 'gid://shopify/SellingPlan/692445053203';
  private static webhookDeliveryConfirmed: boolean = false;

  public static setVerifiedSellingPlanId(id: string) {
    this.verifiedSellingPlanId = this.formatGid(id, 'SellingPlan');
  }

  public static getVerifiedSellingPlanId(): string {
    return (
      process.env.SHOPIFY_SUBSCRIPTION_PLAN_ID?.trim() ||
      this.verifiedSellingPlanId ||
      'gid://shopify/SellingPlan/692445053203'
    );
  }

  public static setWebhookDeliveryConfirmed(confirmed: boolean = true) {
    this.webhookDeliveryConfirmed = confirmed;
  }

  public static isWebhookDeliveryConfirmed(): boolean {
    return this.webhookDeliveryConfirmed;
  }

  /**
   * Helper to format a bare numeric ID or existing GID into a standard Shopify Global ID (GID).
   */
  public static formatGid(id: string, type: 'ProductVariant' | 'SellingPlan' | 'SubscriptionContract' | 'Order'): string {
    const trimmed = (id || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('gid://shopify/')) return trimmed;
    return `gid://shopify/${type}/${trimmed}`;
  }

  /**
   * Executes the official Shopify Client Credentials Grant for installed Dev Dashboard / Partner apps.
   * Exchanges SHOPIFY_API_KEY (Client ID) and SHOPIFY_API_SECRET (Client Secret) for a scoped access token.
   * Caches the token in-memory and automatically refreshes before the 24-hour expiration window.
   * All credentials and tokens remain strictly server-side.
   */
  public static async getAppAccessToken(): Promise<{ token: string; scopes: string[] }> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60 * 1000) {
      return { token: this.tokenCache.accessToken, scopes: this.tokenCache.scopes };
    }

    const rawDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
    const cleanDomain = rawDomain ? rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined;
    const apiKey = process.env.SHOPIFY_API_KEY?.trim();
    const apiSecret = process.env.SHOPIFY_API_SECRET?.trim();

    if (!cleanDomain || !apiKey || !apiSecret) {
      throw new Error('Shopify Client ID (SHOPIFY_API_KEY), Client Secret (SHOPIFY_API_SECRET), or Store Domain is missing. Cannot perform client credentials grant.');
    }

    const tokenUrl = `https://${cleanDomain}/admin/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'client_credentials',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Shopify Client Credentials Grant failed with status ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error('Shopify Client Credentials Grant response did not contain an access_token');
    }

    const scopes = (data.scope || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 86400;

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      scopes,
    };

    return { token: data.access_token, scopes };
  }

  /**
   * Evaluates the current configuration status without revealing secrets.
   */
  public static getConfigStatus(userEmail?: string): ShopifyConfigStatus {
    const rawDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
    const cleanDomain = rawDomain ? rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined;
    const staticStorefrontToken =
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
      process.env.SHOPIFY_STOREFRONT_TOKEN?.trim() ||
      process.env.SHOPIFY_STOREFRONT_API_TOKEN?.trim();
    const apiKey = process.env.SHOPIFY_API_KEY?.trim();
    const apiSecret = process.env.SHOPIFY_API_SECRET?.trim();
    const clientCredentialsActive = Boolean(apiKey && apiSecret && cleanDomain);

    // Default to the confirmed active "Life Reset Premium" product variant ($9.99 USD) discovered on the store
    const defaultVariantId = 'gid://shopify/ProductVariant/67632091955475';
    const variantId =
      process.env.SHOPIFY_PRODUCT_VARIANT_ID?.trim() ||
      process.env.SHOPIFY_VARIANT_ID?.trim() ||
      (cleanDomain ? defaultVariantId : undefined);

    const sellingPlanId =
      this.getVerifiedSellingPlanId() ||
      process.env.SHOPIFY_SELLING_PLAN_ID?.trim() ||
      process.env.SHOPIFY_PLAN_ID?.trim();

    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();

    const adminToken =
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ||
      process.env.SHOPIFY_ADMIN_TOKEN?.trim();

    const webhookDeliveryConfirmed = this.isWebhookDeliveryConfirmed();

    const missingEssentialCheckout: string[] = [];
    if (!cleanDomain) missingEssentialCheckout.push('SHOPIFY_STORE_DOMAIN');
    if (!staticStorefrontToken && !clientCredentialsActive) {
      missingEssentialCheckout.push('SHOPIFY_STOREFRONT_ACCESS_TOKEN (or SHOPIFY_API_KEY + SHOPIFY_API_SECRET)');
    }
    if (!variantId) missingEssentialCheckout.push('SHOPIFY_PRODUCT_VARIANT_ID');
    if (!sellingPlanId) missingEssentialCheckout.push('SHOPIFY_SUBSCRIPTION_PLAN_ID ($9.99/mo selling plan)');
    if (!adminToken && !clientCredentialsActive) {
      missingEssentialCheckout.push('SHOPIFY_ADMIN_ACCESS_TOKEN (or SHOPIFY_API_KEY + SHOPIFY_API_SECRET client credentials)');
    }

    const optionalWebhookMissing: string[] = [];
    if (!webhookSecret) optionalWebhookMissing.push('SHOPIFY_WEBHOOK_SECRET');
    if (!webhookDeliveryConfirmed) optionalWebhookMissing.push('Shopify Webhook Delivery & Verification confirmation');

    // Architecture: Option 1 uses Direct Outbound Server-to-Server Shopify Verification.
    // Essential configuration required for Option 1 checkout and verification:
    const missing = missingEssentialCheckout;

    // Direct Outbound Verification status (Option 1):
    // Requires store domain, storefront credentials, $9.99 recurring variant & selling plan, and Admin API read scopes
    const directVerificationActive = Boolean(
      cleanDomain &&
      (staticStorefrontToken || clientCredentialsActive) &&
      variantId &&
      sellingPlanId &&
      (adminToken || clientCredentialsActive)
    );

    // Controlled Stripe Test Mode: Enable checkout strictly for authorized test account
    const allowedTestEmail = (process.env.SHOPIFY_TEST_ACCOUNT_EMAIL || 'chongjun2205@gmail.com').trim().toLowerCase();
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const isSpecifiedUser = Boolean(cleanEmail);
    const isAllowedUser = isSpecifiedUser ? cleanEmail === allowedTestEmail : true;

    // Controlled live checkout enabled only for the authorized test account
    const liveCheckoutEnabled = directVerificationActive && isAllowedUser;

    let lockReason: string | undefined = undefined;
    if (!directVerificationActive) {
      lockReason = `Live checkout is locked: Missing essential checkout configuration: ${missingEssentialCheckout.join(', ')}`;
    } else if (isSpecifiedUser && !isAllowedUser) {
      lockReason = `Live checkout is locked: Controlled testing in Stripe Test Mode is permitted only for authorized test account (${allowedTestEmail}).`;
    }

    return {
      configured: directVerificationActive,
      storeDomainConfigured: Boolean(cleanDomain),
      storefrontTokenConfigured: Boolean(staticStorefrontToken || clientCredentialsActive),
      variantConfigured: Boolean(variantId),
      sellingPlanConfigured: Boolean(sellingPlanId),
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryConfirmed,
      apiKeyConfigured: Boolean(apiKey),
      apiSecretConfigured: Boolean(apiSecret),
      adminTokenConfigured: Boolean(adminToken || clientCredentialsActive),
      clientCredentialsActive,
      directVerificationActive,
      verificationMode: 'outbound_api',
      storeDomain: cleanDomain,
      variantId,
      sellingPlanId,
      missing,
      missingEssentialCheckout,
      optionalWebhookMissing,
      liveCheckoutEnabled,
      lockReason,
    };
  }

  /**
   * Verifies Shopify Webhook HMAC-SHA256 signature using SHOPIFY_WEBHOOK_SECRET only.
   * Compares timing-safe buffers to prevent timing attacks.
   * Never prints, exposes, or logs the secret.
   */
  public static verifyWebhookHmac(rawBody: Buffer | string | undefined, hmacHeader?: string): boolean {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
    const cleanHeader = (hmacHeader || '').trim();

    if (!secret || !cleanHeader || rawBody === undefined || rawBody === null) {
      return false;
    }

    try {
      const generatedHmac = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      const generatedBuffer = Buffer.from(generatedHmac, 'utf8');
      const headerBuffer = Buffer.from(cleanHeader, 'utf8');

      if (generatedBuffer.length !== headerBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(generatedBuffer, headerBuffer);
    } catch (err) {
      console.error('Error verifying webhook HMAC');
      return false;
    }
  }

  /**
   * Calls the Shopify Storefront GraphQL API (version 2024-10).
   * Authenticates using either:
   * 1. A static Storefront token via X-Shopify-Storefront-Access-Token, OR
   * 2. The Dev Dashboard app token via official Shopify-Storefront-Private-Token header.
   */
  public static async queryStorefrontGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
    const status = this.getConfigStatus();
    if (!status.storeDomainConfigured) {
      throw new Error('Shopify Store Domain is not configured.');
    }

    const domain = status.storeDomain!;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const staticToken =
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
      process.env.SHOPIFY_STOREFRONT_TOKEN?.trim() ||
      process.env.SHOPIFY_STOREFRONT_API_TOKEN?.trim();

    if (staticToken) {
      headers['X-Shopify-Storefront-Access-Token'] = staticToken;
    } else if (process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
      const { token } = await this.getAppAccessToken();
      headers['Shopify-Storefront-Private-Token'] = token;
    } else {
      throw new Error('Shopify Storefront API authentication failed: neither Storefront Access Token nor Client Credentials (API Key & Secret) are configured.');
    }

    const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify Storefront API responded with status ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Shopify Storefront GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
    }

    return data.data;
  }

  /**
   * Queries Storefront GraphQL for the selling plans attached to a specific variant.
   */
  public static async fetchVariantSellingPlans(variantId?: string): Promise<{
    success: boolean;
    sellingPlans?: Array<{ id: string; name: string; description?: string; interval?: string }>;
    error?: string;
    requiresScope?: boolean;
  }> {
    const status = this.getConfigStatus();
    const targetVariantId = variantId || status.variantId || 'gid://shopify/ProductVariant/67632091955475';
    const formattedId = this.formatGid(targetVariantId, 'ProductVariant');

    const query = `
      query GetVariantSellingPlans($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            id
            title
            product {
              id
              title
              sellingPlanGroups(first: 5) {
                edges {
                  node {
                    name
                    sellingPlans(first: 5) {
                      edges {
                        node {
                          id
                          name
                          description
                          recurringDeliveries
                          options {
                            name
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.queryStorefrontGraphQL(query, { id: formattedId });
      const node = data?.node;
      const groups = node?.product?.sellingPlanGroups?.edges || [];
      const plans: Array<{ id: string; name: string; description?: string; interval?: string }> = [];

      for (const groupEdge of groups) {
        const groupPlans = groupEdge?.node?.sellingPlans?.edges || [];
        for (const planEdge of groupPlans) {
          const plan = planEdge?.node;
          if (plan) {
            const intervalOpt = plan.options?.find((o: any) =>
              o.name?.toLowerCase().includes('delivery') ||
              o.name?.toLowerCase().includes('month') ||
              o.name?.toLowerCase().includes('interval')
            )?.value;
            plans.push({
              id: plan.id,
              name: plan.name,
              description: plan.description,
              interval: intervalOpt || (plan.recurringDeliveries ? 'Every 1 Month' : undefined),
            });
          }
        }
      }

      if (plans.length > 0) {
        this.setVerifiedSellingPlanId(plans[0].id);
      }

      return {
        success: true,
        sellingPlans: plans,
      };
    } catch (err: any) {
      const isScopeError = err.message?.includes('unauthenticated_read_selling_plans') || err.message?.includes('ACCESS_DENIED');
      return {
        success: false,
        requiresScope: isScopeError,
        error: isScopeError
          ? 'Storefront API access scope `unauthenticated_read_selling_plans` is required to query selling plans for this variant.'
          : err.message,
      };
    }
  }

  /**
   * Calls Shopify Admin GraphQL API (version 2024-10) for server-to-server queries and verification.
   * Authenticates using either SHOPIFY_ADMIN_ACCESS_TOKEN or the Client Credentials Grant access token.
   */
  public static async queryAdminGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
    const status = this.getConfigStatus();
    if (!status.storeDomainConfigured) {
      throw new Error('Shopify Store Domain is not configured.');
    }

    const domain = status.storeDomain!;
    let token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();

    if (!token && process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
      const appToken = await this.getAppAccessToken();
      token = appToken.token;
    }

    if (!token) {
      throw new Error('Shopify Admin API credentials are not configured.');
    }

    const response = await fetch(`https://${domain}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify Admin API responded with status ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Shopify Admin GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
    }

    return data.data;
  }

  /**
   * Calls Shopify Admin REST API (version 2024-10) for endpoints requiring REST format.
   * Authenticates using either SHOPIFY_ADMIN_ACCESS_TOKEN or the Client Credentials Grant access token.
   */
  public static async queryAdminREST(endpoint: string, options: RequestInit = {}): Promise<any> {
    const status = this.getConfigStatus();
    if (!status.storeDomainConfigured) {
      throw new Error('Shopify Store Domain is not configured.');
    }

    const domain = status.storeDomain!;
    let token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();

    if (!token && process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
      const appToken = await this.getAppAccessToken();
      token = appToken.token;
    }

    if (!token) {
      throw new Error('Shopify Admin API credentials are not configured.');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `https://${domain}/admin/api/2024-10/${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Shopify Admin REST API (${cleanEndpoint}) responded with status ${response.status}: ${text}`);
    }

    return response.json();
  }

  /**
   * Registers webhook subscriptions with Shopify Admin GraphQL API.
   * Required Topics:
   * - SUBSCRIPTION_CONTRACTS_CREATE (requires `read_own_subscription_contracts` Admin scope)
   * - SUBSCRIPTION_CONTRACTS_UPDATE (requires `read_own_subscription_contracts` Admin scope)
   * - ORDERS_PAID (requires `read_orders` Admin scope)
   */
  public static async registerWebhooks(callbackUrl?: string): Promise<{
    success: boolean;
    registered: Array<{ topic: string; id: string; callbackUrl: string }>;
    failed: Array<{ topic: string; error: string; missingScope?: string }>;
    allRegistered: boolean;
    currentAccessScopes: string[];
    missingAdminScopes: string[];
  }> {
    const status = this.getConfigStatus();
    if (!status.storeDomainConfigured) {
      throw new Error('Shopify Store Domain is not configured.');
    }

    const appUrl = process.env.APP_URL || 'https://ais-dev-trt6fqv6yjaeeau5zom7gi-925841078224.asia-east1.run.app';
    const endpoint = callbackUrl || `${appUrl}/api/webhooks/shopify`;

    // 1. Check current app installation scopes
    let currentScopes: string[] = [];
    try {
      const scopeRes = await this.queryAdminGraphQL(`
        query {
          currentAppInstallation {
            accessScopes {
              handle
            }
          }
        }
      `);
      currentScopes = scopeRes?.currentAppInstallation?.accessScopes?.map((s: any) => s.handle) || [];
    } catch (e: any) {
      console.warn('Could not query current access scopes:', e.message);
    }

    const topicsToRegister = [
      { topic: 'SUBSCRIPTION_CONTRACTS_CREATE', requiredScope: 'read_own_subscription_contracts' },
      { topic: 'SUBSCRIPTION_CONTRACTS_UPDATE', requiredScope: 'read_own_subscription_contracts' },
      { topic: 'ORDERS_PAID', requiredScope: 'read_orders' },
    ];

    const missingAdminScopes = topicsToRegister
      .map(t => t.requiredScope)
      .filter(scope => !currentScopes.includes(scope));

    const uniqueMissingScopes = Array.from(new Set(missingAdminScopes));

    // 2. Query already existing webhooks
    const existingWebhooksMap = new Map<string, string>();
    try {
      const listRes = await this.queryAdminGraphQL(`
        query {
          webhookSubscriptions(first: 25) {
            edges {
              node {
                id
                topic
                endpoint {
                  ... on WebhookHttpEndpoint {
                    callbackUrl
                  }
                }
              }
            }
          }
        }
      `);
      for (const edge of listRes?.webhookSubscriptions?.edges || []) {
        if (edge?.node?.endpoint?.callbackUrl === endpoint) {
          existingWebhooksMap.set(edge.node.topic, edge.node.id);
        }
      }
    } catch (e: any) {
      console.warn('Could not list existing webhooks:', e.message);
    }

    const registered: Array<{ topic: string; id: string; callbackUrl: string }> = [];
    const failed: Array<{ topic: string; error: string; missingScope?: string }> = [];

    const mutation = `
      mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          userErrors {
            field
            message
          }
          webhookSubscription {
            id
            topic
            endpoint {
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    `;

    for (const item of topicsToRegister) {
      if (existingWebhooksMap.has(item.topic)) {
        registered.push({
          topic: item.topic,
          id: existingWebhooksMap.get(item.topic)!,
          callbackUrl: endpoint,
        });
        continue;
      }

      try {
        const res = await this.queryAdminGraphQL(mutation, {
          topic: item.topic,
          webhookSubscription: {
            callbackUrl: endpoint,
            format: 'JSON',
          },
        });

        const userErrors = res?.webhookSubscriptionCreate?.userErrors || [];
        const subscription = res?.webhookSubscriptionCreate?.webhookSubscription;

        if (userErrors.length > 0) {
          const errMsg = userErrors.map((e: any) => e.message).join('; ');
          failed.push({
            topic: item.topic,
            error: errMsg,
            missingScope: item.requiredScope,
          });
        } else if (subscription?.id) {
          registered.push({
            topic: item.topic,
            id: subscription.id,
            callbackUrl: endpoint,
          });
        }
      } catch (err: any) {
        failed.push({
          topic: item.topic,
          error: err.message,
          missingScope: item.requiredScope,
        });
      }
    }

    return {
      success: failed.length === 0,
      registered,
      failed,
      allRegistered: registered.length === topicsToRegister.length,
      currentAccessScopes: currentScopes,
      missingAdminScopes: uniqueMissingScopes,
    };
  }

  /**
   * Creates a genuine Shopify recurring subscription checkout using Storefront API cartCreate.
   *
   * Invariants:
   * 1. Requires verified $9.99 USD monthly recurring selling plan.
   * 2. Uses Storefront API CartInput with lines: [{ merchandiseId, quantity: 1, sellingPlanId }]
   * 3. Attaches custom attributes { userId, userEmail, appName } so Shopify carries the Life Reset user link.
   * 4. Sets buyerIdentity { email } to pre-fill the customer's authenticated email.
   * 5. Returns the genuine Shopify checkoutUrl.
   * 6. Does not unlock or enable live checkout until the selling plan is verified.
   */
  public static async createCheckoutSession(params: {
    userId: string;
    userEmail: string;
    returnUrl?: string;
  }): Promise<{
    success: boolean;
    checkoutUrl?: string;
    message?: string;
    requiresCredentials?: boolean;
    missingKeys?: string[];
    locked?: boolean;
  }> {
    const cleanUserEmail = (params.userEmail || '').trim().toLowerCase();
    const cleanUserId = (params.userId || '').trim();

    // Whitelist check: Allow checkout strictly for the authenticated test account
    const allowedTestEmail = (process.env.SHOPIFY_TEST_ACCOUNT_EMAIL || 'chongjun2205@gmail.com').trim().toLowerCase();
    const isAllowedTestAccount = Boolean(cleanUserEmail && cleanUserEmail === allowedTestEmail);

    if (!isAllowedTestAccount) {
      console.warn(`[Shopify Diagnostics: Checkout Creation] Checkout blocked: ${cleanUserEmail} is not the authorized test account (${allowedTestEmail})`);
      return {
        success: false,
        locked: true,
        requiresCredentials: false,
        message: `Live checkout is locked: Controlled testing in Stripe Test Mode is permitted only for the authorized test account (${allowedTestEmail}).`,
      };
    }

    const status = this.getConfigStatus(cleanUserEmail);

    // Strict lock: Do not enable checkout if config is incomplete
    if (!status.liveCheckoutEnabled) {
      return {
        success: false,
        locked: true,
        requiresCredentials: status.missingEssentialCheckout.length > 0,
        missingKeys: status.missingEssentialCheckout,
        message: status.lockReason || 'Live checkout is locked awaiting test flow activation.',
      };
    }

    try {
      const defaultVariantId = 'gid://shopify/ProductVariant/67632091955475';
      const rawVariantId =
        process.env.SHOPIFY_PRODUCT_VARIANT_ID?.trim() ||
        process.env.SHOPIFY_VARIANT_ID?.trim() ||
        defaultVariantId;

      const rawSellingPlanId =
        this.getVerifiedSellingPlanId() ||
        process.env.SHOPIFY_SELLING_PLAN_ID?.trim() ||
        process.env.SHOPIFY_PLAN_ID?.trim()!;

      const merchandiseId = this.formatGid(rawVariantId, 'ProductVariant');
      const sellingPlanId = this.formatGid(rawSellingPlanId, 'SellingPlan');

      const mutation = `
        mutation CreateSubscriptionCart($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              totalQuantity
              lines(first: 5) {
                edges {
                  node {
                    id
                    quantity
                    merchandise {
                      ... on ProductVariant {
                        id
                        title
                      }
                    }
                    sellingPlanAllocation {
                      sellingPlan {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          lines: [
            {
              merchandiseId,
              sellingPlanId,
              quantity: 1,
            },
          ],
          attributes: [
            { key: 'userId', value: params.userId },
            { key: 'userEmail', value: params.userEmail },
            { key: 'appName', value: 'Life Reset' },
            { key: 'plan', value: 'life-reset-monthly-9.99' },
            { key: 'returnUrl', value: params.returnUrl || '' },
          ],
          buyerIdentity: {
            email: params.userEmail,
          },
        },
      };

      console.log('[Shopify Diagnostics: Checkout Creation] Initiating cartCreate for UID:', params.userId, 'Plan: $9.99 USD/mo', 'Variant:', merchandiseId);

      const result = await this.queryStorefrontGraphQL(mutation, variables);
      const cartData = result?.cartCreate;
      const userErrors = cartData?.userErrors || [];

      if (userErrors.length > 0) {
        const errorMsg = userErrors.map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`).join('; ');
        console.error('[Shopify Diagnostics: Checkout Creation] Storefront cartCreate error:', errorMsg);
        return {
          success: false,
          locked: true,
          message: `Shopify subscription checkout error: ${errorMsg}. Please verify that selling plan (${sellingPlanId}) is active and attached to the $9.99 variant in your Shopify store.`,
        };
      }

      let checkoutUrl = cartData?.cart?.checkoutUrl;
      if (!checkoutUrl) {
        return {
          success: false,
          message: 'Shopify did not return a valid checkout URL for the subscription cart.',
        };
      }

      if (params.returnUrl) {
        try {
          const parsed = new URL(checkoutUrl);
          parsed.searchParams.set('return_to', params.returnUrl);
          checkoutUrl = parsed.toString();
        } catch {
          // Keep base checkout URL
        }
      }

      console.log('[Shopify Diagnostics: Checkout Creation] Generated cartId:', cartData?.cart?.id, 'Total quantity:', cartData?.cart?.totalQuantity);

      return {
        success: true,
        checkoutUrl,
      };
    } catch (err: any) {
      console.error('Error creating Shopify subscription cart:', err);
      return {
        success: false,
        message: `Failed to initiate Shopify recurring subscription checkout: ${err.message}`,
      };
    }
  }

  /**
   * Server-side cryptographic verification with Shopify.
   * Never trusts browser-supplied status or success parameters.
   */
  /**
   * Server-side cryptographic & API verification directly with Shopify.
   * Requirement 2: Direct outbound call to Shopify Admin API. Never trusts browser redirect or client-supplied status.
   * Requirement 3: Confirms the subscription contract belongs to the authenticated Firebase user.
   * Requirement 5: Handles active, cancelled, expired, paused, and failed subscriptions safely.
   */
  /**
   * Helper to check if a Shopify order satisfies Phase 1 subscription requirements:
   * 1. Display financial status is 'PAID' and cancelledAt is null.
   * 2. Custom attribute 'userId' strictly matches the authenticated Firebase UID.
   * 3. Line items include the exact verified monthly selling plan ID (gid://shopify/SellingPlan/692445053203).
   */
  /**
   * Calculates monthly billing periods using UTC calendar arithmetic with day-clamping.
   * Requirement 1: Does NOT use naive JavaScript setMonth(), which incorrectly overflows
   * days into subsequent months (e.g. Jan 31 becoming March 2/3).
   * Clamps target day to the last valid day of the target month:
   * - Jan 31 -> Feb 28 (non-leap) or Feb 29 (leap year)
   * - Aug 31 -> Sep 30
   * - Mar 31 -> Apr 30
   */
  /**
   * Calculates the end of a 1-calendar-month billing period using UTC calendar arithmetic
   * and a stable billing anchor day (e.g. 29, 30, or 31).
   *
   * Month-End Anchor Discipline:
   * - Preserves the original anchor day (e.g., 31) across all consecutive monthly cycles.
   * - When target month has fewer days than anchor day, clamps to the target month's last valid day:
   *   - Jan 31 -> Feb 28 (non-leap) or Feb 29 (leap year)
   *   - Feb 28 (with anchor 31) -> Mar 31
   *   - Mar 31 -> Apr 30
   *   - Apr 30 (with anchor 31) -> May 31
   *   - Aug 31 -> Sep 30
   */
  public static calculatePeriodEndWithAnchor(
    startDate: Date,
    billingAnchorDay?: number | null
  ): Date {
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth(); // 0 = Jan, 11 = Dec
    const orderDay = startDate.getUTCDate();

    // Use stable anchor day if provided and valid (1..31); otherwise fallback to order's day
    const anchor = billingAnchorDay && billingAnchorDay >= 1 && billingAnchorDay <= 31
      ? billingAnchorDay
      : orderDay;

    const targetMonth = (month + 1) % 12;
    const targetYear = month === 11 ? year + 1 : year;

    // Day 0 of (targetMonth + 1) gives total number of days in targetMonth of targetYear
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(anchor, daysInTargetMonth);

    return new Date(Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      startDate.getUTCHours(),
      startDate.getUTCMinutes(),
      startDate.getUTCSeconds(),
      startDate.getUTCMilliseconds()
    ));
  }

  public static addOneCalendarMonthUtc(startDate: Date, billingAnchorDay?: number | null): Date {
    return this.calculatePeriodEndWithAnchor(startDate, billingAnchorDay);
  }

  /**
   * Phase 3: Computes currentPeriodEnd and gracePeriodEnd (72-hour grace period)
   * from an order's processedAt (or createdAt) timestamp using UTC day-clamping
   * and a stable billing anchor day.
   */
  public static calculateBillingCyclePeriods(
    processedAtIso: string,
    graceHours: number = 72,
    billingAnchorDay?: number | null
  ): { currentPeriodEnd: string; gracePeriodEnd: string; billingAnchorDay: number } {
    const start = new Date(processedAtIso);
    const orderDay = start.getUTCDate();
    const anchor = billingAnchorDay && billingAnchorDay >= 1 && billingAnchorDay <= 31
      ? billingAnchorDay
      : orderDay;

    const periodEnd = this.calculatePeriodEndWithAnchor(start, anchor);
    const graceEnd = new Date(periodEnd.getTime() + graceHours * 60 * 60 * 1000);

    return {
      currentPeriodEnd: periodEnd.toISOString(),
      gracePeriodEnd: graceEnd.toISOString(),
      billingAnchorDay: anchor,
    };
  }

  /**
   * Evaluates order status, financial flags, refund state, and lifecycle window:
   * - Rejects cancelled orders (displayFinancialStatus === VOIDED, cancelledAt !== null)
   * - Does NOT classify cancelledAt alone as a chargeback (Requirement 2)
   * - Rejects fully refunded orders (refundedAmount >= totalAmount or displayFinancialStatus === REFUNDED)
   * - Strict chargeback detection: initiatedAs === 'CHARGEBACK' and status === 'ACCEPTED' or 'LOST' (Requirement 2)
   * - Accepts partially refunded orders without revoking access (Requirement 6)
   * - Computes currentPeriodEnd with stable billingAnchorDay and gracePeriodEnd (+72 hours)
   * - Grants access if referenceTime <= gracePeriodEnd (preserving access during active period and 72h grace)
   * - Revokes access if referenceTime > gracePeriodEnd
   */
  public static evaluateOrderSubscriptionLifecycle(
    order: any,
    referenceTimeMs: number = Date.now(),
    billingAnchorDay?: number | null
  ): {
    eligible: boolean;
    reason?: string;
    status: 'active' | 'expired' | 'cancelled';
    hasActiveAccess: boolean;
    currentPeriodEnd: string;
    gracePeriodEnd: string;
    billingAnchorDay: number;
    isGraceActive: boolean;
    isPartialRefund: boolean;
  } {
    // 1. Check order cancellation / voiding (Do not classify cancelledAt alone as a chargeback!)
    if (order.cancelledAt || order.displayFinancialStatus === 'VOIDED') {
      const isFraud = order.cancelReason === 'FRAUD';
      return {
        eligible: false,
        reason: isFraud ? 'Order was cancelled due to fraud.' : 'Order was cancelled or voided.',
        status: 'cancelled',
        hasActiveAccess: false,
        currentPeriodEnd: '',
        gracePeriodEnd: '',
        billingAnchorDay: billingAnchorDay || 0,
        isGraceActive: false,
        isPartialRefund: false,
      };
    }

    // 2. Check unpaid / pending status
    if (order.displayFinancialStatus === 'UNPAID' || order.displayFinancialStatus === 'PENDING') {
      return {
        eligible: false,
        reason: 'Order is unpaid or payment is pending.',
        status: 'expired',
        hasActiveAccess: false,
        currentPeriodEnd: '',
        gracePeriodEnd: '',
        billingAnchorDay: billingAnchorDay || 0,
        isGraceActive: false,
        isPartialRefund: false,
      };
    }

    // 3. Check full refund vs partial refund
    const refundedAmount = parseFloat(order.totalRefundedSet?.shopMoney?.amount || '0');
    const totalAmount = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
    const isFullyRefunded =
      order.displayFinancialStatus === 'REFUNDED' ||
      (totalAmount > 0 && refundedAmount >= totalAmount);

    if (isFullyRefunded) {
      return {
        eligible: false,
        reason: 'Order was fully refunded.',
        status: 'cancelled',
        hasActiveAccess: false,
        currentPeriodEnd: '',
        gracePeriodEnd: '',
        billingAnchorDay: billingAnchorDay || 0,
        isGraceActive: false,
        isPartialRefund: false,
      };
    }

    // 4. Check confirmed chargeback / dispute (Requirement 2)
    // Uses strictly verified Shopify Admin API 2024-10 schema:
    // initiatedAs === 'CHARGEBACK' and (status === 'ACCEPTED' || status === 'LOST')
    const hasConfirmedChargeback = Boolean(
      order.disputes &&
      order.disputes.some(
        (d: any) =>
          d.initiatedAs === 'CHARGEBACK' &&
          (d.status === 'ACCEPTED' || d.status === 'LOST')
      )
    );

    if (hasConfirmedChargeback) {
      return {
        eligible: false,
        reason: 'Order has a confirmed chargeback dispute (status ACCEPTED or LOST).',
        status: 'cancelled',
        hasActiveAccess: false,
        currentPeriodEnd: '',
        gracePeriodEnd: '',
        billingAnchorDay: billingAnchorDay || 0,
        isGraceActive: false,
        isPartialRefund: false,
      };
    }

    // 5. Check partial refund (Requirement 6: do not automatically revoke access)
    const isPartialRefund =
      order.displayFinancialStatus === 'PARTIALLY_REFUNDED' ||
      (refundedAmount > 0 && refundedAmount < totalAmount);

    // 6. Calculate periods using UTC day-clamping with stable billing anchor
    const processedTimestamp = order.processedAt || order.createdAt;
    const { currentPeriodEnd, gracePeriodEnd, billingAnchorDay: computedAnchor } = this.calculateBillingCyclePeriods(
      processedTimestamp,
      72,
      billingAnchorDay
    );

    const periodEndMs = new Date(currentPeriodEnd).getTime();
    const graceEndMs = new Date(gracePeriodEnd).getTime();

    const isGraceActive = referenceTimeMs > periodEndMs && referenceTimeMs <= graceEndMs;
    const isPastGrace = referenceTimeMs > graceEndMs;

    if (isPastGrace) {
      return {
        eligible: true,
        reason: `Billing period and 72-hour grace period expired on ${gracePeriodEnd}.`,
        status: 'expired',
        hasActiveAccess: false,
        currentPeriodEnd,
        gracePeriodEnd,
        billingAnchorDay: computedAnchor,
        isGraceActive: false,
        isPartialRefund,
      };
    }

    // Active (either in paid period or in 72-hour grace)
    return {
      eligible: true,
      reason: isGraceActive
        ? `In 72-hour grace period until ${gracePeriodEnd}.`
        : `Active paid subscription until ${currentPeriodEnd}.`,
      status: 'active',
      hasActiveAccess: true,
      currentPeriodEnd,
      gracePeriodEnd,
      billingAnchorDay: computedAnchor,
      isGraceActive,
      isPartialRefund,
    };
  }

  /**
   * Helper to check if a Shopify order satisfies Phase 1 subscription requirements:
   * 1. Display financial status is PAID or PARTIALLY_REFUNDED and order not cancelled.
   * 2. Custom attribute 'userId' strictly matches the authenticated Firebase UID.
   * 3. Line items include the exact verified monthly selling plan ID (gid://shopify/SellingPlan/692445053203).
   */
  public static isVerifiedSubscriptionOrder(
    order: any,
    cleanUserId: string,
    expectedSellingPlanId: string = 'gid://shopify/SellingPlan/692445053203'
  ): boolean {
    if (!order || !cleanUserId) return false;

    // Must have custom attribute 'userId' matching cleanUserId
    const customAttributes = Array.isArray(order.customAttributes) ? order.customAttributes : [];
    const uidAttr = customAttributes.find(
      (a: any) => (a.key === 'userId' || a.name === 'userId') && a.value === cleanUserId
    );
    if (!uidAttr) {
      return false;
    }

    // Must contain line item with exact selling plan ID
    const lineEdges = order.lineItems?.edges || [];
    const hasSellingPlan = lineEdges.some((edge: any) => {
      const planId = edge?.node?.sellingPlan?.sellingPlanId;
      return planId === expectedSellingPlanId;
    });

    if (!hasSellingPlan) {
      return false;
    }

    // Financial & cancellation checks
    if (order.cancelledAt || order.displayFinancialStatus === 'VOIDED' || order.displayFinancialStatus === 'UNPAID' || order.displayFinancialStatus === 'PENDING') {
      return false;
    }

    // Check full refund
    const refundedAmount = parseFloat(order.totalRefundedSet?.shopMoney?.amount || '0');
    const totalAmount = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
    if (order.displayFinancialStatus === 'REFUNDED' || (totalAmount > 0 && refundedAmount >= totalAmount)) {
      return false;
    }

    // Check confirmed disputes / chargebacks (Shopify Admin API 2024-10 schema)
    if (
      order.disputes &&
      order.disputes.some(
        (d: any) =>
          d.initiatedAs === 'CHARGEBACK' &&
          (d.status === 'ACCEPTED' || d.status === 'LOST')
      )
    ) {
      return false;
    }

    // Must be PAID or PARTIALLY_REFUNDED
    return order.displayFinancialStatus === 'PAID' || order.displayFinancialStatus === 'PARTIALLY_REFUNDED';
  }

  /**
   * Helper to retrieve the Shopify Customer ID from an order via Shopify Admin REST API.
   * Uses read_orders permission without requiring read_customers scope.
   */
  public static async getCustomerIdForOrder(orderGidOrNumeric: string): Promise<string | undefined> {
    try {
      const numericId = orderGidOrNumeric.replace(/^gid:\/\/shopify\/Order\//, '').trim();
      if (!numericId) return undefined;
      const restData = await this.queryAdminREST(`orders/${numericId}.json?fields=id,customer,email`);
      const customer = restData?.order?.customer;
      if (!customer) return undefined;
      if (customer.admin_graphql_api_id) return customer.admin_graphql_api_id;
      if (customer.id) return `gid://shopify/Customer/${customer.id}`;
      return undefined;
    } catch (err: any) {
      console.warn('[Shopify Service] Failed to retrieve customer ID via Admin REST API:', err.message);
      return undefined;
    }
  }

  /**
   * Phase 2 & Phase 3: Verifies recurring subscription orders for a verified Shopify Customer ID.
   * Requirements:
   * 1. Uses exact shopifyCustomerId saved from Firestore / initial order.
   * 2. Queries Shopify Admin API for that customer's recent orders (via customer_id: filter).
   * 3. Confirms orders belong strictly to that exact Shopify Customer ID.
   * 4. Requires exact selling plan ID: gid://shopify/SellingPlan/692445053203.
   * 5. Requires financial status PAID (or PARTIALLY_REFUNDED) and rejects cancelled or fully refunded orders.
   * 6. Does NOT require recurring orders to contain the original Firebase UID custom attribute.
   * 7. Does NOT match customers by email.
   * 8. Uses UTC calendar arithmetic with day-clamping and 72-hour grace period for lifecycle decisions.
   */
  public static async verifyCustomerRecurringOrders(params: {
    shopifyCustomerId: string;
    expectedSellingPlanId?: string;
    billingAnchorDay?: number | null;
  }): Promise<{
    verified: boolean;
    error?: boolean;
    status: 'pending' | 'active' | 'cancelled' | 'expired' | 'paused';
    hasActiveAccess: boolean;
    order?: any;
    currentPeriodEnd?: string;
    gracePeriodEnd?: string;
    billingAnchorDay?: number;
    shopifyOrderId?: string;
    shopifyCustomerId?: string;
    message?: string;
  }> {
    const rawCustomerId = (params.shopifyCustomerId || '').trim();
    const numericCustomerId = rawCustomerId.replace(/^gid:\/\/shopify\/Customer\//, '').trim();

    if (!numericCustomerId) {
      return {
        verified: false,
        status: 'pending',
        hasActiveAccess: false,
        message: 'No valid Shopify Customer ID provided for recurring verification.',
      };
    }

    const expectedSellingPlanId = params.expectedSellingPlanId || 'gid://shopify/SellingPlan/692445053203';
    console.log(`[Shopify Phase 3] Querying Admin API for orders belonging to Customer ID: ${numericCustomerId}`);

    try {
      const customerOrdersQuery = `
        query getCustomerOrders($query: String!, $after: String) {
          orders(first: 25, query: $query, reverse: true, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
              node {
                id
                name
                displayFinancialStatus
                cancelledAt
                cancelReason
                createdAt
                processedAt
                fullyPaid
                unpaid
                disputes {
                  id
                  initiatedAs
                  status
                }
                totalRefundedSet {
                  shopMoney {
                    amount
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      sellingPlan {
                        sellingPlanId
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      let hasNextPage = true;
      let endCursor: string | null = null;
      let pageCount = 0;
      const maxPages = 10; // Defensive upper bound (up to 250 orders)

      while (hasNextPage && pageCount < maxPages) {
        pageCount++;
        const res = await this.queryAdminGraphQL(customerOrdersQuery, {
          query: `customer_id:${numericCustomerId}`,
          after: endCursor,
        });

        const pageInfo = res?.orders?.pageInfo;
        const orderEdges = res?.orders?.edges || [];

        for (const edge of orderEdges) {
          const order = edge?.node;
          if (!order) continue;

          // Requirement 4: Require exact selling plan ID: gid://shopify/SellingPlan/692445053203
          const lineEdges = order.lineItems?.edges || [];
          const hasSellingPlan = lineEdges.some((lineEdge: any) => {
            const planId = lineEdge?.node?.sellingPlan?.sellingPlanId;
            return planId === expectedSellingPlanId;
          });

          if (!hasSellingPlan) {
            continue;
          }

          // Requirement 3: Accept only orders belonging to that exact Shopify Customer ID
          const orderCustomerId = await this.getCustomerIdForOrder(order.id);
          const cleanOrderCust = (orderCustomerId || '').replace(/^gid:\/\/shopify\/Customer\//, '').trim();
          if (cleanOrderCust !== numericCustomerId) {
            console.warn(`[Shopify Phase 3] Customer ID mismatch on order ${order.id}: expected ${numericCustomerId}, found ${cleanOrderCust}`);
            continue;
          }

          // Evaluate order lifecycle, refunds, chargebacks, and 72h grace period with stable billingAnchorDay
          const lifecycle = this.evaluateOrderSubscriptionLifecycle(
            order,
            Date.now(),
            params.billingAnchorDay
          );

          if (!lifecycle.eligible) {
            console.log(`[Shopify Phase 3] Order ${order.id} (${order.name}) ineligible: ${lifecycle.reason}`);
            continue;
          }

          console.log(`[Shopify Phase 3] Evaluated order ${order.id} (${order.name}) for Customer ${numericCustomerId} (page ${pageCount}): status=${lifecycle.status}, hasActiveAccess=${lifecycle.hasActiveAccess}, currentPeriodEnd=${lifecycle.currentPeriodEnd}, gracePeriodEnd=${lifecycle.gracePeriodEnd}, billingAnchorDay=${lifecycle.billingAnchorDay}`);

          // Avoid unnecessary API requests by returning immediately as soon as the latest qualifying order is found
          return {
            verified: true,
            status: lifecycle.status,
            hasActiveAccess: lifecycle.hasActiveAccess,
            order,
            currentPeriodEnd: lifecycle.currentPeriodEnd,
            gracePeriodEnd: lifecycle.gracePeriodEnd,
            billingAnchorDay: lifecycle.billingAnchorDay,
            shopifyOrderId: order.id,
            shopifyCustomerId: `gid://shopify/Customer/${numericCustomerId}`,
            message: lifecycle.hasActiveAccess
              ? (lifecycle.isGraceActive
                  ? `Subscription period ended on ${lifecycle.currentPeriodEnd}. Active in 72-hour grace period until ${lifecycle.gracePeriodEnd}.`
                  : `Verified active recurring subscription order (${order.name || order.id}) for Shopify Customer gid://shopify/Customer/${numericCustomerId}. Access valid until ${lifecycle.currentPeriodEnd}.`)
              : `Subscription period and 72-hour grace period expired on ${lifecycle.gracePeriodEnd} without a paid renewal.`,
          };
        }

        hasNextPage = Boolean(pageInfo?.hasNextPage);
        endCursor = pageInfo?.endCursor || null;
        if (!hasNextPage || !endCursor) {
          break;
        }
      }

      return {
        verified: false,
        status: 'pending',
        hasActiveAccess: false,
        message: `No active, paid subscription order matching plan ${expectedSellingPlanId} found for Customer ${numericCustomerId}.`,
      };
    } catch (err: any) {
      console.warn(`[Shopify Phase 3] Error querying customer orders for ${numericCustomerId}:`, err.message);
      return {
        verified: false,
        error: true,
        status: 'pending',
        hasActiveAccess: false,
        message: `Failed to query orders for customer ${numericCustomerId}: ${err.message}`,
      };
    }
  }

  public static readonly INITIAL_ORDER_SCAN_PAGE_SIZE = 50;
  public static readonly INITIAL_ORDER_SCAN_MAX_PAGES = 10;

  /**
   * Normalizes a Shopify Customer GID or numeric string into its canonical numeric ID string.
   */
  public static normalizeCustomerId(customerId?: string | null): string {
    return (customerId || '').trim().replace(/^gid:\/\/shopify\/Customer\//, '').trim();
  }

  /**
   * Retrieves the server-only HMAC secret for customer binding proofs.
   * Preferred: SUBSCRIPTION_BINDING_SECRET, fallback: SHOPIFY_API_SECRET.
   */
  private static getBindingSecret(): string | null {
    const preferred = process.env.SUBSCRIPTION_BINDING_SECRET?.trim();
    if (preferred) return preferred;
    const fallback = process.env.SHOPIFY_API_SECRET?.trim();
    if (fallback) return fallback;
    return null;
  }

  /**
   * Generates a server-side HMAC-SHA256 binding proof tying a verified Shopify Customer ID,
   * initial subscription order ID, and billing anchor day to an authenticated Firebase UID.
   * Payload format: "firebaseUid|normalizedShopifyCustomerId|initialOrderId|billingAnchorDay"
   */
  public static signCustomerBinding(params: {
    firebaseUid: string;
    shopifyCustomerId: string;
    initialOrderId: string;
    billingAnchorDay: number;
  }): string | undefined {
    const secret = this.getBindingSecret();
    const uid = (params.firebaseUid || '').trim();
    const normalizedCustomer = this.normalizeCustomerId(params.shopifyCustomerId);
    const initialOrderId = this.formatGid(params.initialOrderId, 'Order');
    const anchor = params.billingAnchorDay;

    if (!secret || !uid || !normalizedCustomer || !initialOrderId || !Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
      return undefined;
    }

    const payload = `${uid}|${normalizedCustomer}|${initialOrderId}|${anchor}`;
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }

  /**
   * Verifies a stored customer binding proof using constant-time comparison.
   * Never trusts a stored shopifyCustomerId without a valid HMAC proof.
   */
  public static verifyCustomerBinding(params: {
    firebaseUid?: string | null;
    shopifyCustomerId?: string | null;
    initialOrderId?: string | null;
    billingAnchorDay?: number | null;
    proof?: string | null;
  }): boolean {
    const secret = this.getBindingSecret();
    const uid = (params.firebaseUid || '').trim();
    const normalizedCustomer = this.normalizeCustomerId(params.shopifyCustomerId);
    const initialOrderId = params.initialOrderId ? this.formatGid(params.initialOrderId, 'Order') : '';
    const anchor = params.billingAnchorDay;
    const proof = (params.proof || '').trim().toLowerCase();

    if (!secret || !uid || !normalizedCustomer || !initialOrderId || !anchor || !Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
      return false;
    }

    if (!/^[a-f0-9]{64}$/.test(proof)) {
      return false;
    }

    const payload = `${uid}|${normalizedCustomer}|${initialOrderId}|${anchor}`;
    const expectedHex = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const providedBuf = Buffer.from(proof, 'hex');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Server-side cryptographic & API verification directly with Shopify Admin API.
   * Supports:
   * - HMAC-verified customer ownership before trusting stored shopifyCustomerId
   * - Phase 2: Recurring order verification using cryptographically bound shopifyCustomerId
   * - Phase 1 & Resubscription Discovery: Paginated initial-order scan (50/page, max 10 pages)
   *   with two-hop Customer B recurring order follow-through when Cycle 1 already expired.
   */
  public static async verifyWithShopify(params: {
    userId: string;
    userEmail: string;
    shopifyCustomerId?: string;
    initialOrderId?: string;
    customerBindingProof?: string;
    orderOrContractId?: string;
    existingSubscriptionId?: string;
    billingAnchorDay?: number | null;
  }): Promise<{
    verified: boolean;
    status: 'pending' | 'active' | 'cancelled' | 'expired' | 'paused';
    hasActiveAccess?: boolean;
    currentPeriodEnd?: string;
    gracePeriodEnd?: string;
    billingAnchorDay?: number;
    initialOrderId?: string;
    customerBindingProof?: string;
    message: string;
    shopifyContractId?: string;
    shopifyOrderId?: string;
    shopifyCustomerId?: string;
    error?: boolean;
  }> {
    const config = this.getConfigStatus();

    if (!config.storeDomainConfigured) {
      return {
        verified: false,
        status: 'pending',
        hasActiveAccess: false,
        message: 'Shopify store domain is not configured on the server.',
      };
    }

    if (!config.adminTokenConfigured && !config.clientCredentialsActive) {
      return {
        verified: false,
        status: 'pending',
        hasActiveAccess: false,
        message: 'Shopify Admin API access is not configured on the server.',
      };
    }

    const cleanUserId = (params.userId || '').trim();

    if (!cleanUserId) {
      return {
        verified: false,
        status: 'pending',
        hasActiveAccess: false,
        message: 'No authenticated Firebase UID provided for verification.',
      };
    }

    const expectedSellingPlanId = 'gid://shopify/SellingPlan/692445053203';
    const existingCustomerId = (params.shopifyCustomerId || '').trim();
    const explicitOrderTarget = (params.orderOrContractId || '').trim();
    const targetId = (params.orderOrContractId || params.existingSubscriptionId || '').trim();

    // Enforce server-side HMAC customer ownership proof before trusting stored shopifyCustomerId.
    const hasValidCustomerBinding = Boolean(
      existingCustomerId &&
      this.verifyCustomerBinding({
        firebaseUid: cleanUserId,
        shopifyCustomerId: existingCustomerId,
        initialOrderId: params.initialOrderId,
        billingAnchorDay: params.billingAnchorDay,
        proof: params.customerBindingProof,
      })
    );

    if (existingCustomerId && !hasValidCustomerBinding) {
      console.warn(`[Shopify Security] Stored shopifyCustomerId (${existingCustomerId}) for UID ${cleanUserId} lacks valid HMAC proof. Re-establishing ownership via Shopify initial order.`);
    }

    const trustedExistingCustomerId = hasValidCustomerBinding ? existingCustomerId : '';
    const cleanTrustedExistingCustomer = this.normalizeCustomerId(trustedExistingCustomerId);
    const trustedAnchorDay = hasValidCustomerBinding ? (params.billingAnchorDay ?? undefined) : undefined;
    const checkedCustomerIds = new Set<string>();

    let hadApiOutage = false;
    let expiredRecurringFallback: {
      verified: boolean;
      status: 'pending' | 'active' | 'cancelled' | 'expired' | 'paused';
      hasActiveAccess?: boolean;
      currentPeriodEnd?: string;
      gracePeriodEnd?: string;
      billingAnchorDay?: number;
      initialOrderId?: string;
      customerBindingProof?: string;
      message: string;
      shopifyContractId?: string;
      shopifyOrderId?: string;
      shopifyCustomerId?: string;
      processedAtMs?: number;
    } | null = null;

    const recordExpiredFallback = (candidate: NonNullable<typeof expiredRecurringFallback>) => {
      if (!expiredRecurringFallback) {
        expiredRecurringFallback = candidate;
        return;
      }
      const existingTs = expiredRecurringFallback.processedAtMs || 0;
      const candidateTs = candidate.processedAtMs || 0;
      if (candidateTs > existingTs) {
        expiredRecurringFallback = candidate;
      }
    };

    console.log(
      '[Shopify Diagnostics: Verification] Outbound Admin API check for UID:',
      cleanUserId,
      'Trusted Customer ID:',
      trustedExistingCustomerId || 'none',
      'Anchor Day:',
      trustedAnchorDay || 'auto-derive',
      'Target:',
      targetId || 'store-scan'
    );

    const resolveInitialAnchorAndId = (order: any, orderCustomerId?: string): { anchor: number; initialOrderId: string } => {
      const cleanOrderCustomer = this.normalizeCustomerId(orderCustomerId);
      const isSameTrustedCustomer = Boolean(
        cleanTrustedExistingCustomer &&
        cleanOrderCustomer &&
        cleanTrustedExistingCustomer === cleanOrderCustomer
      );
      const orderTs = order.processedAt || order.createdAt;
      const derivedAnchor = new Date(orderTs).getUTCDate();
      if (isSameTrustedCustomer && trustedAnchorDay) {
        return {
          anchor: trustedAnchorDay,
          initialOrderId: params.initialOrderId || order.id,
        };
      }
      // Customer B (or unproved record): always derive anchor from initial order's processedAt/createdAt
      return {
        anchor: derivedAnchor,
        initialOrderId: order.id,
      };
    };

    const buildSignedOrderResult = (paramsResult: {
      order: any;
      lifecycle: ReturnType<typeof ShopifyService.evaluateOrderSubscriptionLifecycle>;
      customerId?: string;
      initialOrderId: string;
      message?: string;
    }) => {
      const anchor = paramsResult.lifecycle.billingAnchorDay;
      const customerBindingProof = paramsResult.customerId
        ? this.signCustomerBinding({
            firebaseUid: cleanUserId,
            shopifyCustomerId: paramsResult.customerId,
            initialOrderId: paramsResult.initialOrderId,
            billingAnchorDay: anchor,
          })
        : undefined;

      const ts = new Date(paramsResult.order.processedAt || paramsResult.order.createdAt || 0).getTime() || 0;

      return {
        verified: true,
        status: paramsResult.lifecycle.status,
        hasActiveAccess: paramsResult.lifecycle.hasActiveAccess,
        currentPeriodEnd: paramsResult.lifecycle.currentPeriodEnd,
        gracePeriodEnd: paramsResult.lifecycle.gracePeriodEnd,
        billingAnchorDay: anchor,
        initialOrderId: paramsResult.initialOrderId,
        customerBindingProof,
        shopifyOrderId: paramsResult.order.id,
        shopifyCustomerId: paramsResult.customerId,
        shopifyContractId: paramsResult.order.id,
        processedAtMs: ts,
        message:
          paramsResult.message ||
          (paramsResult.lifecycle.hasActiveAccess
            ? `Verified paid subscription order (${paramsResult.order.name || paramsResult.order.id}) with Shopify Admin API. Access valid until ${paramsResult.lifecycle.currentPeriodEnd}.`
            : `Subscription period and 72-hour grace period expired on ${paramsResult.lifecycle.gracePeriodEnd} without renewal.`),
      };
    };

    const stripInternalMeta = (res: NonNullable<typeof expiredRecurringFallback>) => {
      const { processedAtMs: _ignored, ...cleanRes } = res;
      return cleanRes;
    };

    // -------------------------------------------------------------------------
    // Phase 1 - Order Verification Step A (Priority when explicit orderOrContractId is supplied)
    // -------------------------------------------------------------------------
    if (explicitOrderTarget && (explicitOrderTarget.startsWith('gid://shopify/Order/') || /^\d+$/.test(explicitOrderTarget))) {
      try {
        const orderGid = this.formatGid(explicitOrderTarget, 'Order');
        const orderQuery = `
          query getOrderById($id: ID!) {
            order(id: $id) {
              id
              name
              displayFinancialStatus
              cancelledAt
              cancelReason
              createdAt
              processedAt
              disputes {
                id
                initiatedAs
                status
              }
              totalRefundedSet {
                shopMoney {
                  amount
                }
              }
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              customAttributes {
                key
                value
              }
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    title
                    sellingPlan {
                      sellingPlanId
                      name
                    }
                  }
                }
              }
            }
          }
        `;

        const res = await this.queryAdminGraphQL(orderQuery, { id: orderGid });
        const order = res?.order;

        if (order && this.isVerifiedSubscriptionOrder(order, cleanUserId, expectedSellingPlanId)) {
          const orderCustomerId = await this.getCustomerIdForOrder(order.id);
          const { anchor, initialOrderId } = resolveInitialAnchorAndId(order, orderCustomerId);
          const lifecycle = this.evaluateOrderSubscriptionLifecycle(order, Date.now(), anchor);

          if (lifecycle.eligible) {
            if (lifecycle.hasActiveAccess) {
              console.log(`[Shopify Phase 1] Verified explicit targeted order ${order.id} for UID ${cleanUserId}. Customer ID: ${orderCustomerId || 'none'}, anchor: ${lifecycle.billingAnchorDay}`);
              return stripInternalMeta(buildSignedOrderResult({
                order,
                lifecycle,
                customerId: orderCustomerId,
                initialOrderId,
              }));
            }

            // Explicit initial order was eligible but its Cycle 1 expired: follow through to Customer ID's recurring orders
            const cleanCust = this.normalizeCustomerId(orderCustomerId);
            if (orderCustomerId && cleanCust && !checkedCustomerIds.has(cleanCust)) {
              checkedCustomerIds.add(cleanCust);
              const followUp = await this.verifyCustomerRecurringOrders({
                shopifyCustomerId: orderCustomerId,
                expectedSellingPlanId,
                billingAnchorDay: lifecycle.billingAnchorDay,
              });
              if (followUp.error) {
                hadApiOutage = true;
              } else if (followUp.verified && followUp.order) {
                const followUpAnchor = followUp.billingAnchorDay ?? lifecycle.billingAnchorDay;
                const followUpProof = this.signCustomerBinding({
                  firebaseUid: cleanUserId,
                  shopifyCustomerId: orderCustomerId,
                  initialOrderId,
                  billingAnchorDay: followUpAnchor,
                });
                const followUpRes = {
                  verified: true,
                  status: followUp.status,
                  hasActiveAccess: followUp.hasActiveAccess,
                  currentPeriodEnd: followUp.currentPeriodEnd,
                  gracePeriodEnd: followUp.gracePeriodEnd,
                  billingAnchorDay: followUpAnchor,
                  initialOrderId,
                  customerBindingProof: followUpProof,
                  shopifyOrderId: followUp.shopifyOrderId || followUp.order.id,
                  shopifyCustomerId: followUp.shopifyCustomerId || orderCustomerId,
                  shopifyContractId: followUp.shopifyOrderId || followUp.order.id,
                  processedAtMs: new Date(followUp.order.processedAt || followUp.order.createdAt || 0).getTime() || 0,
                  message: followUp.message || `Verified recurring subscription order for customer ${orderCustomerId}.`,
                };
                if (followUp.hasActiveAccess) {
                  return stripInternalMeta(followUpRes);
                }
                recordExpiredFallback(followUpRes);
              } else {
                recordExpiredFallback(buildSignedOrderResult({
                  order,
                  lifecycle,
                  customerId: orderCustomerId,
                  initialOrderId,
                }));
              }
            }
          }
        }
      } catch (err: any) {
        hadApiOutage = true;
        console.warn('[Shopify Verification] Explicit targeted order query failed:', err.message);
      }
    }

    // -------------------------------------------------------------------------
    // Phase 2 & Phase 3: Recurring Subscription Order Verification via HMAC-verified shopifyCustomerId
    // -------------------------------------------------------------------------
    if (trustedExistingCustomerId) {
      checkedCustomerIds.add(cleanTrustedExistingCustomer);
      const recurringVerification = await this.verifyCustomerRecurringOrders({
        shopifyCustomerId: trustedExistingCustomerId,
        expectedSellingPlanId,
        billingAnchorDay: trustedAnchorDay,
      });

      if (recurringVerification.error) {
        hadApiOutage = true;
      }

      if (recurringVerification.verified && recurringVerification.order) {
        const resolvedAnchor =
          recurringVerification.billingAnchorDay ??
          trustedAnchorDay ??
          new Date(recurringVerification.order.processedAt || recurringVerification.order.createdAt).getUTCDate();
        const resolvedInitialId = params.initialOrderId || recurringVerification.order.id;
        const bindingProof = this.signCustomerBinding({
          firebaseUid: cleanUserId,
          shopifyCustomerId: trustedExistingCustomerId,
          initialOrderId: resolvedInitialId,
          billingAnchorDay: resolvedAnchor,
        });

        const resultObj = {
          verified: true,
          status: recurringVerification.status,
          hasActiveAccess: recurringVerification.hasActiveAccess,
          currentPeriodEnd: recurringVerification.currentPeriodEnd,
          gracePeriodEnd: recurringVerification.gracePeriodEnd,
          billingAnchorDay: resolvedAnchor,
          initialOrderId: resolvedInitialId,
          customerBindingProof: bindingProof,
          shopifyOrderId: recurringVerification.shopifyOrderId || recurringVerification.order.id,
          shopifyCustomerId: recurringVerification.shopifyCustomerId || trustedExistingCustomerId,
          shopifyContractId: recurringVerification.shopifyOrderId || recurringVerification.order.id,
          processedAtMs: new Date(recurringVerification.order.processedAt || recurringVerification.order.createdAt || 0).getTime() || 0,
          message: recurringVerification.message || `Verified recurring subscription order for customer ${trustedExistingCustomerId}.`,
        };

        if (recurringVerification.hasActiveAccess) {
          return stripInternalMeta(resultObj);
        }
        // Customer A's subscription expired: retain as fallback while scanning for a newer resubscription under Customer B
        recordExpiredFallback(resultObj);
      }
    }

    // -------------------------------------------------------------------------
    // Phase 1 - Order Verification Step A2: Targeted Query by existingSubscriptionId (if different from explicitOrderTarget)
    // -------------------------------------------------------------------------
    if (targetId && targetId !== explicitOrderTarget) {
      const isOrderTarget = targetId.startsWith('gid://shopify/Order/') || /^\d+$/.test(targetId);
      if (isOrderTarget) {
        try {
          const orderGid = this.formatGid(targetId, 'Order');
          const orderQuery = `
            query getOrderById($id: ID!) {
              order(id: $id) {
                id
                name
                displayFinancialStatus
                cancelledAt
                cancelReason
                createdAt
                processedAt
                disputes {
                  id
                  initiatedAs
                  status
                }
                totalRefundedSet {
                  shopMoney {
                    amount
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                customAttributes {
                  key
                  value
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      sellingPlan {
                        sellingPlanId
                        name
                      }
                    }
                  }
                }
              }
            }
          `;

          const res = await this.queryAdminGraphQL(orderQuery, { id: orderGid });
          const order = res?.order;

          if (order && this.isVerifiedSubscriptionOrder(order, cleanUserId, expectedSellingPlanId)) {
            const customerId = await this.getCustomerIdForOrder(order.id);
            const { anchor, initialOrderId } = resolveInitialAnchorAndId(order, customerId);
            const lifecycle = this.evaluateOrderSubscriptionLifecycle(order, Date.now(), anchor);
            if (lifecycle.eligible) {
              const resultObj = buildSignedOrderResult({
                order,
                lifecycle,
                customerId,
                initialOrderId,
              });
              if (lifecycle.hasActiveAccess) {
                return stripInternalMeta(resultObj);
              }
              recordExpiredFallback(resultObj);
            }
          }
        } catch (err: any) {
          hadApiOutage = true;
          console.warn('[Shopify Verification] Targeted order query failed:', err.message);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Phase 1 & Resubscription Discovery - Step B:
    // Paginated newest-first scan (50/page, max 10 pages = 500 orders) + Two-Hop Customer B Follow-Through
    // -------------------------------------------------------------------------
    try {
      const recentOrdersQuery = `
        query getRecentSubscriptionOrders($after: String) {
          orders(first: ${ShopifyService.INITIAL_ORDER_SCAN_PAGE_SIZE}, reverse: true, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
              node {
                id
                name
                displayFinancialStatus
                cancelledAt
                cancelReason
                createdAt
                processedAt
                disputes {
                  id
                  initiatedAs
                  status
                }
                totalRefundedSet {
                  shopMoney {
                    amount
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                customAttributes {
                  key
                  value
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      sellingPlan {
                        sellingPlanId
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      let hasNextPage = true;
      let endCursor: string | null = null;
      let pageCount = 0;

      while (hasNextPage && pageCount < ShopifyService.INITIAL_ORDER_SCAN_MAX_PAGES) {
        pageCount++;
        const listRes = await this.queryAdminGraphQL(recentOrdersQuery, { after: endCursor });
        const pageInfo = listRes?.orders?.pageInfo;
        const orderEdges = listRes?.orders?.edges || [];

        for (const edge of orderEdges) {
          const order = edge?.node;
          if (!order) continue;

          // Filter strictly by Firebase UID custom attribute + selling plan + payment/refund/chargeback state
          // BEFORE making any additional REST requests for customer identity.
          if (!this.isVerifiedSubscriptionOrder(order, cleanUserId, expectedSellingPlanId)) {
            continue;
          }

          // Two-Hop Discovery Step 1: Resolve Shopify Customer ID via getCustomerIdForOrder()
          const discoveredCustomerId = await this.getCustomerIdForOrder(order.id);
          const cleanDiscoveredCustomer = this.normalizeCustomerId(discoveredCustomerId);

          // Two-Hop Discovery Step 2 & 3: Derive billing anchor from initial order's processedAt (fallback createdAt)
          // and evaluate initial order lifecycle using that anchor.
          const { anchor: initialAnchorDay, initialOrderId } = resolveInitialAnchorAndId(order, discoveredCustomerId);
          const lifecycle = this.evaluateOrderSubscriptionLifecycle(order, Date.now(), initialAnchorDay);

          if (!lifecycle.eligible) {
            continue;
          }

          // Two-Hop Discovery Step 4: If active or within grace, return immediately with signed binding proof
          if (lifecycle.hasActiveAccess) {
            console.log(
              `[Shopify Phase 1] Verified subscription order from store scan (page ${pageCount}) ${order.id} (${order.name}) for UID ${cleanUserId}. Customer ID: ${discoveredCustomerId || 'none'}, anchor: ${lifecycle.billingAnchorDay}`
            );
            return stripInternalMeta(buildSignedOrderResult({
              order,
              lifecycle,
              customerId: discoveredCustomerId,
              initialOrderId,
            }));
          }

          // Two-Hop Discovery Step 5 & 6: Initial order is financially eligible but Cycle 1 expired.
          // Immediately inspect recurring orders for the newly discovered Customer ID using initial order's anchor.
          if (discoveredCustomerId && cleanDiscoveredCustomer && !checkedCustomerIds.has(cleanDiscoveredCustomer)) {
            checkedCustomerIds.add(cleanDiscoveredCustomer);
            console.log(
              `[Shopify Two-Hop Discovery] Initial order ${order.id} (page ${pageCount}) expired on ${lifecycle.gracePeriodEnd}; checking recurring orders for Customer ${discoveredCustomerId} with anchor ${lifecycle.billingAnchorDay}`
            );

            const followUp = await this.verifyCustomerRecurringOrders({
              shopifyCustomerId: discoveredCustomerId,
              expectedSellingPlanId,
              billingAnchorDay: lifecycle.billingAnchorDay,
            });

            if (followUp.error) {
              hadApiOutage = true;
            } else if (followUp.verified && followUp.order) {
              const followUpAnchor = followUp.billingAnchorDay ?? lifecycle.billingAnchorDay;
              const followUpProof = this.signCustomerBinding({
                firebaseUid: cleanUserId,
                shopifyCustomerId: discoveredCustomerId,
                initialOrderId,
                billingAnchorDay: followUpAnchor,
              });

              const followUpResult = {
                verified: true,
                status: followUp.status,
                hasActiveAccess: followUp.hasActiveAccess,
                currentPeriodEnd: followUp.currentPeriodEnd,
                gracePeriodEnd: followUp.gracePeriodEnd,
                billingAnchorDay: followUpAnchor,
                initialOrderId,
                customerBindingProof: followUpProof,
                shopifyOrderId: followUp.shopifyOrderId || followUp.order.id,
                shopifyCustomerId: followUp.shopifyCustomerId || discoveredCustomerId,
                shopifyContractId: followUp.shopifyOrderId || followUp.order.id,
                processedAtMs: new Date(followUp.order.processedAt || followUp.order.createdAt || 0).getTime() || 0,
                message: followUp.message || `Verified recurring subscription order for Customer ${discoveredCustomerId}.`,
              };

              if (followUp.hasActiveAccess) {
                console.log(
                  `[Shopify Two-Hop Discovery] Granted active access via Customer ${discoveredCustomerId} recurring order ${followUpResult.shopifyOrderId} (initialOrderId=${initialOrderId}, anchor=${followUpAnchor})`
                );
                return stripInternalMeta(followUpResult);
              }

              recordExpiredFallback(followUpResult);
              continue;
            }
          }

          recordExpiredFallback(buildSignedOrderResult({
            order,
            lifecycle,
            customerId: discoveredCustomerId,
            initialOrderId,
          }));
        }

        hasNextPage = Boolean(pageInfo?.hasNextPage);
        endCursor = pageInfo?.endCursor || null;
        if (!hasNextPage || !endCursor) {
          break;
        }
      }
    } catch (err: any) {
      hadApiOutage = true;
      console.warn('[Shopify Verification] Recent orders scan failed:', err.message);
    }

    // -------------------------------------------------------------------------
    // SubscriptionContract Check: If an active SubscriptionContract exists and matches cleanUserId
    // -------------------------------------------------------------------------
    if (targetId && targetId.startsWith('gid://shopify/SubscriptionContract/')) {
      try {
        const contractGid = this.formatGid(targetId, 'SubscriptionContract');
        const contractQuery = `
          query getSubscriptionContract($id: ID!) {
            subscriptionContract(id: $id) {
              id
              status
              nextBillingDate
              customer {
                id
                email
              }
              customAttributes {
                key
                value
              }
            }
          }
        `;

        const res = await this.queryAdminGraphQL(contractQuery, { id: contractGid });
        const contract = res?.subscriptionContract;

        if (contract) {
          const matchesUserId = Boolean(cleanUserId && contract.customAttributes?.some((a: any) => a.key === 'userId' && a.value === cleanUserId));
          if (matchesUserId) {
            const rawStatus = (contract.status || '').toUpperCase();
            const periodEnd = contract.nextBillingDate || undefined;
            if (rawStatus === 'ACTIVE') {
              return {
                verified: true,
                status: 'active',
                hasActiveAccess: true,
                currentPeriodEnd: periodEnd,
                shopifyContractId: contract.id,
                message: 'Verified active subscription contract on Shopify.',
              };
            }
          }
        }
      } catch (err: any) {
        hadApiOutage = true;
        console.warn('[Shopify Verification] Contract query failed:', err.message);
      }
    }

    if (hadApiOutage) {
      console.warn(`[Shopify Diagnostics: Verification] UID ${cleanUserId}: Shopify Admin API unreachable during verification.`);
      return {
        verified: false,
        error: true,
        status: 'pending',
        hasActiveAccess: false,
        message: 'Shopify Admin API is currently unreachable. Cached access cannot be extended without live verification.',
      };
    }

    if (expiredRecurringFallback) {
      return stripInternalMeta(expiredRecurringFallback);
    }

    console.log(`[Shopify Diagnostics: Verification] UID ${cleanUserId}: No verified paid subscription order or active contract found.`);

    return {
      verified: false,
      status: 'pending',
      hasActiveAccess: false,
      message: 'No confirmed active subscription contract or verified paid subscription order found on Shopify for this account.',
    };
  }
}
