import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact, ShareLink } from "@/lib/pawset/types";
import { Phone, Mail, Stethoscope, Heart, Key, AlertTriangle } from "lucide-react";

const speciesEmoji: Record<string, string> = {
  dog: "🐶", cat: "🐱", rabbit: "🐰", bird: "🐦", other: "🐾",
};

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", params.token)
    .eq("is_active", true)
    .maybeSingle();

  if (!link) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Guide not available</h1>
          <p className="text-muted-foreground text-sm">
            This care guide is no longer available. The owner may have revoked the link.
          </p>
        </div>
      </div>
    );
  }

  const shareLink = link as ShareLink;

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    notFound();
  }

  const [petR, routineR, behaviourR, medicalR, contactsR] = await Promise.all([
    shareLink.include_basic_details
      ? supabase.from("pets").select("*").eq("id", shareLink.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    shareLink.include_routine
      ? supabase.from("pet_routines").select("*").eq("pet_id", shareLink.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    shareLink.include_behaviour
      ? supabase.from("pet_behaviour").select("*").eq("pet_id", shareLink.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    shareLink.include_medical
      ? supabase.from("pet_medical").select("*").eq("pet_id", shareLink.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    shareLink.include_contacts
      ? supabase
          .from("contacts")
          .select("*")
          .eq("user_id", shareLink.user_id)
          .eq("visible_in_shared_guide", true)
      : Promise.resolve({ data: [] }),
  ]);

  const pet = petR.data as Pet | null;
  const routine = routineR.data as PetRoutine | null;
  const behaviour = behaviourR.data as PetBehaviour | null;
  const medical = medicalR.data as PetMedical | null;
  const contacts = (contactsR.data as Contact[]) ?? [];

  const petName = pet?.name ?? shareLink.title ?? "Pet";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div className="bg-card rounded-3xl p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value ? (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{value}</p>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">
            {pet ? (speciesEmoji[pet.species] ?? "🐾") : "🐾"}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {shareLink.title || `${petName}'s Care Guide`}
          </h1>
          {pet && (
            <p className="text-muted-foreground text-sm mt-1 capitalize">
              {[pet.breed, pet.species, pet.age_text].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* Basic details */}
        {pet && shareLink.include_basic_details && (
          <Section title="About" icon={Heart}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name" value={pet.name} />
              <Field label="Species" value={pet.species} />
              <Field label="Breed" value={pet.breed} />
              <Field label="Sex" value={pet.sex} />
              <Field label="Age" value={pet.age_text} />
              <Field label="Microchip" value={pet.microchip_number} />
              <Field label="Insurance" value={pet.insurance_provider} />
            </div>
            {pet.personality_summary && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm text-foreground">
                {pet.personality_summary}
              </div>
            )}
          </Section>
        )}

        {/* Routine */}
        {routine && shareLink.include_routine && (
          <Section title="Daily Routine" icon={Heart}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Feeding" value={routine.feeding_schedule} />
              <Field label="Food" value={routine.food_type} />
              <Field label="Portion" value={routine.portion_size} />
              <Field label="Treats" value={routine.treat_rules} />
              <Field label="Water" value={routine.water_notes} />
              <Field label="Exercise" value={routine.exercise_routine} />
              <Field label="Toilet" value={routine.toilet_routine} />
              <Field label="Sleep" value={routine.sleep_routine} />
              <Field label="Favourite toys" value={routine.favourite_toys} />
              <Field label="Comfort items" value={routine.comfort_items} />
            </div>
          </Section>
        )}

        {/* Behaviour */}
        {behaviour && shareLink.include_behaviour && (
          <Section title="Behaviour Notes" icon={Heart}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Temperament" value={behaviour.temperament} />
              <Field label="Loves" value={behaviour.likes} />
              <Field label="Avoid" value={behaviour.dislikes} />
              <Field label="Anxiety triggers" value={behaviour.anxiety_triggers} />
              <Field label="With strangers" value={behaviour.stranger_reaction} />
              <Field label="With other animals" value={behaviour.animal_reaction} />
              <Field label="Handling" value={behaviour.handling_notes} />
              <Field label="Escape risk" value={behaviour.escape_risk} />
              <Field label="Noise sensitivity" value={behaviour.noise_sensitivity} />
            </div>
            {behaviour.safety_notes && (
              <div className="bg-paw-yellowsoft rounded-2xl p-3 text-sm text-warning-foreground">
                <strong>Safety note:</strong> {behaviour.safety_notes}
              </div>
            )}
          </Section>
        )}

        {/* Medical */}
        {medical && shareLink.include_medical && (
          <Section title="Vet & Medical" icon={Stethoscope}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Vet" value={medical.vet_name} />
              <Field label="Practice" value={medical.vet_practice} />
              <Field label="Phone" value={medical.vet_phone} />
              <Field label="Address" value={medical.vet_address} />
              <Field label="Conditions" value={medical.known_conditions} />
              <Field label="Medications" value={medical.medications} />
              <Field label="Allergies" value={medical.allergies} />
              <Field label="Vaccinations" value={medical.vaccination_notes} />
            </div>
            {medical.medication_instructions && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                <strong>Medication instructions:</strong> {medical.medication_instructions}
              </div>
            )}
            {medical.special_care_notes && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                <strong>Special care:</strong> {medical.special_care_notes}
              </div>
            )}
            <p className="text-xs text-muted-foreground italic">
              Information provided by the pet owner. Not veterinary advice.
            </p>
          </Section>
        )}

        {/* Contacts */}
        {contacts.length > 0 && shareLink.include_contacts && (
          <Section title="Contacts" icon={AlertTriangle}>
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground text-sm">{c.name}</p>
                    {c.contact_type && (
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{c.contact_type}</span>
                    )}
                    {c.can_contact_in_emergency && (
                      <span className="text-xs bg-paw-yellowsoft text-warning-foreground px-2 py-0.5 rounded-full">Call first</span>
                    )}
                    {c.has_home_access && (
                      <span className="text-xs bg-paw-yellowsoft text-warning-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Key className="h-2.5 w-2.5" />
                        Has key
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-primary">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </a>
                    )}
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          <p>Generated with PawSet · Last updated: {today}</p>
          <p className="mt-1">
            <a href="/" className="hover:text-foreground transition-colors">🐾 pawset.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}
