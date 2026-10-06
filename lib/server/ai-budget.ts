import type {Queryable} from './db';
export class AiBudgetError extends Error {}
// Caller holds the workspace row lock; never release reservations on uncertain failures.
export async function aiReservation(q:Queryable,wid:string){
 const cost=Number(process.env.AI_RUN_RESERVATION_USD||'.10');
 const daily=Number(process.env.AI_DAILY_LIMIT_USD||'2'),monthly=Number(process.env.AI_MONTHLY_LIMIT_USD||'10');
 if(![cost,daily,monthly].every(n=>Number.isFinite(n)&&n>0))throw new AiBudgetError('BUDGET_LIMIT');
 const spent=(await q.query("SELECT coalesce(sum(cost_estimate) FILTER (WHERE created_at>date_trunc('day',now())),0) AS daily,coalesce(sum(cost_estimate),0) AS monthly FROM (SELECT cost_estimate,created_at FROM generation_run WHERE workspace_id=$1 AND created_at>=date_trunc('month',now()) UNION ALL SELECT cost_estimate,created_at FROM ai_interpretation WHERE workspace_id=$1 AND created_at>=date_trunc('month',now())) r",[wid])).rows[0];
 if(Number(spent.daily)+cost>daily||Number(spent.monthly)+cost>monthly)throw new AiBudgetError('BUDGET_LIMIT');
 return cost;
}
