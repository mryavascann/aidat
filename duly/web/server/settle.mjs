import { timingSafeEqual } from "node:crypto";
import { queuedRoutes } from "./journal.mjs";
import { advanceExpense } from "./bank.mjs";
import { assertNetwork, reply } from "./runtime.mjs";
export async function settleQueue({ deadline = Date.now() + 95000 } = {}) {
  await assertNetwork();
  const routes = await queuedRoutes(),
    outcomes = [];
  for (const route of routes) {
    if (Date.now() > deadline) break;
    try {
      let result;
      for (let step = 0; step < 8 && Date.now() < deadline; step++) {
        result = await advanceExpense(route);
        if (["scheduled", "cancelled", "complete"].includes(result.phase))
          break;
      }
      outcomes.push({ ...route, phase: result?.phase ?? "pending" });
    } catch (error) {
      outcomes.push({ ...route, error: error.message });
    }
  }
  return outcomes;
}
export default async function handler(req, res) {
  const supplied = Buffer.from(req.headers?.authorization ?? ""),
    expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  if (
    !process.env.CRON_SECRET ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return reply(res, { error: "Unauthorized" }, 401);
  try {
    return reply(res, { results: await settleQueue() });
  } catch (error) {
    return reply(res, { error: error.message }, 500);
  }
}
