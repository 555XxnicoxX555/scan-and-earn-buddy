-- Seed limpio para una instancia real de cliente.
-- Completar desde docs/client-onboarding-form.md.
-- No incluir datos demo.

-- Ejemplo:
-- insert into public.businesses (id, name)
-- values ('cliente-demo', 'Cliente Demo')
-- on conflict (id) do update set name = excluded.name;

-- Agregar owner cuando el usuario exista en auth.users:
-- insert into public.business_admins (business_id, auth_user_id, role)
-- select 'cliente-demo', id, 'owner'
-- from auth.users
-- where email = 'owner@cliente.com'
-- on conflict (business_id, auth_user_id) do update set role = excluded.role;
