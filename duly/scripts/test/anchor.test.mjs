import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, Networks, WebAuth } from '@stellar/stellar-sdk';
import { statusAction, validateChallenge } from '../lib/anchor.mjs';

const server = Keypair.random();
const client = Keypair.random();
const domain = 'tr-mock-anchor.fly.dev';
const toml = { SIGNING_KEY: server.publicKey(), NETWORK_PASSPHRASE: Networks.TESTNET, WEB_AUTH_ENDPOINT: `https://${domain}/auth` };
const challenge = (signer = server, account = client.publicKey(), home = domain, auth = domain) =>
  WebAuth.buildChallengeTx(signer, account, home, 300, Networks.TESTNET, auth);

test('a valid SEP-10 challenge is accepted without being submitted', () => {
  const tx = validateChallenge(challenge(), toml, client.publicKey());
  assert.equal(tx.sequence, '0');
  assert.equal(tx.signatures.length, 1);
});

test('SEP-10 rejects server, user, domain and network substitutions', () => {
  assert.throws(() => validateChallenge(challenge(Keypair.random()), toml, client.publicKey()));
  assert.throws(() => validateChallenge(challenge(server, Keypair.random().publicKey()), toml, client.publicKey()));
  assert.throws(() => validateChallenge(challenge(server, client.publicKey(), 'attacker.test'), toml, client.publicKey()));
  assert.throws(() => validateChallenge(challenge(server, client.publicKey(), domain, 'attacker.test'), toml, client.publicKey()));
  assert.throws(() => validateChallenge(challenge(), { ...toml, NETWORK_PASSPHRASE: Networks.PUBLIC }, client.publicKey()));
});

test('anchor statuses distinguish waiting, action required and unsuccessful completion', () => {
  assert.equal(statusAction({ status: 'completed' }), 'complete');
  assert.equal(statusAction({ status: 'refunded' }), 'failed');
  assert.equal(statusAction({ status: 'pending_anchor', pending_reason: 'treasury_low' }), 'wait');
  assert.equal(statusAction({ status: 'pending_trust' }), 'trustline');
  assert.equal(statusAction({ status: 'pending_customer_info_update' }), 'customer');
  assert.equal(statusAction({ status: 'pending_transaction_info_update' }), 'details');
  assert.equal(statusAction({ status: 'on_hold' }), 'support');
  assert.throws(() => statusAction({ status: 'something_new' }));
});
