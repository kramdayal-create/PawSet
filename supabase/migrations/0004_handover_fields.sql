-- Extra handover fields inspired by a printable pet-sitter handover pack:
--   • routine.unsafe_foods   — foods the sitter must never give
--   • behaviour.never_do_rules — hard "never do this" rules
--   • medical health-watch & escalation — what's normal, what's not, and
--     when to call the owner vs the vet urgently.

alter table pet_routines  add column if not exists unsafe_foods text;
alter table pet_behaviour add column if not exists never_do_rules text;
alter table pet_medical   add column if not exists normal_signs text;
alter table pet_medical   add column if not exists unusual_signs text;
alter table pet_medical   add column if not exists call_owner_if text;
alter table pet_medical   add column if not exists call_vet_if text;
