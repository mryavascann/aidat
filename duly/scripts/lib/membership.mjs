import { createHash, randomBytes } from 'node:crypto';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { address, call, readAs, u32 } from './soroban.mjs';

export async function ensureMember(admin, member, id) {
  const members = await readAs(id, 'members');
  if (members.includes(member.publicKey())) return {};
  // Use the real invitation flow; the plaintext code is never published in docs.
  const code = randomBytes(32);
  const hash = createHash('sha256').update(code).digest();
  const invitation = await call(admin, id, 'create_invite', [nativeToScVal(hash), u32(1), u32(720)]);
  const join = await call(member, id, 'join', [address(member.publicKey()), nativeToScVal(code)]);
  return { inviteHash: invitation.hash, joinHash: join.hash };
}
