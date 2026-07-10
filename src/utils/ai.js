/* SAMSARA v4.0 - AI configuration
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Single source of truth for the Claude model used across every AI
   feature (DEXA body scan, photo composition analysis, weight/waist
   estimation, bloodwork interpretation, weekly coaching summary).

   claude-sonnet-4-6 — current Sonnet: strong vision + reasoning at a
   fast, cost-efficient tier (the calls below run on every scan, so
   per-call cost and latency matter for a consumer app). It also
   accepts temperature:0, which the vision prompts rely on for
   run-to-run consistency.

   To upgrade the whole app to maximum-capability analysis, switch this
   to 'claude-opus-4-8' — but note Opus 4.8 rejects the `temperature`
   parameter (remove `temperature: 0` from the request builders first,
   or the API returns 400).
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const AI_MODEL = 'claude-sonnet-4-6';
