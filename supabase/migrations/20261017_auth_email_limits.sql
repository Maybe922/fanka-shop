-- OTP emails are sent only by the website after this atomic reservation.
-- No email addresses, IP addresses or OTPs are stored in this table.
create table if not exists public.auth_email_requests (
  id bigint generated always as identity primary key,
  email_key text not null,
  ip_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_email_requests_created_idx on public.auth_email_requests(created_at);
alter table public.auth_email_requests enable row level security;
revoke all on public.auth_email_requests from public, anon, authenticated;

create or replace function public.reserve_auth_email(p_email_key text, p_ip_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_last timestamptz;
begin
  if p_email_key is null or p_ip_key is null or p_email_key !~ '^[a-f0-9]{64}$' or p_ip_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid quota key';
  end if;
  -- Serialize check + insert across processes and concurrent requests.
  perform pg_advisory_xact_lock(7164017101);
  v_now := clock_timestamp();
  delete from public.auth_email_requests where created_at < v_now - interval '48 hours';
  select max(created_at) into v_last from public.auth_email_requests where email_key = p_email_key;
  if v_last > v_now - interval '60 seconds' then
    return jsonb_build_object('allowed',false,'reason','cooldown','retryAfter',ceil(extract(epoch from v_last + interval '60 seconds' - v_now)));
  end if;
  if (select count(*) from public.auth_email_requests where email_key=p_email_key and created_at>v_now-interval '24 hours') >= 5 then
    return jsonb_build_object('allowed',false,'reason','email_daily');
  end if;
  if (select count(*) from public.auth_email_requests where ip_key=p_ip_key and created_at>v_now-interval '24 hours') >= 20 then
    return jsonb_build_object('allowed',false,'reason','ip_daily');
  end if;
  if (select count(*) from public.auth_email_requests where ip_key=p_ip_key and created_at>v_now-interval '15 minutes') >= 5 then
    return jsonb_build_object('allowed',false,'reason','ip_burst');
  end if;
  if (select count(*) from public.auth_email_requests where created_at>v_now-interval '24 hours') >= 200 then
    return jsonb_build_object('allowed',false,'reason','site_daily');
  end if;
  insert into public.auth_email_requests(email_key,ip_key,created_at) values(p_email_key,p_ip_key,v_now);
  return jsonb_build_object('allowed',true,'retryAfter',60);
end;
$$;
revoke all on function public.reserve_auth_email(text,text) from public, anon, authenticated;
grant execute on function public.reserve_auth_email(text,text) to service_role;

-- Configure this as Supabase Auth's Send Email Postgres hook AFTER deploying
-- the website's admin.generateLink + Brevo SMTP sender. Public Auth endpoints
-- must never bypass the website quota by using Supabase's built-in sender.
create or replace function public.block_direct_auth_email(event jsonb)
returns jsonb language sql set search_path = '' as $$
  select '{"error":{"http_code":429,"message":"Please request your login code through the website."}}'::jsonb;
$$;
revoke all on function public.block_direct_auth_email(jsonb) from public, anon, authenticated;
grant execute on function public.block_direct_auth_email(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
