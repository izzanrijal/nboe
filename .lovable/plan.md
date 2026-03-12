

# Edge Function Keep-Alive + Cron Job

## Edge Function: `supabase/functions/keep-alive/index.ts`
- Simple function that queries `SELECT count(*) FROM clinical_cases LIMIT 1` using the service role client
- Returns JSON with timestamp and status
- CORS headers included, `verify_jwt = false`

## Config Update: `supabase/config.toml`
- Add `[functions.keep-alive]` with `verify_jwt = false`

## Cron Job SQL (manual via SQL Editor)
Using `pg_cron` + `pg_net` to call the function 3x per week (Mon, Wed, Fri at 06:00 UTC):

```sql
select cron.schedule(
  'keep-alive-ping',
  '0 6 * * 1,3,5',
  $$
  select net.http_post(
    url:='https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/keep-alive',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vd2Viam13cnRrc3B2ZHdnZXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDU5NTksImV4cCI6MjA4ODEyMTk1OX0.q76OQE_qrCjgjWXuYpUIa1jW172KMmAxa9JyD4Bf5Ys"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

I'll provide the cron schedule values for the screenshot UI the user shared:
- **Job name**: `keep-alive-ping`
- **Job URL**: `https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/keep-alive`
- **Time interval**: depends on the app — if it supports cron expressions use `0 6 * * 1,3,5`, otherwise set to e.g. every 2-3 days
- **Request method**: GET (or POST)

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/keep-alive/index.ts` | New: simple query + response |
| `supabase/config.toml` | Add keep-alive function config |

User will need to enable `pg_cron` and `pg_net` extensions and run the SQL manually, or use the external cron app from the screenshot.

