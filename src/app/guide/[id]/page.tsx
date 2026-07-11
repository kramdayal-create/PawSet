import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact } from "@/lib/pawset/types";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

const speciesEmoji: Record<string, string> = {
  dog: "🐶", cat: "🐱", rabbit: "🐰", bird: "🐦", other: "🐾",
};

export const dynamic = "force-dynamic";

export default async function PrintGuidePage({ params }: { params: { id: string } }) {
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const supabase = db();
  const [petR, routineR, behaviourR, medicalR, contactsR] = await Promise.all([
    supabase.from("pets").select("*").eq("id", params.id).eq("user_id", userId).maybeSingle(),
    supabase.from("pet_routines").select("*").eq("pet_id", params.id).maybeSingle(),
    supabase.from("pet_behaviour").select("*").eq("pet_id", params.id).maybeSingle(),
    supabase.from("pet_medical").select("*").eq("pet_id", params.id).maybeSingle(),
    supabase.from("contacts").select("*").eq("user_id", userId).eq("visible_in_shared_guide", true),
  ]);

  if (!petR.data) notFound();

  const pet = petR.data as Pet;
  const routine = routineR.data as PetRoutine | null;
  const behaviour = behaviourR.data as PetBehaviour | null;
  const medical = medicalR.data as PetMedical | null;
  const contacts = (contactsR.data as Contact[]) ?? [];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // Basic details always has the identity fields, so the section is never empty.
  const basics: [string, string | null | undefined][] = [
    ["Name", pet.name],
    ["Species", pet.species],
    ["Breed", pet.breed],
    ["Age", pet.age_text],
    ["Sex", pet.sex],
    ["Microchip", pet.microchip_number],
    ["Insurance", pet.insurance_provider],
    ["Policy", pet.insurance_policy_number],
  ];

  return (
    <div className="print-doc">
      <style>{`
        .print-doc { font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 2rem; color: #2D2D2D; background: #fff; min-height: 100vh; }
        .print-doc h1 { font-size: 2rem; margin: 0 0 0.25rem; }
        .print-doc h2 { font-size: 1.1rem; font-weight: bold; border-bottom: 2px solid #2F4F3E; padding-bottom: 0.25rem; margin-top: 2rem; color: #2F4F3E; }
        .print-doc .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; text-transform: capitalize; }
        .print-doc dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; }
        .print-doc dt { font-weight: bold; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.1rem; }
        .print-doc dd { margin: 0; font-size: 0.95rem; }
        .print-doc .note { background: #F7F1E8; border-left: 3px solid #C97C5D; padding: 0.75rem 1rem; margin-top: 1rem; font-size: 0.9rem; }
        .print-doc .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.75rem; color: #999; }
        .print-doc .print-btn { padding: 0.5rem 1.25rem; background: #2F4F3E; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-family: system-ui, sans-serif; }
        @media print { .print-doc { padding: 0; max-width: none; } .print-btn { display: none; } }
      `}</style>

      <div style={{ marginBottom: "1.5rem" }}>
        <button id="print-btn" className="print-btn">Print this guide</button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn').addEventListener('click', function(){ window.print(); });" }} />

      <h1>{speciesEmoji[pet.species] ?? "🐾"} {pet.name}&apos;s Care Guide</h1>
      <p className="meta">
        {[pet.breed, pet.species, pet.age_text, pet.sex].filter(Boolean).join(" · ")}
      </p>

      <h2>Basic details</h2>
      <dl>
        {basics
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd style={{ textTransform: label === "Name" ? "none" : "capitalize" }}>{v}</dd>
            </div>
          ))}
      </dl>
      {pet.personality_summary && <div className="note">{pet.personality_summary}</div>}

      {routine && (
        <>
          <h2>Daily Routine</h2>
          <dl>
            {routine.feeding_schedule && <div><dt>Feeding schedule</dt><dd>{routine.feeding_schedule}</dd></div>}
            {routine.food_type && <div><dt>Food</dt><dd>{routine.food_type}</dd></div>}
            {routine.portion_size && <div><dt>Portion</dt><dd>{routine.portion_size}</dd></div>}
            {routine.water_notes && <div><dt>Water</dt><dd>{routine.water_notes}</dd></div>}
            {routine.treat_rules && <div><dt>Treats</dt><dd>{routine.treat_rules}</dd></div>}
            {routine.exercise_routine && <div><dt>Exercise</dt><dd>{routine.exercise_routine}</dd></div>}
            {routine.toilet_routine && <div><dt>Toilet</dt><dd>{routine.toilet_routine}</dd></div>}
            {routine.sleep_routine && <div><dt>Sleep</dt><dd>{routine.sleep_routine}</dd></div>}
            {routine.favourite_toys && <div><dt>Favourite toys</dt><dd>{routine.favourite_toys}</dd></div>}
            {routine.comfort_items && <div><dt>Comfort items</dt><dd>{routine.comfort_items}</dd></div>}
          </dl>
          {routine.unsafe_foods && <div className="note"><strong>Do not feed:</strong> {routine.unsafe_foods}</div>}
        </>
      )}

      {behaviour && (
        <>
          <h2>Behaviour Notes</h2>
          <dl>
            {behaviour.temperament && <div><dt>Temperament</dt><dd>{behaviour.temperament}</dd></div>}
            {behaviour.likes && <div><dt>Loves</dt><dd>{behaviour.likes}</dd></div>}
            {behaviour.dislikes && <div><dt>Avoid</dt><dd>{behaviour.dislikes}</dd></div>}
            {behaviour.anxiety_triggers && <div><dt>Anxiety triggers</dt><dd>{behaviour.anxiety_triggers}</dd></div>}
            {behaviour.stranger_reaction && <div><dt>With strangers</dt><dd>{behaviour.stranger_reaction}</dd></div>}
            {behaviour.escape_risk && <div><dt>Escape risk</dt><dd>{behaviour.escape_risk}</dd></div>}
            {behaviour.safety_notes && <div><dt>Safety notes</dt><dd>{behaviour.safety_notes}</dd></div>}
          </dl>
          {behaviour.never_do_rules && <div className="note"><strong>Never:</strong> {behaviour.never_do_rules}</div>}
        </>
      )}

      {medical && (
        <>
          <h2>Vet &amp; Medical</h2>
          <dl>
            {medical.vet_name && <div><dt>Vet</dt><dd>{medical.vet_name}</dd></div>}
            {medical.vet_practice && <div><dt>Practice</dt><dd>{medical.vet_practice}</dd></div>}
            {medical.vet_phone && <div><dt>Vet phone</dt><dd>{medical.vet_phone}</dd></div>}
            {medical.vet_address && <div><dt>Address</dt><dd>{medical.vet_address}</dd></div>}
            {medical.known_conditions && <div><dt>Conditions</dt><dd>{medical.known_conditions}</dd></div>}
            {medical.medications && <div><dt>Medications</dt><dd>{medical.medications}</dd></div>}
            {medical.allergies && <div><dt>Allergies</dt><dd>{medical.allergies}</dd></div>}
          </dl>
          {medical.medication_instructions && (
            <div className="note"><strong>Medication instructions:</strong> {medical.medication_instructions}</div>
          )}
          {medical.special_care_notes && (
            <div className="note"><strong>Special care:</strong> {medical.special_care_notes}</div>
          )}
        </>
      )}

      {medical && (medical.normal_signs || medical.unusual_signs || medical.call_owner_if || medical.call_vet_if) && (
        <>
          <h2>When to get help</h2>
          <dl>
            {medical.normal_signs && <div><dt>This is normal</dt><dd>{medical.normal_signs}</dd></div>}
            {medical.unusual_signs && <div><dt>This is unusual</dt><dd>{medical.unusual_signs}</dd></div>}
          </dl>
          {medical.call_owner_if && <div className="note"><strong>Call the owner if:</strong> {medical.call_owner_if}</div>}
          {medical.call_vet_if && (
            <div className="note" style={{ borderLeftColor: "#B23B3B", background: "#FBEAEA" }}>
              <strong>Call the vet urgently if:</strong> {medical.call_vet_if}
              {medical.vet_phone && <> — {medical.vet_phone}</>}
            </div>
          )}
        </>
      )}

      {contacts.length > 0 && (
        <>
          <h2>Contacts</h2>
          {contacts.map((c) => (
            <div key={c.id} style={{ marginBottom: "0.75rem", fontSize: "0.95rem" }}>
              <strong>{c.name}</strong>
              {c.contact_type && ` (${c.contact_type})`}
              {c.phone && ` · ${c.phone}`}
              {c.email && ` · ${c.email}`}
              {c.has_home_access && " · Has spare key"}
              {c.can_contact_in_emergency && " · Emergency contact"}
            </div>
          ))}
        </>
      )}

      <div className="footer">
        Generated with PawSet · Last updated: {today}
        <br />
        Information provided by the pet owner. Not veterinary advice.
      </div>
    </div>
  );
}
