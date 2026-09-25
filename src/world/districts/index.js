/* ------------------------------------------------------------------ *
 * District registry. Each entry is { name, build(ctx) }; see
 * world/index.js for what ctx carries and plan.js for where each block
 * is. Order matters only where one district reads spots another wrote.
 * ------------------------------------------------------------------ */

export const DISTRICTS = [];
