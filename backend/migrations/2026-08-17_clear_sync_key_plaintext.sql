-- Stop persisting plaintext EA sync keys. Hash remains for auth.
update public.sync_keys
set raw_key = null
where raw_key is not null;
