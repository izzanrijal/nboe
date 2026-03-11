

# Sync Migrations & Consolidate for Portability

## Issue Found

**Critical bug**: The "Hapus Audio" feature added previously will fail because there is **no storage RLS policy allowing admins to delete from the `exam-audio` bucket**. The migrations only define INSERT and SELECT policies for that bucket.

## Plan

### 1. Add missing storage policy (new migration)

```sql
CREATE POLICY "Admins can delete exam audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-audio' AND public.has_role(auth.uid(), 'admin'));
```

### 2. Create consolidated seed migration

Create a single file `supabase/migrations/00000000000000_seed.sql` that contains the **complete** database setup in one place — all tables, columns, functions, triggers, RLS policies, storage buckets, and storage policies — as they exist today. This serves as documentation and makes it easy to set up a fresh Supabase instance.

The existing 8 incremental migrations will remain untouched (they're already applied). The seed file acts as a reference/portable setup script with clear comments for each section:

1. **Enums** — `app_role`
2. **Tables** — profiles, user_roles, clinical_cases, case_assets, exam_sessions, exam_results (with all columns including nim, reading_time_seconds, questions_text, answer_key_text, category, answer_text)
3. **Functions** — `has_role()`, `handle_new_user()`, `regenerate_station_session()`
4. **Triggers** — `on_auth_user_created`
5. **RLS Policies** — all table policies including public read and claim policies
6. **Storage** — buckets + all storage policies (including the new delete policy)
7. **Realtime** — `supabase_realtime` publication

### 3. Update edge function CORS headers

`register-candidate` has outdated CORS headers (missing the `x-supabase-client-*` headers). Sync it with the pattern used in `evaluate-exam` and `exam-chat`.

## Files Changed

| File | Action |
|------|--------|
| New migration SQL | Add `Admins can delete exam audio` storage policy |
| `supabase/migrations/00000000000000_seed.sql` | Create consolidated reference migration |
| `supabase/functions/register-candidate/index.ts` | Update CORS headers |

