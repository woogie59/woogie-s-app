import { isAttendanceLogCompletedForBalance } from './sessionHelpers';

/** Completed attendance logs in chronological order → FIFO pack unit price per log id. */
export function buildFifoPriceByLogId(completedLogsAsc, batchRows) {
  const priceByLogId = {};
  const assignment = buildFifoBatchAssignmentByLogId(completedLogsAsc, batchRows);
  for (const [logId, { price }] of Object.entries(assignment)) {
    priceByLogId[logId] = price;
  }
  return priceByLogId;
}

/** FIFO consumption: each log → batch id + unit price. */
export function buildFifoBatchAssignmentByLogId(completedLogsAsc, batchRows) {
  const assignmentByLogId = {};
  const queue = [...(batchRows || [])]
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map((b) => ({
      batchId: b.id,
      price: Math.round(Number(b.price_per_session) || 0),
      remaining: Number(b.total_count) || 0,
    }))
    .filter((b) => b.remaining > 0);

  for (const log of completedLogsAsc || []) {
    if (!log?.id) continue;
    while (queue.length > 0 && queue[0].remaining <= 0) queue.shift();

    const snap = Math.round(Number(log.session_price_snapshot) || 0);
    if (queue.length > 0) {
      assignmentByLogId[log.id] = { batchId: queue[0].batchId, price: queue[0].price };
      queue[0].remaining -= 1;
    } else if (Number.isFinite(snap) && snap >= 0) {
      assignmentByLogId[log.id] = { batchId: null, price: snap };
    }
  }
  return assignmentByLogId;
}

export function buildAssignmentByLogIdForUsers(allLogs, batchesByUserId) {
  const assignmentByLogId = {};
  const logsByUser = {};

  for (const log of allLogs || []) {
    if (!isAttendanceLogCompletedForBalance(log)) continue;
    const uid = log?.user_id;
    if (!uid) continue;
    if (!logsByUser[uid]) logsByUser[uid] = [];
    logsByUser[uid].push(log);
  }

  for (const [uid, userLogs] of Object.entries(logsByUser)) {
    const sorted = [...userLogs].sort(
      (a, b) => new Date(a.check_in_at || 0) - new Date(b.check_in_at || 0),
    );
    const fifo = buildFifoBatchAssignmentByLogId(sorted, batchesByUserId[uid] || []);
    Object.assign(assignmentByLogId, fifo);
  }

  return assignmentByLogId;
}

/** Count completed sessions in `monthLogs` per session_batch id (FIFO assignment). */
export function countMonthConductedByBatchId(monthLogs, assignmentByLogId) {
  const counts = {};
  for (const log of monthLogs || []) {
    if (!isAttendanceLogCompletedForBalance(log)) continue;
    const batchId = assignmentByLogId[log.id]?.batchId;
    if (!batchId) continue;
    counts[batchId] = (counts[batchId] || 0) + 1;
  }
  return counts;
}

export function resolveLogUnitPriceWon(log, priceByLogId, profileFallback = null) {
  const fromFifo = priceByLogId?.[log?.id];
  if (fromFifo != null && Number.isFinite(fromFifo) && fromFifo >= 0) return fromFifo;

  const snap = Math.round(Number(log?.session_price_snapshot));
  if (Number.isFinite(snap) && snap >= 0) return snap;

  const profilePrice = Math.round(Number(profileFallback));
  if (Number.isFinite(profilePrice) && profilePrice >= 0) return profilePrice;

  return null;
}

export function buildPriceByLogIdForUsers(allLogs, batchesByUserId) {
  const priceByLogId = {};
  const logsByUser = {};

  for (const log of allLogs || []) {
    if (!isAttendanceLogCompletedForBalance(log)) continue;
    const uid = log?.user_id;
    if (!uid) continue;
    if (!logsByUser[uid]) logsByUser[uid] = [];
    logsByUser[uid].push(log);
  }

  for (const [uid, userLogs] of Object.entries(logsByUser)) {
    const sorted = [...userLogs].sort(
      (a, b) => new Date(a.check_in_at || 0) - new Date(b.check_in_at || 0),
    );
    const fifo = buildFifoPriceByLogId(sorted, batchesByUserId[uid] || []);
    Object.assign(priceByLogId, fifo);
  }

  return priceByLogId;
}

export function sumResolvedLogPrices(logs, priceByLogId, profilePriceByUserId = {}) {
  return (logs || []).reduce((sum, log) => {
    if (!isAttendanceLogCompletedForBalance(log)) return sum;
    const price = resolveLogUnitPriceWon(
      log,
      priceByLogId,
      profilePriceByUserId[log.user_id],
    );
    return sum + (price ?? 0);
  }, 0);
}

export function monthStatsFromLogs(logs, priceByLogId, profilePriceByUserId = {}) {
  const stats = { sum: 0, count: 0, prices: new Set() };
  for (const log of logs || []) {
    if (!isAttendanceLogCompletedForBalance(log)) continue;
    const price = resolveLogUnitPriceWon(
      log,
      priceByLogId,
      profilePriceByUserId[log.user_id],
    );
    stats.count += 1;
    if (price == null) continue;
    stats.sum += price;
    stats.prices.add(price);
  }
  return stats;
}

/** Trainer payout rate used in payroll ledger export. */
export const PAYROLL_TRAINER_RATE = 0.3;
