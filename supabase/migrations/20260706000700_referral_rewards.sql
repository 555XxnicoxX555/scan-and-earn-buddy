alter table public.customer_profiles
add column if not exists referral_code text,
add column if not exists referred_by_customer_id uuid references public.customer_profiles(id) on delete set null;

create unique index if not exists customer_profiles_referral_code_key
on public.customer_profiles (referral_code)
where referral_code is not null;

update public.customer_profiles
set referral_code = upper(substr(regexp_replace(id::text, '-', '', 'g'), 1, 10))
where referral_code is null;

create or replace function public.handle_new_loyalty_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  selected_business_id text;
  selected_name text;
  signup_bonus integer;
  referrer_bonus integer;
  referred_bonus integer;
  referral_code_input text;
  new_referral_code text;
  referrer_profile public.customer_profiles%rowtype;
  initial_balance integer;
begin
  selected_business_id := coalesce(new.raw_user_meta_data->>'business_id', 'sumi');
  selected_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Cliente');
  referral_code_input := nullif(upper(trim(coalesce(new.raw_user_meta_data->>'referrer_code', ''))), '');

  insert into public.businesses (id, name)
  values (selected_business_id, selected_business_id)
  on conflict (id) do nothing;

  insert into public.business_loyalty_settings (business_id)
  values (selected_business_id)
  on conflict (business_id) do nothing;

  select
    coalesce(bls.signup_bonus_points, 40),
    coalesce(bls.referral_referrer_points, 0),
    coalesce(bls.referral_referred_points, 0)
  into signup_bonus, referrer_bonus, referred_bonus
  from public.business_loyalty_settings bls
  where bls.business_id = selected_business_id;

  signup_bonus := greatest(coalesce(signup_bonus, 40), 0);
  referrer_bonus := greatest(coalesce(referrer_bonus, 0), 0);
  referred_bonus := greatest(coalesce(referred_bonus, 0), 0);

  if referral_code_input is not null then
    select *
    into referrer_profile
    from public.customer_profiles cp
    where cp.business_id = selected_business_id
      and upper(cp.referral_code) = referral_code_input
    limit 1;
  end if;

  initial_balance := signup_bonus + case when referrer_profile.id is not null then referred_bonus else 0 end;

  insert into public.customer_profiles (auth_user_id, business_id, name, email, referred_by_customer_id)
  values (new.id, selected_business_id, selected_name, new.email, referrer_profile.id)
  returning id into profile_id;

  new_referral_code := upper(substr(regexp_replace(profile_id::text, '-', '', 'g'), 1, 10));

  update public.customer_profiles
  set referral_code = new_referral_code
  where id = profile_id;

  insert into public.loyalty_accounts (customer_id, business_id, points_balance, tier)
  values (profile_id, selected_business_id, initial_balance, 'bronze');

  if signup_bonus > 0 then
    insert into public.point_events (customer_id, business_id, event_type, points_delta, description)
    values (profile_id, selected_business_id, 'signup', signup_bonus, 'Cuenta creada');
  end if;

  if referrer_profile.id is not null and referred_bonus > 0 then
    insert into public.point_events (customer_id, business_id, event_type, points_delta, description)
    values (profile_id, selected_business_id, 'adjustment', referred_bonus, 'Bonus por registrarte con referido');
  end if;

  if referrer_profile.id is not null and referrer_bonus > 0 then
    update public.loyalty_accounts
    set points_balance = points_balance + referrer_bonus
    where customer_id = referrer_profile.id
      and business_id = selected_business_id;

    insert into public.point_events (customer_id, business_id, event_type, points_delta, description)
    values (referrer_profile.id, selected_business_id, 'adjustment', referrer_bonus, 'Bonus por referir a ' || selected_name);
  end if;

  return new;
end;
$$;
