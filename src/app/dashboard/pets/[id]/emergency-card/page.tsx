import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Pet, PetMedical, Contact } from "@/lib/pawset/types";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

export default async function EmergencyCardPage({ params }: { params: { id: string } }) {
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const supabase = db();
  const [petR, medicalR, contactsR, profileR] = await Promise.all([
    supabase.from("pets").select("*").eq("id", params.id).eq("user_id", userId).maybeSingle(),
    supabase.from("pet_medical").select("vet_name, vet_phone, vet_practice").eq("pet_id", params.id).maybeSingle(),
    supabase.from("contacts").select("*").eq("user_id", userId).eq("can_contact_in_emergency", true).order("created_at").limit(2),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  if (!petR.data) notFound();

  const pet = petR.data as Pet;
  const medical = medicalR.data as Pick<PetMedical, "vet_name" | "vet_phone" | "vet_practice"> | null;
  const contacts = (contactsR.data as Contact[]) ?? [];
  const ownerName = profileR.data?.full_name ?? "the pet owner";

  return (
    <html lang="en">
      <head>
        <title>Emergency Card — {pet.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { font-family: Arial, sans-serif; background: #F7F1E8; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
          .card { background: #fff; border: 2px solid #2F4F3E; border-radius: 12px; padding: 1.5rem; max-width: 380px; width: 100%; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
          .header { background: #2F4F3E; color: #fff; margin: -1.5rem -1.5rem 1.25rem; padding: 1rem 1.5rem; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0; font-size: 1.1rem; }
          .header p { margin: 0.25rem 0 0; font-size: 0.8rem; opacity: 0.8; }
          .alert { background: #C97C5D; color: #fff; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem; font-weight: bold; margin-bottom: 1.25rem; text-align: center; }
          .section { margin-bottom: 1rem; }
          .section h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 0 0 0.4rem; }
          .section p { margin: 0; font-size: 0.9rem; font-weight: bold; color: #2D2D2D; }
          .section .sub { font-weight: normal; font-size: 0.8rem; color: #555; }
          .footer { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #e0d9d0; font-size: 0.7rem; color: #999; text-align: center; }
          .buttons { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
          button { padding: 0.5rem 1.25rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
          .btn-print { background: #2F4F3E; color: #fff; }
          .btn-back { background: #e0d9d0; color: #333; }
          @media print { .buttons { display: none; } body { background: #fff; } .card { box-shadow: none; border: 2px solid #2F4F3E; } }
        `}</style>
      </head>
      <body>
        <div className="buttons">
          <button id="btn-print" className="btn-print">Print card</button>
          <button id="btn-back" className="btn-back">Back</button>
        </div>
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('btn-print').addEventListener('click',function(){window.print()});document.getElementById('btn-back').addEventListener('click',function(){window.history.back()});" }} />

        <div className="card">
          <div className="header">
            <h1>🐾 {pet.name}&apos;s Emergency Card</h1>
            <p>{[pet.breed, pet.species].filter(Boolean).join(" · ")}</p>
          </div>

          <div className="alert">
            My pets are home and may need care.
            <br />
            Please contact someone below.
          </div>

          <div className="section">
            <h2>Pet owner</h2>
            <p>{ownerName}</p>
          </div>

          {contacts.length > 0 && (
            <div className="section">
              <h2>Emergency contacts</h2>
              {contacts.map((c) => (
                <div key={c.id} style={{ marginBottom: "0.5rem" }}>
                  <p>{c.name}{c.relationship ? ` (${c.relationship})` : ""}</p>
                  {c.phone && <p className="sub">{c.phone}</p>}
                  {c.has_home_access && <p className="sub">Has spare key</p>}
                </div>
              ))}
            </div>
          )}

          {medical?.vet_phone && (
            <div className="section">
              <h2>Vet</h2>
              <p>{medical.vet_practice || medical.vet_name}</p>
              {medical.vet_phone && <p className="sub">{medical.vet_phone}</p>}
            </div>
          )}

          <div className="footer">
            Full care guide available at nami.pet
            <br />
            Generated with PawSet
          </div>
        </div>
      </body>
    </html>
  );
}
