// Public, browser-safe network configuration. No keys or local filesystem access.
import { Asset, Networks } from '@stellar/stellar-sdk';
export const NETWORK = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const ANCHOR = 'https://tr-mock-anchor.fly.dev';
export const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const USDC = new Asset('USDC', USDC_ISSUER);
export const TOKEN = USDC.contractId(NETWORK);
