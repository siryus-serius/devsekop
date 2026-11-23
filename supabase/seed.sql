-- Data contoh untuk pengembangan lokal.
insert into public.institutions (code, name)
values ('UNIV-DEMO', 'Universitas Demo Indonesia')
on conflict (code) do nothing;

-- Untuk menjadikan pengguna sebagai issuer (jalankan setelah pengguna mendaftar):
-- update public.profiles
--   set role = 'issuer',
--       institution_id = (select id from public.institutions where code = 'UNIV-DEMO')
--   where email = 'issuer@contoh.ac.id';
