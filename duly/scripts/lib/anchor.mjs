import { StellarToml, WebAuth } from '@stellar/stellar-sdk';
import { ANCHOR, NETWORK, USDC_ISSUER } from './config.mjs';
import { toUnits } from './amounts.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const STELLAR_USDC = `stellar:USDC:${USDC_ISSUER}`;
const TRY = 'iso4217:TRY';
// Match the limits shown in Duly when the workshop omits its optional limits.
const SANDBOX_LIMITS = { min_onramp_try: '50', max_onramp_try: '3000', min_offramp_usdc: '1' };

function bankLimit(limits, name) {
  const value = limits?.[name] ?? SANDBOX_LIMITS[name];
  return typeof value === 'number' ? String(value) : value;
}

export function validateChallenge(transaction, toml, account) {
  if (toml.NETWORK_PASSPHRASE !== NETWORK) throw new Error('Anchor is not on Stellar testnet.');
  const result = WebAuth.readChallengeTx(
    transaction, toml.SIGNING_KEY, NETWORK, new URL(ANCHOR).hostname,
    new URL(toml.WEB_AUTH_ENDPOINT).hostname,
  );
  if (result.clientAccountID !== account || result.memo !== null) throw new Error('Anchor challenge names a different account.');
  return result.tx;
}

export function statusAction(transaction) {
  const status = transaction.status;
  if (status === 'completed') return 'complete';
  if (['error', 'expired', 'refunded', 'no_market', 'too_small', 'too_large'].includes(status)) return 'failed';
  if (status === 'pending_trust') return 'trustline';
  if (status === 'pending_customer_info_update') return 'customer';
  if (status === 'pending_transaction_info_update') return 'details';
  if (['pending_user', 'incomplete', 'on_hold'].includes(status)) return 'support';
  if (['pending_user_transfer_start', 'pending_user_transfer_complete', 'pending_external', 'pending_anchor', 'pending_stellar'].includes(status)) return 'wait';
  throw new Error(`Unknown anchor status: ${status}`);
}

export class AnchorClient {
  constructor(key) { this.key = key; }

  async discover() {
    this.toml = await StellarToml.Resolver.resolve(new URL(ANCHOR).hostname, { timeout: 30000 });
    if (this.toml.NETWORK_PASSPHRASE !== NETWORK) throw new Error('Unexpected anchor network.');
    if (!this.toml.CURRENCIES?.some(c => c.code === 'USDC' && c.issuer === USDC_ISSUER)) {
      throw new Error('Anchor does not support the expected Circle USDC issuer.');
    }
    for (const field of ['WEB_AUTH_ENDPOINT', 'TRANSFER_SERVER', 'KYC_SERVER', 'ANCHOR_QUOTE_SERVER']) {
      if (new URL(this.toml[field]).protocol !== 'https:') throw new Error(`Insecure anchor ${field}.`);
    }
    this.info = await this.request(`${this.toml.TRANSFER_SERVER}/info`, {}, false);
    this.health = await this.request(`${ANCHOR}/health`, {}, false);
    if (this.health.environment !== 'sandbox' || this.health.network_passphrase !== NETWORK) {
      throw new Error('These scripts only support the workshop testnet sandbox.');
    }
    return this;
  }

  async authenticate() {
    const url = new URL(this.toml.WEB_AUTH_ENDPOINT);
    url.searchParams.set('account', this.key.publicKey());
    url.searchParams.set('home_domain', new URL(ANCHOR).hostname);
    const challenge = await this.request(url, {}, false);
    if (challenge.network_passphrase && challenge.network_passphrase !== NETWORK) throw new Error('Challenge network mismatch.');
    const tx = validateChallenge(challenge.transaction, this.toml, this.key.publicKey());
    // SEP-10 challenges are validated and signed locally, never sent to Stellar.
    let signed;
    if (this.key.signTransaction) signed = await this.key.signTransaction(tx.toXDR());
    else { tx.sign(this.key); signed = tx.toXDR(); }
    const auth = await this.request(this.toml.WEB_AUTH_ENDPOINT, { method: 'POST', body: JSON.stringify({ transaction: signed }) }, false);
    if (typeof auth.token !== 'string' || !auth.token) throw new Error('Anchor returned no authentication token.');
    this.token = auth.token;
  }

