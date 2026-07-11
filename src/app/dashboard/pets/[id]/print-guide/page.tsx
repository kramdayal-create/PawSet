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

  return (
    <html lang="en">
      <head>
        <title>{pet.name}&apos;s Care Guide</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 2rem; color: #2D2D2D; background: #fff; }
          h1 { font-size: 2rem; margin-bottom: 0.25rem; }
          h2 { font-size: 1.1rem; font-weight: bold; border-bottom: 2px solid #2F4F3E; padding-bottom: 0.25rem; margin-top: 2rem; color: #2F4F3E; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
          dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; }
          dt { font-weight: bold; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.1rem; }
          dd { margin: 0; font-size: 0.9rem; }
          .note { background: #F7F1E8; border-left: 3px solid #C97C5D; padding: 0.75rem 1rem; margin-top: 1rem; font-size: 0.9rem; }
          .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.75rem; color: #999; }
          @media print { body { padding: 0; } button { display: none; } }
        `}</style>
      </head>
      <body>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            id="print-btn"
            style={{ padding: "0.5rem 1.25rem", background: "#2F4F3E", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Print this guide
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn').addEventListener('click', function(){ window.print(); });" }} />

        <h1>{speciesEmoji[pet.species] ?? "🐾"} {pet.name}&apos;s Care Guide</h1>
        <p className="meta">
          {[pet.breed, pet.species, pet.age_text, pet.sex].filter(Boolean).join(" · ")}
        </p>

        <h2>Basic details</h2>
        <dl>
          {pet.microchip_number && <><dt>Microchip</dt><dd>{pet.microchip_number}</dd></>}
          {pet.insurance_provider && <><dt>Insurance</dt><dd>{pet.insurance_provider}</dd></>}
          {pet.insurance_policy_number && <><dt>Policy</dt><dd>{pet.insurance_policy_number}</dd></>}
        </dl>
        {pet.personality_summary && (
          <div className="note">{pet.personality_summary}</div>
        )}

        {routine && (
          <>
            <h2>Daily Routine</h2>
            <dl>
              {routine.feeding_schedule && <><dt>Feeding schedule</dt><dd>{routine.feeding_schedule}</dd></>}
              {routine.food_type && <><dt>Food</dt><dd>{routine.food_type}</dd></>}
              {routine.portion_size && <><dt>Portion</dt><dd>{routine.portion_size}</dd></>}
              {routine.water_notes && <><dt>Water</dt><dd>{routine.water_notes}</dd></>}
              {routine.treat_rules && <><dt>Treats</dt><dd>{routine.treat_rules}</dd></>}
              {routine.exercise_routine && <><dt>Exercise</dt><dd>{routine.exercise_routine}</dd></>}
              {routine.toilet_routine && <><dt>Toilet</dt><dd>{routine.toilet_routine}</dd></>}
              {routine.sleep_routine && <><dt>Sleep</dt><dd>{routine.sleep_routine}</dd></>}
              {routine.favourite_toys && <><dt>Favourite toys</dt><dd>{routine.favourite_toys}</dd></>}
              {routine.comfort_items && <><dt>Comfort items</dt><dd>{routine.comfort_items}</dd></>}
            </dl>
          </>
        )}

        {behaviour && (
          <>
            <h2>Behaviour Notes</h2>
            <dl>
              {behaviour.temperament && <><dt>Temperament</dt><dd>{behaviour.temperament}</dd></>}
              {behaviour.likes && <><dt>Loves</dt><dd>{behaviour.likes}</dd></>}
              {behaviour.dislikes && <><dt>Avoid</dt><dd>{behaviour.dislikes}</dd></>}
              {behaviour.anxiety_triggers && <><dt>Anxiety triggers</dt><dd>{behaviour.anxiety_triggers}</dd></>}
              {behaviour.stranger_reaction && <><dt>With strangers</dt><dd>{behaviour.stranger_reaction}</dd></>}
              {behaviour.escape_risk && <><dt>Escape risk</dt><dd>{behaviour.escape_risk}</dd></>}
              {behaviour.safety_notes && <><dt>Safety notes</dt><dd>{behaviour.safety_notes}</dd></>}
            </dl>
          </>
        )}

        {medical && (
          <>
            <h2>Vet & Medical</h2>
            <dl>
              {medical.vet_name && <><dt>Vet</dt><dd>{medical.vet_name}</dd></>}
              {medical.vet_practice && <><dt>Practice</dt><dd>{medical.vet_practice}</dd></>}
              {medical.vet_phone && <><dt>Vet phone</dt><dd>{medical.vet_phone}</dd></>}
              {medical.vet_address && <><dt>Address</dt><dd>{medical.vet_address}</dd></>}
              {medical.known_conditions && <><dt>Conditions</dt><dd>{medical.known_conditions}</dd></>}
              {medical.medications && <><dt>Medications</dt><dd>{medical.medications}</dd></>}
              {medical.allergies && <><dt>Allergies</dt><dd>{medical.allergies}</dd></>}
            </dl>
            {medical.medication_instructions && (
              <div className="note"><strong>Medication instructions:</strong> {medical.medication_instructions}</div>
            )}
            {medical.special_care_notes && (
              <div className="note"><strong>Special care:</strong> {medical.special_care_notes}</div>
            )}
          </>
        )}

        {contacts.length > 0 && (
          <>
            <h2>Contacts</h2>
            {contacts.map((c) => (
              <div key={c.id} style={{ marginBottom: "0.75rem" }}>
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
      </body>
    </html>
  );
}
