import { describe, it, expect } from "vitest";
import { calculateCompletion, scoreColor, scoreBgColor } from "./completion";
import type { Pet, PetRoutine, PetBehaviour, PetMedical, Contact } from "./types";

const pet = (over: Partial<Pet> = {}): Pet =>
  ({
    id: "p1",
    user_id: "u1",
    name: "Lenny",
    species: "dog",
    breed: null,
    birth_date: null,
    age_text: null,
    sex: null,
    photo_url: null,
    microchip_number: null,
    insurance_provider: null,
    insurance_policy_number: null,
    personality_summary: null,
    created_at: "",
    updated_at: "",
    ...over,
  }) as Pet;

const emptyRoutine = null as PetRoutine | null;
const emptyBehaviour = null as PetBehaviour | null;
const emptyMedical = null as PetMedical | null;

const contact = (over: Partial<Contact> = {}): Contact =>
  ({
    id: "c1",
    user_id: "u1",
    name: "Sarah",
    contact_type: null,
    relationship: null,
    phone: null,
    email: null,
    notes: null,
    can_contact_in_emergency: true,
    has_home_access: false,
    visible_in_shared_guide: false,
    created_at: "",
    updated_at: "",
    ...over,
  }) as Contact;

describe("calculateCompletion", () => {
  it("scores an empty plan at 0 and lists everything missing", () => {
    const r = calculateCompletion(pet({ name: "", species: "" }), null, null, null, []);
    expect(r.score).toBe(0);
    expect(r.label).toBe("Getting started");
    expect(r.missing).toContain("basic pet details");
    expect(r.missing).toContain("emergency contact");
  });

  it("awards 20 points for basic details (name + species + one identifier)", () => {
    const r = calculateCompletion(pet({ breed: "Labrador" }), null, null, null, []);
    expect(r.breakdown.basicDetails).toBe(true);
    expect(r.score).toBe(20);
  });

  it("adds routine, behaviour, medical, contact and medication weights", () => {
    const r = calculateCompletion(
      pet({ age_text: "4 years" }),
      { feeding_schedule: "Morning & evening" } as PetRoutine,
      { temperament: "Gentle" } as PetBehaviour,
      { vet_name: "Green Lane Vets", medications: "None" } as PetMedical,
      [contact()],
    );
    // 20 basic + 20 routine + 15 behaviour + 20 medical + 15 contact + 10 meds
    expect(r.score).toBe(100);
    expect(r.label).toBe("Plan ready");
    expect(r.missing).toHaveLength(0);
  });

  it("does not count a non-emergency contact", () => {
    const r = calculateCompletion(pet({ breed: "Lab" }), null, null, null, [
      contact({ can_contact_in_emergency: false }),
    ]);
    expect(r.breakdown.emergencyContact).toBe(false);
    expect(r.missing).toContain("emergency contact");
  });

  it("labels thresholds correctly", () => {
    const almost = calculateCompletion(
      pet({ breed: "Lab" }),
      { feeding_schedule: "am/pm" } as PetRoutine,
      { likes: "belly rubs" } as PetBehaviour,
      { vet_phone: "0123" } as PetMedical,
      [],
    ); // 20+20+15+20 = 75
    expect(almost.score).toBe(75);
    expect(almost.label).toBe("Almost ready");
  });
});

describe("score colour helpers", () => {
  it("maps score bands to colours", () => {
    expect(scoreColor(95)).toBe("text-success");
    expect(scoreColor(75)).toBe("text-warning");
    expect(scoreColor(50)).toBe("text-info");
    expect(scoreColor(10)).toBe("text-muted-foreground");
    expect(scoreBgColor(95)).toBe("bg-success");
    expect(scoreBgColor(10)).toBe("bg-muted-foreground");
  });
});
