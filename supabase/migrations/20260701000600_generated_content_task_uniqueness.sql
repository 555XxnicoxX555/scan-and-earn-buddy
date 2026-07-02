with ranked_assets as (
  select
    id,
    row_number() over (
      partition by business_id, task_id
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.generated_content_assets
  where task_id is not null
    and task_id <> ''
)
delete from public.generated_content_assets
using ranked_assets
where public.generated_content_assets.id = ranked_assets.id
  and ranked_assets.duplicate_rank > 1;

alter table public.generated_content_assets
drop constraint if exists generated_content_assets_business_task_unique;

alter table public.generated_content_assets
add constraint generated_content_assets_business_task_unique
unique (business_id, task_id);
