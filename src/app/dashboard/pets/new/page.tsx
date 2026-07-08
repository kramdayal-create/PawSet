import Link from "next/link";
import { createPet } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function NewPetPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/pets">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add a pet</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Basic details to get started</p>
        </div>
      </div>

      {searchParams.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <form action={createPet} className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Basic details</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Pet name *</Label>
              <Input id="name" name="name" required placeholder="Lenny" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="species">Species *</Label>
              <select
                id="species"
                name="species"
                defaultValue="dog"
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
              <Input id="breed" name="breed" placeholder="Golden Retriever" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sex">Sex</Label>
              <select
                id="sex"
                name="sex"
                defaultValue=""
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
              <Input id="age_text" name="age_text" placeholder="4 years old" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birth_date">Date of birth</Label>
              <Input id="birth_date" name="birth_date" type="date" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-foreground">Additional details</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="microchip_number">Microchip number</Label>
              <Input id="microchip_number" name="microchip_number" placeholder="123456789012345" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insurance_provider">Insurance provider</Label>
              <Input id="insurance_provider" name="insurance_provider" placeholder="Petplan" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="insurance_policy_number">Insurance policy number</Label>
            <Input id="insurance_policy_number" name="insurance_policy_number" placeholder="POL-12345678" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personality_summary">Personality summary</Label>
            <Textarea
              id="personality_summary"
              name="personality_summary"
              rows={3}
              placeholder="Friendly and energetic, loves meeting new people. Gets anxious during thunderstorms..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard/pets" className="flex-1">
            <Button variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" className="flex-1">
            Save pet
          </Button>
        </div>
      </form>
    </div>
  );
}
