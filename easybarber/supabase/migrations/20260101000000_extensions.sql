-- Extensions required by the Easy Barber schema.
-- gen_random_uuid() for primary keys, gist support for the
-- appointment-overlap exclusion constraint.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
