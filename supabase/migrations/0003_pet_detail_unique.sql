-- One-row-per-pet detail tables were missing a unique constraint on pet_id.
-- Without it, `upsert(..., { onConflict: "pet_id" })` errored at the database
-- and the write was silently lost. The app now saves these via an explicit
-- select-then-update/insert, but the constraint keeps the data honest and lets
-- upsert-on-pet_id work again.
--
-- Remove any accidental duplicate rows first (keep the most recently updated),
-- then add the constraints.

delete from pet_routines a
using pet_routines b
where a.pet_id = b.pet_id
  and a.updated_at < b.updated_at;

delete from pet_behaviour a
using pet_behaviour b
where a.pet_id = b.pet_id
  and a.updated_at < b.updated_at;

delete from pet_medical a
using pet_medical b
where a.pet_id = b.pet_id
  and a.updated_at < b.updated_at;

alter table pet_routines  add constraint pet_routines_pet_id_key  unique (pet_id);
alter table pet_behaviour add constraint pet_behaviour_pet_id_key unique (pet_id);
alter table pet_medical   add constraint pet_medical_pet_id_key   unique (pet_id);
