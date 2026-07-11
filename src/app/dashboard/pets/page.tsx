import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import type { Pet } from "@/lib/pawset/types";
import { Plus, ChevronRight } from "lucide-react";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

const speciesEmoji: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  bird: "🐦",
  other: "🐾",
};

export default async function PetsPage() {
  const supabase = db();
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  const petList = (pets as Pet[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-canvas">Family</h1>
          <p className="text-canvas-muted text-sm mt-1">
            {petList.length > 0
              ? `${petList.length} companion${petList.length !== 1 ? "s" : ""} in your care`
              : "Your whole furry family, in one place"}
          </p>
        </div>
        <Link href="/dashboard/pets/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add companion
          </Button>
        </Link>
      </div>

      {petList.length > 0 ? (
        <div className="space-y-3">
          {petList.map((pet, i) => (
            <Link key={pet.id} href={`/dashboard/pets/${pet.id}`}>
              <div className="bg-card rounded-3xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${["bg-paw-pinksoft", "bg-paw-yellowsoft", "bg-paw-skysoft", "bg-paw-limesoft"][i % 4]} text-2xl flex-shrink-0 overflow-hidden`}>
                  {pet.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pet.photo_url}
                      alt={pet.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span>{speciesEmoji[pet.species] ?? "🐾"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{pet.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {[pet.breed, pet.species, pet.age_text].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">🐾</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Who&apos;s the newest family member?</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Add your first companion and we&apos;ll build their care guide together — routines, vet
            details, and everything a sitter would need.
          </p>
          <Link href="/dashboard/pets/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Add a companion
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
