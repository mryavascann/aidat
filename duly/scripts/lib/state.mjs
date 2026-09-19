import { open, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, json, resumeTransaction } from './soroban.mjs';

const path = resolve(ROOT, '.duly-state.json');
const lockPath = resolve(ROOT, '.duly-state.lock');

export async function withState(run) {
  // Two concurrent scripts must never race a source sequence or a bank order.
  const lock = await open(lockPath, 'wx', 0o600).catch(error => {
    if (error.code === 'EEXIST') throw new Error('Another Duly script owns .duly-state.lock. If it crashed, verify no script is running before removing that lock.');
    throw error;
  });
  try {
    await lock.writeFile(String(process.pid));
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = {}; }
    const save = async () => {
      await writeFile(`${path}.tmp`, `${json(state)}\n`, { mode: 0o600 });
      await rename(`${path}.tmp`, path);
    };
    await run(state, save);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

/** Persist the signed envelope before submission; resume the identical tx. */
export async function journaled(flow, step, save, send, resume = resumeTransaction) {
  const prior = flow[step];
  if (prior?.result) return prior.result;
  const result = prior
    ? await resume(prior, step)
    : await send(async signed => { flow[step] = signed; await save(); });
  flow[step] = { ...flow[step], result };
  await save();
  return result;
}
