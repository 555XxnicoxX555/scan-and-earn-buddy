revoke all on function public.request_reward_redemption(text, text, jsonb) from public;
revoke all on function public.request_reward_redemption(text, text, jsonb) from anon;
grant execute on function public.request_reward_redemption(text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
