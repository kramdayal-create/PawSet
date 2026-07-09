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
  ClipboardList,
  Plus,
  Check,
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

  const [petsResult, contactsResult, planResult, profileResult, shareLinksResult] = await Promise.all([
    supabase.from("pets").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("contacts").select("*").eq("user_id", userId),
    supabase.from("emergency_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("share_links").select("id").eq("user_id", userId).limit(1),
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
    hasShareLink: (shareLinksResult.data?.length ?? 0) > 0,
  };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Hello, night owl";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

  const { petScores, contacts, emergencyContacts, plan, firstName, hasShareLink } = data;
  const hasPets = petScores.length > 0;
  const hasEmergencyPlan = Boolean(plan?.general_instructions || plan?.primary_contact_id);

  const setupSteps = [
    {
      href: "/dashboard/pets/new",
      emoji: "🐶",
      title: "Add your first pet",
      hint: "Name, species, and the basics",
      done: hasPets,
      fill: "bg-paw-pinksoft",
    },
    {
      href: "/dashboard/contacts",
      emoji: "💛",
      title: "Add a trusted contact",
      hint: "Someone your pet can count on",
      done: emergencyContacts.length > 0,
      fill: "bg-paw-yellowsoft",
    },
    {
      href: "/dashboard/emergency-plan",
      emoji: "📋",
      title: "Set up your care plan",
      hint: "The essentials, written down once",
      done: hasEmergencyPlan,
      fill: "bg-paw-skysoft",
    },
    {
      href: hasPets ? `/dashboard/pets/${petScores[0].pet.id}?tab=share` : "/dashboard/pets/new",
      emoji: "💌",
      title: "Share a sitter guide",
      hint: "A care link for sitters & family",
      done: hasShareLink,
      fill: "bg-paw-limesoft",
    },
  ];
  const doneCount = setupSteps.filter((s) => s.done).length;
  const allDone = doneCount === setupSteps.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="eyebrow text-xs text-canvas/80 mb-2">Dashboard</p>
        <h1 className="text-3xl sm:text-4xl text-canvas">
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </h1>
        <p className="text-canvas-muted mt-2 text-sm">
          {allDone
            ? "Everything's in place — your pets are covered. 🎉"
            : hasPets
              ? "Here's how your pet care plans are looking."
              : "Let's get your pet's world organised — it only takes a few minutes."}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-3xl p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paw-yellowsoft text-foreground">
              <PawPrint className="h-3.5 w-3.5" />
            </span>
            Pets
          </div>
          <p className="text-2xl font-bold text-foreground">{petScores.length}</p>
        </div>
        <div className="bg-card rounded-3xl p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paw-skysoft text-foreground">
              <Phone className="h-3.5 w-3.5" />
            </span>
            Trusted contacts
          </div>
          <p className="text-2xl font-bold text-foreground">{emergencyContacts.length}</p>
        </div>
        <div className="bg-card rounded-3xl p-4 shadow-card col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paw-limesoft text-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
            </span>
            Care plan
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {hasEmergencyPlan ? (
              <span className="text-success">Ready</span>
            ) : (
              <span className="text-muted-foreground">In progress</span>
            )}
          </p>
        </div>
      </div>

      {/* Pet cards */}
      {hasPets ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-canvas">Your pets</h2>
            <Link href="/dashboard/pets/new">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add pet
              </Button>
            </Link>
          </div>

          {petScores.map(({ pet, score }) => (
            <Link key={pet.id} href={`/dashboard/pets/${pet.id}`} className="block">
              <div className="bg-card rounded-3xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paw-yellowsoft text-2xl flex-shrink-0 overflow-hidden">
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
                          Still to add: {score.missing.slice(0, 2).join(", ")}
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

      {/* Setup checklist — stacked pastel cards with check circles */}
      {allDone ? (
        <div className="bg-paw-limesoft rounded-3xl p-5 shadow-card flex items-center gap-4">
          <span className="text-3xl">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">You&apos;re all set!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pets, people, and plans — anyone helping out will know exactly
              what to do.
            </p>
          </div>
          <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-canvas">Get set up</h2>
            <span className="text-xs font-semibold text-card-foreground bg-card rounded-full px-3 py-1 shadow-card">
              {doneCount} of {setupSteps.length} done
            </span>
          </div>
          <Progress value={(doneCount / setupSteps.length) * 100} className="h-2" />
          <div className="space-y-2.5 pt-1">
            {setupSteps.map((step) => (
              <Link key={step.title} href={step.href} className="block">
                <div
                  className={`${step.fill} rounded-3xl px-4 py-3.5 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-3 ${step.done ? "opacity-70" : ""}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-lg flex-shrink-0">
                    {step.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold text-foreground ${step.done ? "line-through decoration-2" : ""}`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.hint}</p>
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                      step.done ? "bg-paw-yellow text-foreground" : "bg-card text-transparent"
                    }`}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
