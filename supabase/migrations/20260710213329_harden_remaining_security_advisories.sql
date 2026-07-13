begin;

alter function public.current_ai_credit_period()
  set search_path = pg_catalog;

alter function public.touch_loyalty_account()
  set search_path = pg_catalog;

alter function public.touch_business_rewards_updated_at()
  set search_path = pg_catalog;

-- Public object URLs do not require a SELECT policy on storage.objects.
drop policy if exists "Anyone can read public generated content images"
  on storage.objects;

commit;
