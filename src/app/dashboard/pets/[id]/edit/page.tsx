import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePet, deletePet } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";
import type { Pet } from "@/lib/pawset/types";
import { ArrowLeft } from "lucide-react";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

export default async function EditPetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const { data } = await db()
    .from("pets")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) notFound();
  const pet = data as Pet;

  const updatePetAction = updatePet.bind(null, pet.id);
  const deletePetAction = deletePet.bind(null, pet.id);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/pets/${pet.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit {pet.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Update basic details</p>
        </div>
      </div>

      {searchParams.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <form action={updatePetAction} className="space-y-5">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Basic details</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Pet name *</Label>
              <Input id="name" name="name" required defaultValue={pet.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="species">Species *</Label>
              <select
                id="species"
                name="species"
                defaultValue={pet.species}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="rabbit">Rabbit</option>
                <option value="bird">Bird</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="breed">Breed / type</Label>
              <Input id="breed" name="breed" defaultValue={pet.breed ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sex">Sex</Label>
              <select
                id="sex"
                name="sex"
                defaultValue={pet.sex ?? ""}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutered_male">Neutered male</option>
                <option value="spayed_female">Spayed female</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age_text">Age</Label>
              <Input id="age_text" name="age_text" defaultValue={pet.age_text ?? ""} placeholder="4 years old" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birth_date">Date of birth</Label>
              <Input id="birth_date" name="birth_date" type="date" defaultValue={pet.birth_date ?? ""} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Additional details</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="microchip_number">Microchip number</Label>
              <Input id="microchip_number" name="microchip_number" defaultValue={pet.microchip_number ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insurance_provider">Insurance provider</Label>
              <Input id="insurance_provider" name="insurance_provider" defaultValue={pet.insurance_provider ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="insurance_policy_number">Policy number</Label>
            <Input id="insurance_policy_number" name="insurance_policy_number" defaultValue={pet.insurance_policy_number ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personality_summary">Personality summary</Label>
            <Textarea
              id="personality_summary"
              name="personality_summary"
              rows={3}
              defaultValue={pet.personality_summary ?? ""}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/dashboard/pets/${pet.id}`} className="flex-1">
            <Button variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" className="flex-1">Save changes</Button>
        </div>
      </form>

      <div className="border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-destructive mb-3">Danger zone</h2>
        <form action={deletePetAction}>
          <Button type="submit" variant="destructive" size="sm">
            Delete {pet.name}&apos;s profile
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          This will permanently delete {pet.name}&apos;s profile and all associated data.
        </p>
      </div>
    </div>
  );
}
