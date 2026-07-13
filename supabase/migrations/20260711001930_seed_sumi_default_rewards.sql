insert into public.business_rewards (
  business_id,
  reward_key,
  name,
  points_cost,
  active
)
values
  ('sumi', 'coffee', 'Cafe gratis', 120, true),
  ('sumi', 'dessert', 'Postre sorpresa', 240, true),
  ('sumi', 'shawarma', 'Shawarma 2x1', 520, true)
on conflict (business_id, reward_key) do nothing;

notify pgrst, 'reload schema';
