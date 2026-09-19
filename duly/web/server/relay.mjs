import {
  Address,
  TOKEN,
  body,
  building,
  manifest,
  relayFunction,
  reply,
  scValToNative,
  wasmHash,
  xdr,
} from "./runtime.mjs";

const ACCOUNT_WASM =
  "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a";
export async function validateSponsoredFunction(func) {
  if (func.type === "hostFunctionTypeCreateContractV2") {
    const executable = func.createContractV2.executable;
    if (
      executable.type !== "contractExecutableWasm" ||
      Buffer.from(executable.wasmHash.value).toString("hex") !== ACCOUNT_WASM
    )
      throw new Error("Only the configured passkey account may be deployed.");
    return;
  }
  if (func.type !== "hostFunctionTypeInvokeContract")
    throw new Error("Unsupported sponsored operation.");
  const invocation = func.invokeContract;
  const target = Address.fromScAddress(invocation.contractAddress).toString();
  const method = invocation.functionName.toString();
  const deployment = await manifest();
  if (
    [deployment.factory, ...(deployment.priorFactories ?? [])].includes(
      target,
    ) &&
    method === "create"
  )
    return;
  const code = await wasmHash(target);
  if (
    [
      deployment.wasmHash,
      deployment.demoWasmHash,
      ...(deployment.priorWasmHashes ?? []),
    ].includes(code)
  ) {
    await building(target);
    return;
  }
  if (code !== ACCOUNT_WASM || method !== "execute")
    throw new Error("Sponsor only supports Duly building actions.");
  const innerTarget = scValToNative(invocation.args[0]);
  const innerMethod = scValToNative(invocation.args[1]);
  if (
    [deployment.factory, ...(deployment.priorFactories ?? [])].includes(
      innerTarget,
    ) &&
    innerMethod === "create"
  )
    return;
  if (innerTarget === TOKEN && innerMethod === "transfer") return;
  await building(innerTarget);
}

export default async function handler(req, res) {
  try {
    const request = await body(req);
    if (
      typeof request.func !== "string" ||
      !Array.isArray(request.auth) ||
      request.auth.length > 16
    )
      throw new Error("Invalid authorization request.");
    const func = xdr.HostFunction.fromXdr(request.func, "base64");
    const auth = request.auth.map((value) =>
      xdr.SorobanAuthorizationEntry.fromXdr(value, "base64"),
    );
    if (!auth.length) throw new Error("A passkey authorization is required.");
    await validateSponsoredFunction(func);
    const result = await relayFunction(func, auth);
    reply(
      res,
      {
        success: !result.pending,
        data: { ...result, status: result.pending ? "PENDING" : "SUCCESS" },
      },
      result.pending ? 202 : 200,
    );
  } catch (error) {
    reply(res, { success: false, error: error.message }, 400);
  }
}