  async request(url, options = {}, authenticated = true, refreshed = false) {
    if (authenticated && !this.token) await this.authenticate();
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${this.token}` } : {}), ...options.headers },
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (authenticated && !refreshed && (response.status === 401 || (response.status === 403 && data.type === 'authentication_required'))) {
      await this.authenticate();
      return this.request(url, options, true, true);
    }
    if (!response.ok) {
      const error = new Error(`Anchor ${response.status}: ${data.error ?? data.type ?? 'request failed'}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async start(kind, amount) {
    if (!this.info[kind]?.USDC?.enabled) throw new Error(`Anchor ${kind} is unavailable.`);
    const deposit = kind === 'deposit';
    const units = toUnits(amount, deposit ? 2 : 7);
    if (units <= 0n) throw new Error('Amount must be greater than zero.');
    const limits = this.health.limits;
    if (deposit) {
      const minimum = bankLimit(limits, 'min_onramp_try');
      const maximum = bankLimit(limits, 'max_onramp_try');
      if (units < toUnits(minimum, 2) || units > toUnits(maximum, 2)) {
        throw new Error(`Deposit must be ${minimum}–${maximum} TRY.`);
      }
    } else {
      const minimum = bankLimit(limits, 'min_offramp_usdc');
      if (units < toUnits(minimum)) throw new Error(`Withdrawal must be at least ${minimum} USDC.`);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const quote = await this.request(`${this.toml.ANCHOR_QUOTE_SERVER}/quote`, {
        method: 'POST', body: JSON.stringify({
          sell_asset: deposit ? TRY : STELLAR_USDC, buy_asset: deposit ? STELLAR_USDC : TRY,
          sell_amount: amount, context: 'sep6',
          [deposit ? 'sell_delivery_method' : 'buy_delivery_method']: 'bank_account',
        }),
      });
      if (!quote.id || !Number.isFinite(Date.parse(quote.expires_at))) throw new Error('Anchor returned an invalid quote.');
      if (Date.parse(quote.expires_at) <= Date.now()) continue;
      if (quote.sell_asset !== (deposit ? TRY : STELLAR_USDC) || quote.buy_asset !== (deposit ? STELLAR_USDC : TRY)) throw new Error('Quote asset mismatch.');
      if (toUnits(quote.sell_amount, deposit ? 2 : 7) !== units) throw new Error('Quote amount mismatch.');
      try {
        const params = new URLSearchParams({
          asset_code: 'USDC', asset_issuer: USDC_ISSUER,
          account: this.key.publicKey(), amount: quote.sell_amount,
          funding_method: 'bank_account', quote_id: quote.id,
          claimable_balance_supported: String(this.info.features?.claimable_balances === true),
        });
        // Workshop adapter: /deposit uses TRY, /withdraw uses USDC, and both
        // accept quote_id. Its exchange endpoint rejects full SEP-38 asset IDs.
        const flow = await this.request(`${this.toml.TRANSFER_SERVER}/${kind}?${params}`);
        if (!flow.id) throw new Error('Anchor did not return a transaction ID.');
        return { ...flow, quote };
      } catch (error) {
        if (error.status === 400 && /quote.*expir|expir.*quote/i.test(error.message)) continue;
        throw error;
      }
    }
    throw new Error('Could not obtain a fresh anchor quote.');
  }

  async simulateDeposit(id, amount) {
    // This endpoint is a sandbox bank event, never a real bank transfer.
    return this.request(`${this.toml.TRANSFER_SERVER}/tx/${encodeURIComponent(id)}/simulate-bank-transfer`, {
      method: 'POST', body: JSON.stringify({ amount }),
    });
  }

  async transaction(id) {
    const result = await this.request(`${this.toml.TRANSFER_SERVER}/transaction?${new URLSearchParams({ id })}`);
    if (result.transaction?.id !== id) throw new Error('Anchor transaction ID mismatch.');
    return result.transaction;
  }

  async wait(id, { ensureTrustline, onTransaction } = {}) {
    let previous;
    for (let attempt = 0; attempt < 60; attempt++) {
      const transaction = await this.transaction(id);
      if (onTransaction) await onTransaction(transaction);
      const action = statusAction(transaction);
      const status = `${transaction.status}${transaction.pending_reason ? ` (${transaction.pending_reason})` : ''}`;
      if (status !== previous) { console.log(`Anchor ${id}: ${status}`); previous = status; }
      if (action === 'complete') return transaction;
      if (action === 'failed') throw new Error(`Anchor ${id} ended with ${status}; resume by this ID, do not create another payment.`);
      if (action === 'trustline' && ensureTrustline) await ensureTrustline();
      else if (action !== 'wait') throw new Error(`Anchor ${id} needs ${action}; saved reference can be resumed after resolving it.`);
      await delay(2000);
    }
    throw new Error(`Anchor ${id} is still pending; rerun the same command to resume it.`);
  }
}
