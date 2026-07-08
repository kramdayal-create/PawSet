import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";
import { upsertEmergencyPlan } from "./actions";
import type { Contact, EmergencyPlan } from "@/lib/pawset/types";
import { AlertTriangle, Shield } from "lucide-react";
import Link from "next/link";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

export default async function EmergencyPlanPage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string };
}) {
  const supabase = db();
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const [planR, contactsR] = await Promise.all([
    supabase.from("emergency_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("contacts").select("*").eq("user_id", userId).order("name"),
  ]);

  const plan = planR.data as EmergencyPlan | null;
  const contacts = (contactsR.data as Contact[]) ?? [];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-terra" />
          <h1 className="text-2xl font-bold text-foreground">Emergency Plan</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          What should happen if you are unreachable. This stays private unless you share it.
        </p>
      </div>

      {searchParams.saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          Emergency plan saved.
        </div>
      )}

      {contacts.length === 0 && (
        <div className="bg-paw-yellowsoft rounded-3xl p-4 text-sm text-warning-foreground">
          <p className="font-medium mb-1">No contacts added yet</p>
          <p>
            <Link href="/dashboard/contacts" className="underline">Add your emergency contacts</Link>{" "}
            first so you can select them below.
          </p>
        </div>
      )}

      <form action={upsertEmergencyPlan} className="space-y-5">
        {/* Emergency contacts */}
        <div className="bg-card rounded-3xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Emergency contacts</h2>

          {[
            { name: "primary_contact_id", label: "Primary emergency contact", defaultValue: plan?.primary_contact_id },
            { name: "backup_contact_id", label: "Backup emergency contact", defaultValue: plan?.backup_contact_id },
            { name: "preferred_carer_id", label: "Preferred temporary carer", defaultValue: plan?.preferred_carer_id },
            { name: "spare_key_contact_id", label: "Who has spare keys", defaultValue: plan?.spare_key_contact_id },
          ].map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              <select
                id={field.name}
                name={field.name}
                defaultValue={field.defaultValue ?? ""}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="unreachable_after_hours">
              If I am unreachable for this many hours, contact the above
            </Label>
            <Input
              id="unreachable_after_hours"
              name="unreachable_after_hours"
              type="number"
              min={1}
              max={72}
              defaultValue={plan?.unreachable_after_hours ?? ""}
              placeholder="4"
            />
          </div>
        </div>

        {/* Location information */}
        <div className="bg-card rounded-3xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Pet care locations</h2>
          <p className="text-xs text-muted-foreground">Where to find key items in your home.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pet_carrier_location">Pet carrier location</Label>
              <Input
                id="pet_carrier_location"
                name="pet_carrier_location"
                defaultValue={plan?.pet_carrier_location ?? ""}
                placeholder="Under the bed in the spare room"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food_location">Food location</Label>
              <Input
                id="food_location"
                name="food_location"
                defaultValue={plan?.food_location ?? ""}
                placeholder="Kitchen cupboard, bottom shelf"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medication_location">Medication location</Label>
            <Input
              id="medication_location"
              name="medication_location"
              defaultValue={plan?.medication_location ?? ""}
              placeholder="Top kitchen drawer, in a small blue bag"
            />
          </div>
        </div>

        {/* Access notes */}
        <div className="bg-card rounded-3xl p-5 shadow-card space-y-4">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">Home access notes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only add details you are comfortable storing here. These notes are hidden from shared links by default.
              </p>
            </div>
          </div>
          <Textarea
            id="access_notes"
            name="access_notes"
            rows={3}
            defaultValue={plan?.access_notes ?? ""}
            placeholder="Key is under the plant pot at the front door. Door code is 1234. Building intercom: press 42."
          />
        </div>

        {/* Authorisations */}
        <div className="bg-card rounded-3xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Authorisations & instructions</h2>

          <div className="space-y-1.5">
            <Label htmlFor="vet_authorisation_note">Vet authorisation note</Label>
            <Textarea
              id="vet_authorisation_note"
              name="vet_authorisation_note"
              rows={2}
              defaultValue={plan?.vet_authorisation_note ?? ""}
              placeholder="I authorise [emergency contact name] to make medical decisions for my pet and authorise necessary treatment."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emergency_budget_guidance">Emergency budget guidance</Label>
            <Input
              id="emergency_budget_guidance"
              name="emergency_budget_guidance"
              defaultValue={plan?.emergency_budget_guidance ?? ""}
              placeholder="Up to £500 for vet treatment without contacting me first"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="general_instructions">General emergency instructions</Label>
            <Textarea
              id="general_instructions"
              name="general_instructions"
              rows={3}
              defaultValue={plan?.general_instructions ?? ""}
              placeholder="If you cannot reach me after 4 hours and my pet needs care, please contact Sarah first. If Sarah is unavailable, contact my sister Priya. The vet has my details on file."
            />
          </div>
        </div>

        <Button type="submit" className="w-full">Save emergency plan</Button>
      </form>
    </div>
  );
}
