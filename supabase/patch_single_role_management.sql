-- Normalize demo management accounts so each account has exactly one role.
-- Safe to run after seed_showcase.sql on an existing dev database.
-- Demo password for management accounts: Demo@123456

begin;

create or replace function public.seed_demo_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  encrypted_pw text;
begin
  encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    encrypted_pw,
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'avatar_url', p_avatar_url),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  if to_regclass('auth.identities') is not null then
    insert into auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      p_email,
      p_user_id,
      jsonb_build_object('sub', p_user_id::text, 'email', p_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  return p_user_id;
end;
$$;

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000201',
  'thao.staff@tourbook.demo',
  'Demo@123456',
  'Thảo Lê',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000301',
  'huy.admin@tourbook.demo',
  'Demo@123456',
  'Huy Võ',
  'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000401',
  'ngoc.superadmin@tourbook.demo',
  'Demo@123456',
  'Ngọc Đặng',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'
);

update public.profiles
set
  phone = case id
    when '00000000-0000-0000-0000-000000000201' then '0909 111 201'
    when '00000000-0000-0000-0000-000000000301' then '0909 111 301'
    when '00000000-0000-0000-0000-000000000401' then '0909 111 401'
    else phone
  end,
  address = case id
    when '00000000-0000-0000-0000-000000000201' then 'Quận Bình Thạnh, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000301' then 'Quận 1, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000401' then 'Quận 7, TP. Hồ Chí Minh'
    else address
  end,
  updated_at = now()
where id in (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000401'
);

delete from public.user_roles
where user_id in (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000401'
);

insert into public.user_roles (user_id, role_id, assigned_by)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000401')
on conflict (user_id, role_id) do nothing;

drop function if exists public.seed_demo_user(uuid, text, text, text, text);

commit;
