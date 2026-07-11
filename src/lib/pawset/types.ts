export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  age_text: string | null;
  sex: string | null;
  photo_url: string | null;
  microchip_number: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  personality_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetRoutine {
  id: string;
  pet_id: string;
  feeding_schedule: string | null;
  food_type: string | null;
  portion_size: string | null;
  treat_rules: string | null;
  unsafe_foods: string | null;
  water_notes: string | null;
  exercise_routine: string | null;
  toilet_routine: string | null;
  sleep_routine: string | null;
  favourite_toys: string | null;
  comfort_items: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetBehaviour {
  id: string;
  pet_id: string;
  temperament: string | null;
  anxiety_triggers: string | null;
  likes: string | null;
  dislikes: string | null;
  stranger_reaction: string | null;
  animal_reaction: string | null;
  handling_notes: string | null;
  escape_risk: string | null;
  noise_sensitivity: string | null;
  safety_notes: string | null;
  never_do_rules: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetMedical {
  id: string;
  pet_id: string;
  vet_name: string | null;
  vet_practice: string | null;
  vet_phone: string | null;
  vet_email: string | null;
  vet_address: string | null;
  known_conditions: string | null;
  medications: string | null;
  medication_instructions: string | null;
  allergies: string | null;
  vaccination_notes: string | null;
  special_care_notes: string | null;
  normal_signs: string | null;
  unusual_signs: string | null;
  call_owner_if: string | null;
  call_vet_if: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  contact_type: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  can_contact_in_emergency: boolean;
  has_home_access: boolean;
  visible_in_shared_guide: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyPlan {
  id: string;
  user_id: string;
  primary_contact_id: string | null;
  backup_contact_id: string | null;
  preferred_carer_id: string | null;
  spare_key_contact_id: string | null;
  access_notes: string | null;
  pet_carrier_location: string | null;
  food_location: string | null;
  medication_location: string | null;
  vet_authorisation_note: string | null;
  emergency_budget_guidance: string | null;
  unreachable_after_hours: number | null;
  general_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  user_id: string;
  pet_id: string;
  token: string;
  title: string | null;
  include_basic_details: boolean;
  include_routine: boolean;
  include_behaviour: boolean;
  include_medical: boolean;
  include_contacts: boolean;
  include_access_notes: boolean;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompletionScore {
  score: number;
  label: "Getting started" | "Good progress" | "Almost ready" | "Plan ready";
  missing: string[];
  breakdown: {
    basicDetails: boolean;
    routine: boolean;
    behaviour: boolean;
    medical: boolean;
    emergencyContact: boolean;
    medications: boolean;
  };
}
