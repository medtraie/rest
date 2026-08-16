# Debug Session: inventory-update-fail

## 1. Issue Description
- **Symptoms**: Adjusting empty stock or full stock updates the UI locally, but changes disappear after a page refresh. Data is not saved in Supabase.
- **Expected Behavior**: Changes should persist in Supabase and remain after a refresh.

## 2. Hypotheses
- **[OPEN] H1**: The `bottle_types` table is missing the `distributedquantity` column, causing `update` to fail or return `null`.
- **[OPEN] H2**: The `empty_bottles_stock` table does not exist or lacks RLS policies allowing `UPDATE`, causing the request to silently fail.
- **[OPEN] H3**: The `toWritePayload` function generates an empty payload for `empty_bottles_stock` due to missing column mappings.
- **[OPEN] H4**: The `update` function in `supabaseService.ts` catches an RLS or schema error and returns `null`, but the caller updates local state regardless.

## 3. Instrumentation Plan
- Modify `supabaseService.update` to log the exact `payload`, `table`, `id`, and the `response.error` returned by Supabase to the Debug Server.

## 4. Execution Log
- *Pending*