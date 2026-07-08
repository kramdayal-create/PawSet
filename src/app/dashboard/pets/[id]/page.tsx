import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { calculateCompletion, scoreColor } from "@/lib/pawset/completion";
import { upsertRoutine, upsertBehaviour, upsertMedical } from "../actions";
import { createShareLink, revokeShareLink, deleteShareLink } from "../../share/actions";
import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact, ShareLink } from "@/lib/pawset/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowLeft, Pencil, Share2, Printer, AlertTriangle, Eye } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

const TABS = ["overview", "routine", "behaviour", "medical", "share"] as const;
type Tab = (typeof TABS)[number];

const speciesEmoji: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  bird: "🐦",
  other: "🐾",
};

async function getPetData(petId: string, userId: string) {
  const supabase = db();
  const [petR, routineR, behaviourR, medicalR, contactsR, shareLinksR] = await Promise.all([
    supabase.from("pets").select("*").eq("id", petId).eq("user_id", userId).maybeSingle(),
    supabase.from("pet_routines").select("*").eq("pet_id", petId).maybeSingle(),
    supabase.from("pet_behaviour").select("*").eq("pet_id", petId).maybeSingle(),
    supabase.from("pet_medical").select("*").eq("pet_id", petId).maybeSingle(),
    supabase.from("contacts").select("*").eq("user_id", userId),
    supabase.from("share_links").select("*").eq("pet_id", petId).eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  if (!petR.data) return null;

  return {
    pet: petR.data as Pet,
    routine: routineR.data as PetRoutine | null,
    behaviour: behaviourR.data as PetBehaviour | null,
    medical: medicalR.data as PetMedical | null,
    contacts: (contactsR.data as Contact[]) ?? [],
    shareLinks: (shareLinksR.data as ShareLink[]) ?? [],
  };
}

export default async function PetDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; saved?: string; created?: string; error?: string };
}) {
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const data = await getPetData(params.id, userId);
  if (!data) notFound();

  const { pet, routine, behaviour, medical, contacts, shareLinks } = data;
  const emergencyContacts = contacts.filter((c) => c.can_contact_in_emergency);
  const score = calculateCompletion(pet, routine, behaviour, medical, emergencyContacts);
  const activeTab: Tab = (TABS.includes(searchParams.tab as Tab) ? searchParams.tab : "overview") as Tab;

  const appUrl = env.appUrl;

  const upsertRoutineForPet = upsertRoutine.bind(null, pet.id);
  const upsertBehaviourForPet = upsertBehaviour.bind(null, pet.id);
  const upsertMedicalForPet = upsertMedical.bind(null, pet.id);
  const createShareLinkForPet = createShareLink.bind(null, pet.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/pets">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {pet.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pet.photo_url} alt={pet.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                speciesEmoji[pet.species] ?? "🐾"
              )}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{pet.name}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {[pet.breed, pet.species, pet.age_text].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/pets/${pet.id}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Completion score */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-sm font-semibold", scoreColor(score.score))}>
            {pet.name}&apos;s plan is {score.score}% complete · {score.label}
          </span>
          <span className="text-xs text-muted-foreground">{score.score}%</span>
        </div>
        <Progress value={score.score} className="h-2" />
        {score.missing.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Missing: {score.missing.join(", ")}
          </p>
        )}
      </div>

      {/* Toast messages */}
      {searchParams.saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          Changes saved successfully.
        </div>
      )}
      {searchParams.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {[
            { key: "overview", label: "Overview" },
            { key: "routine", label: "Routine" },
            { key: "behaviour", label: "Behaviour" },
            { key: "medical", label: "Medical & Vet" },
            { key: "share", label: "Share" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={`/dashboard/pets/${pet.id}?tab=${tab.key}`}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
            <h2 className="font-semibold text-foreground">Basic details</h2>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
              {[
                { label: "Name", value: pet.name },
                { label: "Species", value: pet.species },
                { label: "Breed", value: pet.breed },
                { label: "Sex", value: pet.sex },
                { label: "Age", value: pet.age_text },
                { label: "Date of birth", value: pet.birth_date },
                { label: "Microchip", value: pet.microchip_number },
                { label: "Insurance", value: pet.insurance_provider },
                { label: "Policy number", value: pet.insurance_policy_number },
              ].map((item) =>
                item.value ? (
                  <div key={item.label}>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{item.label}</dt>
                    <dd className="text-foreground mt-0.5 capitalize">{item.value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {pet.personality_summary && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Personality</p>
                <p className="text-sm text-foreground">{pet.personality_summary}</p>
              </div>
            )}
          </div>

          {/* Quick links to sections */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { tab: "routine", label: "Daily routine", done: score.breakdown.routine },
              { tab: "behaviour", label: "Behaviour notes", done: score.breakdown.behaviour },
              { tab: "medical", label: "Medical & vet", done: score.breakdown.medical },
              { tab: "share", label: "Share & print", done: false },
            ].map((item) => (
              <Link key={item.tab} href={`/dashboard/pets/${pet.id}?tab=${item.tab}`}>
                <div className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs",
                    item.done ? "bg-success text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {item.done ? "✓" : "·"}
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activeTab === "routine" && (
        <form action={upsertRoutineForPet} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Feeding</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="feeding_schedule">Feeding schedule</Label>
                <Input id="feeding_schedule" name="feeding_schedule" defaultValue={routine?.feeding_schedule ?? ""} placeholder="Morning 7am, Evening 6pm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="food_type">Food brand / type</Label>
                <Input id="food_type" name="food_type" defaultValue={routine?.food_type ?? ""} placeholder="Royal Canin Adult" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portion_size">Portion size</Label>
                <Input id="portion_size" name="portion_size" defaultValue={routine?.portion_size ?? ""} placeholder="2 cups per meal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="water_notes">Water / hydration</Label>
                <Input id="water_notes" name="water_notes" defaultValue={routine?.water_notes ?? ""} placeholder="Fresh water always available" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="treat_rules">Treat rules</Label>
              <Input id="treat_rules" name="treat_rules" defaultValue={routine?.treat_rules ?? ""} placeholder="Max 3 small treats per day" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Exercise & toileting</h2>
            <div className="space-y-1.5">
              <Label htmlFor="exercise_routine">Walk / exercise routine</Label>
              <Textarea id="exercise_routine" name="exercise_routine" defaultValue={routine?.exercise_routine ?? ""} rows={2} placeholder="30 min morning walk, short evening walk. Off-lead in the park." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toilet_routine">Toilet / litter routine</Label>
              <Input id="toilet_routine" name="toilet_routine" defaultValue={routine?.toilet_routine ?? ""} placeholder="Goes outside after meals and before bed" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Sleep & comfort</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sleep_routine">Sleep routine</Label>
                <Input id="sleep_routine" name="sleep_routine" defaultValue={routine?.sleep_routine ?? ""} placeholder="Sleeps in dog bed in bedroom, lights off by 10pm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="favourite_toys">Favourite toys</Label>
                <Input id="favourite_toys" name="favourite_toys" defaultValue={routine?.favourite_toys ?? ""} placeholder="Squeaky duck, tennis ball" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comfort_items">Comfort items</Label>
              <Input id="comfort_items" name="comfort_items" defaultValue={routine?.comfort_items ?? ""} placeholder="Blue blanket kept in their bed" />
            </div>
          </div>

          <Button type="submit" className="w-full">Save routine</Button>
        </form>
      )}

      {activeTab === "behaviour" && (
        <form action={upsertBehaviourForPet} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Personality & temperament</h2>
            <div className="space-y-1.5">
              <Label htmlFor="temperament">Temperament</Label>
              <Textarea id="temperament" name="temperament" defaultValue={behaviour?.temperament ?? ""} rows={2} placeholder="Friendly and playful, loves cuddles but can be nervous in new environments." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="likes">Things they love</Label>
                <Textarea id="likes" name="likes" defaultValue={behaviour?.likes ?? ""} rows={2} placeholder="Swimming, fetch, belly rubs, cheese" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dislikes">Things to avoid</Label>
                <Textarea id="dislikes" name="dislikes" defaultValue={behaviour?.dislikes ?? ""} rows={2} placeholder="Loud music, cats, being left alone over 4 hours" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Anxiety & triggers</h2>
            <div className="space-y-1.5">
              <Label htmlFor="anxiety_triggers">Anxiety triggers</Label>
              <Textarea id="anxiety_triggers" name="anxiety_triggers" defaultValue={behaviour?.anxiety_triggers ?? ""} rows={2} placeholder="Thunderstorms, fireworks, new people entering the home suddenly." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="stranger_reaction">Reaction to strangers</Label>
                <Input id="stranger_reaction" name="stranger_reaction" defaultValue={behaviour?.stranger_reaction ?? ""} placeholder="Friendly after an initial bark" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="animal_reaction">Reaction to other animals</Label>
                <Input id="animal_reaction" name="animal_reaction" defaultValue={behaviour?.animal_reaction ?? ""} placeholder="Good with dogs, nervous around cats" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Handling & safety</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="handling_notes">Handling notes</Label>
                <Input id="handling_notes" name="handling_notes" defaultValue={behaviour?.handling_notes ?? ""} placeholder="Don't pick up — back legs are sensitive" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escape_risk">Escape risk</Label>
                <Input id="escape_risk" name="escape_risk" defaultValue={behaviour?.escape_risk ?? ""} placeholder="Low — doesn't bolt at doors" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noise_sensitivity">Noise sensitivity</Label>
                <Input id="noise_sensitivity" name="noise_sensitivity" defaultValue={behaviour?.noise_sensitivity ?? ""} placeholder="High — very sensitive to fireworks" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="safety_notes">Safety notes</Label>
                <Input id="safety_notes" name="safety_notes" defaultValue={behaviour?.safety_notes ?? ""} placeholder="Will snap if startled while sleeping" />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">Save behaviour notes</Button>
        </form>
      )}

      {activeTab === "medical" && (
        <form action={upsertMedicalForPet} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium mb-0.5">Important</p>
            <p>PawSet stores your notes only — it does not provide veterinary advice or diagnose health conditions.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Vet details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vet_name">Vet name</Label>
                <Input id="vet_name" name="vet_name" defaultValue={medical?.vet_name ?? ""} placeholder="Dr Sarah Jones" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vet_practice">Practice name</Label>
                <Input id="vet_practice" name="vet_practice" defaultValue={medical?.vet_practice ?? ""} placeholder="Green Lane Vets" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vet_phone">Vet phone</Label>
                <Input id="vet_phone" name="vet_phone" type="tel" defaultValue={medical?.vet_phone ?? ""} placeholder="01234 567890" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vet_email">Vet email</Label>
                <Input id="vet_email" name="vet_email" type="email" defaultValue={medical?.vet_email ?? ""} placeholder="info@greenlane.vet" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vet_address">Vet address</Label>
              <Input id="vet_address" name="vet_address" defaultValue={medical?.vet_address ?? ""} placeholder="12 Green Lane, London, SW1 2AB" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground">Health & medication</h2>
            <div className="space-y-1.5">
              <Label htmlFor="known_conditions">Known conditions</Label>
              <Textarea id="known_conditions" name="known_conditions" defaultValue={medical?.known_conditions ?? ""} rows={2} placeholder="Hip dysplasia (mild). Under regular vet review." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medications">Medications</Label>
              <Textarea id="medications" name="medications" defaultValue={medical?.medications ?? ""} rows={2} placeholder="Simparica Trio (monthly flea/tick/heartworm). Meloxicam as needed for joint pain." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medication_instructions">Medication instructions</Label>
              <Textarea id="medication_instructions" name="medication_instructions" defaultValue={medical?.medication_instructions ?? ""} rows={2} placeholder="Give Meloxicam tablet hidden in food — 1 tablet after morning meal only if limping." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="allergies">Allergies</Label>
                <Input id="allergies" name="allergies" defaultValue={medical?.allergies ?? ""} placeholder="Chicken protein, grass pollen" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vaccination_notes">Vaccination notes</Label>
                <Input id="vaccination_notes" name="vaccination_notes" defaultValue={medical?.vaccination_notes ?? ""} placeholder="Up to date — next due March 2026" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="special_care_notes">Special care notes</Label>
              <Textarea id="special_care_notes" name="special_care_notes" defaultValue={medical?.special_care_notes ?? ""} rows={2} placeholder="Avoid running on hard surfaces. Wipe paws after outdoor walks due to pollen sensitivity." />
            </div>
          </div>

          <Button type="submit" className="w-full">Save medical details</Button>
        </form>
      )}

      {activeTab === "share" && (
        <div className="space-y-6">
          {/* Print buttons */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/dashboard/pets/${pet.id}/print-guide`} target="_blank">
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Print sitter guide
              </Button>
            </Link>
            <Link href={`/dashboard/pets/${pet.id}/emergency-card`} target="_blank">
              <Button variant="outline" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Print emergency card
              </Button>
            </Link>
          </div>

          {/* Existing share links */}
          {shareLinks.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-foreground">Active share links</h2>
              {shareLinks.map((link) => (
                <div key={link.id} className={cn(
                  "bg-card border rounded-xl p-4 shadow-card space-y-3",
                  link.is_active ? "border-border" : "border-dashed border-border opacity-60",
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">{link.title || `${pet.name}'s care guide`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {link.is_active ? "Active" : "Revoked"} ·
                        Created {new Date(link.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {link.is_active && (
                        <>
                          <Link href={`/share/${link.token}`} target="_blank">
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <CopyLinkButton url={`${appUrl}/share/${link.token}`} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {link.include_basic_details && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Basic details</span>}
                    {link.include_routine && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Routine</span>}
                    {link.include_behaviour && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Behaviour</span>}
                    {link.include_medical && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Medical</span>}
                    {link.include_contacts && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">Contacts</span>}
                    {link.include_access_notes && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Access notes</span>}
                  </div>
                  {link.is_active && (
                    <div className="flex gap-2 pt-1 border-t border-border">
                      <form action={revokeShareLink.bind(null, link.id, pet.id)}>
                        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                          Revoke link
                        </Button>
                      </form>
                      <form action={deleteShareLink.bind(null, link.id, pet.id)}>
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive text-xs h-7">
                          Delete
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create new share link */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Create a share link</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a read-only link you can share with pet sitters, neighbours, or emergency contacts.
              Sensitive details are hidden by default.
            </p>

            <form action={createShareLinkForPet} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="share_title">Link title (optional)</Label>
                <Input id="share_title" name="title" placeholder={`${pet.name}'s care guide`} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Include in this link:</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { key: "include_basic_details", label: "Basic details", defaultChecked: true },
                    { key: "include_routine", label: "Daily routine", defaultChecked: true },
                    { key: "include_behaviour", label: "Behaviour notes", defaultChecked: true },
                    { key: "include_medical", label: "Medical & vet details", defaultChecked: false },
                    { key: "include_contacts", label: "Emergency contacts", defaultChecked: false },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        name={opt.key}
                        defaultChecked={opt.defaultChecked}
                        className="h-4 w-4 rounded border-input"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-0.5">Home access notes</p>
                <p>Access notes are always hidden from shared links unless you deliberately choose to include them.</p>
              </div>

              <Button type="submit" className="w-full gap-2">
                <Share2 className="h-4 w-4" />
                Create share link
              </Button>
            </form>
          </div>

          {searchParams.created && (
            <div className="bg-success/10 border border-success/20 rounded-xl p-4">
              <p className="text-success font-medium text-sm mb-2">Share link created!</p>
              <p className="text-sm text-foreground font-mono break-all">{appUrl}/share/{searchParams.created}</p>
              <Link href={`/share/${searchParams.created}`} target="_blank" className="mt-2 inline-block">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Preview link
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

