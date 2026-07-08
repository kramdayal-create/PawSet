import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact, CompletionScore } from "./types";

export function calculateCompletion(
  pet: Pet,
  routine: PetRoutine | null,
  behaviour: PetBehaviour | null,
  medical: PetMedical | null,
  emergencyContacts: Contact[],
): CompletionScore {
  const hasField = (v: string | null | undefined) => Boolean(v?.trim());

  const basicDetails =
    hasField(pet.name) &&
    hasField(pet.species) &&
    (hasField(pet.breed) || hasField(pet.age_text) || hasField(pet.birth_date));

  const hasRoutine = Boolean(
    routine &&
      (hasField(routine.feeding_schedule) ||
        hasField(routine.food_type) ||
        hasField(routine.exercise_routine)),
  );

  const hasBehaviour = Boolean(
    behaviour &&
      (hasField(behaviour.temperament) ||
        hasField(behaviour.likes) ||
        hasField(behaviour.anxiety_triggers)),
  );

  const hasMedical = Boolean(
    medical && (hasField(medical.vet_name) || hasField(medical.vet_phone)),
  );

  const hasEmergencyContact = emergencyContacts.some((c) => c.can_contact_in_emergency);

  const hasMedications = Boolean(
    medical && (hasField(medical.medications) || hasField(medical.known_conditions)),
  );

  const missing: string[] = [];
  if (!basicDetails) missing.push("basic pet details");
  if (!hasRoutine) missing.push("daily routine");
  if (!hasBehaviour) missing.push("behaviour notes");
  if (!hasMedical) missing.push("vet phone number");
  if (!hasEmergencyContact) missing.push("emergency contact");
  if (!hasMedications) missing.push("medication notes");

  // Weighted scoring per PRD section 18
  let score = 0;
  if (basicDetails) score += 20;
  if (hasRoutine) score += 20;
  if (hasBehaviour) score += 15;
  if (hasMedical) score += 20;
  if (hasEmergencyContact) score += 15;
  if (hasMedications) score += 10;

  let label: CompletionScore["label"];
  if (score >= 90) label = "Plan ready";
  else if (score >= 70) label = "Almost ready";
  else if (score >= 40) label = "Good progress";
  else label = "Getting started";

  return {
    score,
    label,
    missing,
    breakdown: {
      basicDetails,
      routine: hasRoutine,
      behaviour: hasBehaviour,
      medical: hasMedical,
      emergencyContact: hasEmergencyContact,
      medications: hasMedications,
    },
  };
}

export function scoreColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  if (score >= 40) return "text-info";
  return "text-muted-foreground";
}

export function scoreBgColor(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 70) return "bg-warning";
  if (score >= 40) return "bg-info";
  return "bg-muted-foreground";
}
