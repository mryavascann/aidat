import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK } from "../../../scripts/lib/config.mjs";
export interface Signer {
  publicKey(): string;
  signTransaction(xdr: string): Promise<string>;
}
export function localSigner(secret: string): Signer {
  const key = Keypair.fromSecret(secret);
  return {
    publicKey: () => key.publicKey(),
    async signTransaction(envelope) {
      const tx = TransactionBuilder.fromXDR(envelope, NETWORK);
      tx.sign(key);
      return tx.toXDR();
    },
  };
}
let initialized = false;
export async function connectWallet(): Promise<Signer> {
  const [
    { StellarWalletsKit, Networks, SwkAppDarkTheme, SwkAppLightTheme },
    { FreighterModule },
    { xBullModule },
    { AlbedoModule },
  ] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    import("@creit.tech/stellar-wallets-kit/modules/albedo"),
  ]);
  if (!initialized) {
    StellarWalletsKit.init({
      network: Networks.TESTNET,
      modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
    });
    initialized = true;
  }
  StellarWalletsKit.setTheme(
    document.documentElement.dataset.theme === "dark"
      ? SwkAppDarkTheme
      : SwkAppLightTheme,
  );
  const { address } = await StellarWalletsKit.authModal();
  return {
    publicKey: () => address,
    async signTransaction(envelope) {
      const current = await StellarWalletsKit.fetchAddress();
      if (current.address !== address)
        throw new Error("Wallet account changed. Reconnect before signing.");
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(
        envelope,
        { networkPassphrase: NETWORK, address },
      );
      return signedTxXdr;
    },
  };
}
