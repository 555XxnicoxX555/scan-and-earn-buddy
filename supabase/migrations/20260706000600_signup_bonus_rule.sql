alter table public.business_loyalty_settings
alter column signup_bonus_points set default 40;

update public.business_loyalty_settings
set signup_bonus_points = 40
where signup_bonus_points = 0;

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
begin
  selected_business_id := coalesce(new.raw_user_meta_data->>'business_id', 'sumi');
  selected_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Cliente');

  insert into public.businesses (id, name)
  values (selected_business_id, selected_business_id)
  on conflict (id) do nothing;

  insert into public.business_loyalty_settings (business_id)
  values (selected_business_id)
  on conflict (business_id) do nothing;

  select coalesce(bls.signup_bonus_points, 40)
  into signup_bonus
  from public.business_loyalty_settings bls
  where bls.business_id = selected_business_id;

  signup_bonus := greatest(coalesce(signup_bonus, 40), 0);

  insert into public.customer_profiles (auth_user_id, business_id, name, email)
  values (new.id, selected_business_id, selected_name, new.email)
  returning id into profile_id;

  insert into public.loyalty_accounts (customer_id, business_id, points_balance, tier)
  values (profile_id, selected_business_id, signup_bonus, 'bronze');

  insert into public.point_events (customer_id, business_id, event_type, points_delta, description)
  values (profile_id, selected_business_id, 'signup', signup_bonus, 'Cuenta creada');

  return new;
end;
$$;
