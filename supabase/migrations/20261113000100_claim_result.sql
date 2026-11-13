-- claim_result: save an anonymous result to the caller's account (feature 3, criterion 19;
-- ARCHITECTURE_SPEC.md 6.3).
--
-- One atomic update: the token hash must match, the result must have no owner and must not
-- have expired. On success it gets the caller as owner, and loses its expiry and token hash.
-- The hash is the lowercase hex SHA-256 of the token's UTF-8 bytes, as submit-quiz stores it.
-- Returns false when no row matched (wrong token, expired, already owned or no such result).
create function public.claim_result(p_id uuid, p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claimed uuid;
begin
  if v_uid is null then
    raise exception 'claim_result requires a logged-in member' using errcode = '42501';
  end if;

  update public.results
  set owner_id = v_uid, expires_at = null, claim_token_hash = null
  where id = p_id
    and owner_id is null
    and expires_at > now()
    and claim_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  returning id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke execute on function public.claim_result(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_result(uuid, text) to authenticated;
