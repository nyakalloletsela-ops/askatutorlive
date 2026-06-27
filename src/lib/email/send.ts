/**
 * SECURITY NOTE
 * -------------
 * The `/lovable/email/transactional/send` endpoint is restricted to the
 * service role. Client/UI code MUST NOT call it directly with a user JWT —
 * otherwise any signed-in user could send arbitrary emails from the
 * platform's verified domain.
 *
 * To trigger an email from a UI action, create a dedicated server function
 * that:
 *   1. Authenticates the caller (`requireSupabaseAuth`).
 *   2. Verifies the caller owns or participates in the resource.
 *   3. Resolves the recipient server-side from trusted data, NOT from
 *      client input.
 *   4. Calls the send endpoint with `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * See `src/lib/booking-emails.functions.ts` for a reference implementation.
 */
export {}
