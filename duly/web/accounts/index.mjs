// Serialized boundary: upstream Smart Account Kit supports SDK 16.3, while
// Duly's treasury/anchor clients use SDK 17. Never exchange SDK objects here.
import { SmartAccountKit, IndexedDBStorage } from "smart-account-kit";
import { xdr, TransactionBuilder } from "@stellar/stellar-sdk";

export const ACCOUNT_WASM =
  "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a";
export const WEBAUTHN_VERIFIER =
  "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F";

const storage = new IndexedDBStorage();
const network = "Test SDF Network ; September 2015";
const load = (key) =>
  JSON.parse(localStorage.getItem(`duly:v3:${key}`) ?? "null");
const save = (key, value) =>
  localStorage.setItem(`duly:v3:${key}`, JSON.stringify(value));
let kit;
let activeIntent;
let relaySend;
function account() {
  if (!kit) {
    kit = new SmartAccountKit({
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      accountWasmHash: ACCOUNT_WASM,
      webauthnVerifierAddress: WEBAUTHN_VERIFIER,
      relayerUrl: new URL("/api/relay", location.origin).href,
      storage,
      rpId: location.hostname,
      rpName: "Duly",
      allowedOrigins: [location.origin],
    });
    relaySend = kit.relayer.send.bind(kit.relayer);
    kit.relayer.send = async (func, auth) => {
      if (activeIntent) save(`passkey:${activeIntent}`, { func, auth });
      return relaySend(func, auth, { timeout: 120000 });
    };
  }
  return kit;
}

export async function createAccount(label) {
  if (!window.PublicKeyCredential)
    throw new Error("This browser does not support passkeys.");
  const client = account();
  let pending = load("account-creation");
  if (!pending) {
    const created = await client.createWallet("Duly", label, {
      autoSubmit: false,
    });
    pending = {
      contractId: created.contractId,
      credentialId: created.credentialId,
      payload: created.relayerPayload,
    };
    save("account-creation", pending);
  }
  const result = await relaySend(pending.payload.func, pending.payload.auth, {
    timeout: 120000,
  });
  if (!result.success)
    throw new Error(result.error ?? "Account deployment was not confirmed.");
  const confirmed = await client.rpc.getTransaction(result.hash);
  if (confirmed.status !== "SUCCESS")
    throw new Error(
      "Account confirmation is pending; resume this same account.",
    );
  const transaction = TransactionBuilder.fromXDR(
    confirmed.envelopeXdr,
    network,
  );
  const operation = transaction.operations[0];
  if (
    operation.type !== "invokeHostFunction" ||
    operation.func.toXDR("base64") !== pending.payload.func
  )
    throw new Error("Account deployment receipt mismatch.");
  // Supply verified birth evidence to the SDK; connectWallet independently
  // validates the constructor, code identity and a fresh ownership assertion.
  await storage.update(pending.credentialId, {
    deploymentStatus: "deployed",
    creationLedger: confirmed.ledger,
    creationTransactionHash: result.hash,
    deploymentTransactionHash: result.hash,
  });
  await client.connectWallet({
    credentialId: pending.credentialId,
    contractId: pending.contractId,
  });
  localStorage.removeItem("duly:v3:account-creation");
  return {
    address: pending.contractId,
    credentialId: pending.credentialId,
    hash: result.hash,
  };
}

export async function connectAccount(prompt = true) {
  const result = await account().connectWallet({ prompt });
  return result ? { address: result.contractId } : null;
}

export async function disconnectAccount() {
  await account().disconnect();
}

export async function invokeAccount(target, method, argumentXdrs, intent) {
  const client = account();
  const saved = load(`passkey:${intent}`);
  if (saved) {
    const resumed = await relaySend(saved.func, saved.auth, {
      timeout: 120000,
    });
    if (!resumed.success)
      throw new Error(resumed.error ?? "Saved authorization is pending.");
    return { hash: resumed.hash };
  }
  const args = argumentXdrs.map((value) => xdr.ScVal.fromXDR(value, "base64"));
  activeIntent = intent;
  try {
    const result = await client.executeAndSubmit(target, method, args);
    if (!result.success)
      throw new Error(result.error?.message ?? "Passkey transaction failed.");
    return { hash: result.hash };
  } finally {
    activeIntent = undefined;
  }
}
