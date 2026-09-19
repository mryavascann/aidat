// V3 is a separate deployment. V2 funds, keys and public evidence are preserved.
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Address, Operation, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  ROOT,
  TOKEN,
  address,
  assertTestnet,
  call,
  i128,
  json,
  keyAt,
  readAs,
  send,
  string,
} from "./lib/soroban.mjs";
import { withState, journaled } from "./lib/state.mjs";
import { funded, wasmHash, server } from "../web/server/runtime.mjs";

const struct = (fields) =>
  xdr.ScVal.scvMap(
    Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([k, v]) =>
          new xdr.ScMapEntry({
            key: nativeToScVal(k, { type: "symbol" }),
            val: v,
          }),
      ),
  );
await assertTestnet();
const bank = await keyAt(".duly-bank-v3-key", { create: true });
process.env.DULY_BANK_SECRET = bank.secret();
const owners = await Promise.all(
  [1, 2, 3].map((n) => keyAt(`.duly-owner-v3-${n}-key`, { create: true })),
);
for (const key of [bank, ...owners]) await funded(key);
const vault = JSON.parse(
  await readFile(`${ROOT}/web/src/deployment.json`, "utf8"),
).vault;
const accountWasmHash =
  "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a";
const webauthnVerifier =
  "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F";
const verifierHash = await wasmHash(webauthnVerifier);
if (
  verifierHash !==
  "e63a030d0f1a1481e36059a4837c433083b33e704c1f9625b7314795b6d72b76"
)
  throw new Error("Unexpected WebAuthn verifier.");
const code = await server.getLedgerEntries(
  xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({
      hash: Buffer.from(accountWasmHash, "hex"),
    }),
  ),
);
if (!code.entries.length)
  throw new Error("Pinned smart account WASM is unavailable.");
await withState(async (state, save) => {
  const flow = (state["building-v3-release"] ??= {
    salt: randomBytes(32).toString("hex"),
    buildingSalt: randomBytes(32).toString("hex"),
  });
  await save();
  const j = (step, fn) => journaled(flow, step, save, fn);
  const hashes = {};
  for (const [key, path] of Object.entries({
    wasmHash: "duly_building_v3.wasm",
    demoWasmHash: "duly_building_demo_v3.wasm",
    factoryWasmHash: "duly_factory_v3.wasm",
  })) {
    const wasm = await readFile(`${ROOT}/deployments/${path}`);
    hashes[key] = createHash("sha256").update(wasm).digest("hex");
    if (flow.hashes?.[key] && flow.hashes[key] !== hashes[key])
      throw new Error(
        "V3 deployment bytes changed. Keep the old deployment and explicitly version a new one.",
      );
    await j(`upload:${key}`, (onSigned) =>
      send(bank, Operation.uploadContractWasm({ wasm }), {
        onSigned,
        label: `Upload ${path}`,
      }),
    );
  }
  flow.hashes = hashes;
  await save();
  const factory = await j("factory", (onSigned) =>
    send(
      bank,
      Operation.createCustomContract({
        address: new Address(bank.publicKey()),
        wasmHash: Buffer.from(hashes.factoryWasmHash, "hex"),
        salt: Buffer.from(flow.salt, "hex"),
        constructorArgs: [
          struct({
            wasm: nativeToScVal(Buffer.from(hashes.wasmHash, "hex")),
            demo_wasm: nativeToScVal(Buffer.from(hashes.demoWasmHash, "hex")),
            token: address(TOKEN),
            bank: address(bank.publicKey()),
            vault: address(vault),
          }),
        ],
      }),
      { onSigned, label: "Deploy immutable Duly factory" },
    ),
  );
  const building = await j("building", (onSigned) =>
    call(
      owners[0],
      factory.value,
      "create",
      [
        address(owners[0].publicKey()),
        nativeToScVal(owners.map((k) => new Address(k.publicKey()))),
        string("Duly Apartmanı"),
        i128(20_000),
        nativeToScVal(Buffer.from(flow.buildingSalt, "hex")),
        nativeToScVal(false),
      ],
      { onSigned },
    ),
  );
  const config = await readAs(building.value, "config");
  if (
    config.demo ||
    config.seat_count !== 3 ||
    config.bank !== bank.publicKey() ||
    (await wasmHash(building.value)) !== hashes.wasmHash
  )
    throw new Error("V3 verification failed.");
  const manifest = {
    version: 3,
    priorWasmHashes: [
      "901c273ddc80300878b06064def059e45e73f41ae6c6fbc3a6fbde332cc044ee",
      "67ee22cf3e46cfa00bb236bce11de6599092a0cd101747271c2fd61124cbec2c",
    ],
    priorFactories: [
      "CAGZ4D6LC5IZKUYAWXHSTABW2N3WHIFH2DT7VS7HRK3ODYKDO4CBTD4N",
    ],
    network: "testnet",
    treasury: building.value,
    factory: factory.value,
    ...hashes,
    bank: bank.publicKey(),
    token: TOKEN,
    vault,
    accountWasmHash,
    webauthnVerifier,
    verifierHash,
  };
  await writeFile(
    `${ROOT}/web/src/building-deployment.json`,
    json(manifest) + "\n",
  );
  await writeFile(
    `${ROOT}/deployments/building-testnet-v3.json`,
    json({
      ...manifest,
      createdAt: new Date().toISOString(),
      config,
      receipts: Object.fromEntries(
        Object.entries(flow)
          .filter(([, v]) => v?.result?.hash)
          .map(([k, v]) => [k, v.result.hash]),
      ),
    }) + "\n",
  );
  console.log(json(manifest));
});
