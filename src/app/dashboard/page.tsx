import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { calculateCompletion, scoreColor, scoreBgColor } from "@/lib/pawset/completion";
import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact } from "@/lib/pawset/types";
import {
  PawPrint,
  Users,
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Phone,
} from "lucide-react";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

async function getDashboardData() {
  const supabase = db();

  let userId: string;
  if (env.bypassAuth) {
    userId = "00000000-0000-0000-0000-000000000000";
  } else {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  const [petsResult, contactsResult, planResult, profileResult] = await Promise.all([
    supabase.from("pets").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("contacts").select("*").eq("user_id", userId),
    supabase.from("emergency_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  const pets = (petsResult.data as Pet[]) ?? [];
  const contacts = (contactsResult.data as Contact[]) ?? [];
  const emergencyContacts = contacts.filter((c) => c.can_contact_in_emergency);

  // Load detailed data for each pet to compute completion scores
  const petScores = await Promise.all(
    pets.map(async (pet) => {
      const [routineR, behaviourR, medicalR] = await Promise.all([
        supabase.from("pet_routines").select("*").eq("pet_id", pet.id).maybeSingle(),
        supabase.from("pet_behaviour").select("*").eq("pet_id", pet.id).maybeSingle(),
        supabase.from("pet_medical").select("*").eq("pet_id", pet.id).maybeSingle(),
      ]);
      const score = calculateCompletion(
        pet,
        routineR.data as PetRoutine | null,
        behaviourR.data as PetBehaviour | null,
        medicalR.data as PetMedical | null,
        emergencyContacts,
      );
      return { pet, score };
    }),
  );

  return {
    petScores,
    contacts,
    emergencyContacts,
    plan: planResult.data,
    firstName: profileResult.data?.full_name?.split(" ")[0] ?? null,
  };
}

const speciesEmoji: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  bird: "🐦",
  other: "🐾",
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Unable to load dashboard.</p>
        <Link href="/login"><Button className="mt-4">Sign in</Button></Link>
      </div>
    );
  }

  const { petScores, contacts, emergencyContacts, plan, firstName } = data;
  const hasPets = petScores.length > 0;
  const hasEmergencyPlan = Boolean(plan?.general_instructions || plan?.primary_contact_id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {firstName ? `Welcome back, ${firstName}` : "Your pet plans"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {hasPets
            ? "Here's the status of your pet care plans."
            : "Create your first pet plan to get started."}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <PawPrint className="h-3.5 w-3.5" />
            Pets
          </div>
          <p className="text-2xl font-bold text-foreground">{petScores.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Phone className="h-3.5 w-3.5" />
            Emergency contacts
          </div>
          <p className="text-2xl font-bold text-foreground">{emergencyContacts.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Emergency plan
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {hasEmergencyPlan ? (
              <span className="text-success">Set up</span>
            ) : (
              <span className="text-muted-foreground">Not set up</span>
            )}
          </p>
        </div>
      </div>

      {/* Pet cards */}
      {hasPets ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Your pets</h2>
            <Link href="/dashboard/pets/new">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add pet
              </Button>
            </Link>
          </div>

          {petScores.map(({ pet, score }) => (
            <Link key={pet.id} href={`/dashboard/pets/${pet.id}`} className="block">
              <div className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">
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
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{pet.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {pet.breed ? `${pet.breed} · ` : ""}{pet.species}
                          {pet.age_text ? ` · ${pet.age_text}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn("text-xs font-medium", scoreColor(score.score))}>
                          {score.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{score.score}%</span>
                      </div>
                      <Progress value={score.score} className="h-1.5" />
                      {score.missing.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Missing: {score.missing.slice(0, 2).join(", ")}
                          {score.missing.length > 2 ? ` + ${score.missing.length - 2} more` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">🐾</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Create your first pet plan</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Add your pet&apos;s details, routine, vet information, and emergency contacts so
            everything is ready if someone else needs to step in.
          </p>
          <Link href="/dashboard/pets/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Add my pet
            </Button>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        {!emergencyContacts.length && (
          <Link href="/dashboard/contacts">
            <div className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Add emergency contact</p>
                <p className="text-xs text-muted-foreground">Someone your pet can count on</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        )}
        {!hasEmergencyPlan && (
          <Link href="/dashboard/emergency-plan">
            <div className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Set up emergency plan</p>
                <p className="text-xs text-muted-foreground">Who to call and what to do</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        )}
        {hasPets && (
          <Link href={`/dashboard/pets/${petScores[0].pet.id}?tab=share`}>
            <div className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Create sitter guide</p>
                <p className="text-xs text-muted-foreground">A shareable care link for sitters</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
