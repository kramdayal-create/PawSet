import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Feature-level tests for the mutating server actions, with the Supabase
 * client and Next helpers mocked. Verifies each feature (add pet, add
 * contact, create share link) issues the correct database operation —
 * without needing a live database.
 */

// Records the last DB operation the action performed.
const dbCall: { table?: string; op?: string; payload?: any } = {};

function fakeClient() {
  return {
    from(table: string) {
      dbCall.table = table;
      return {
        insert(payload: any) {
          dbCall.op = "insert";
          dbCall.payload = payload;
          const row = { id: "row-1", token: payload.token };
          // Awaitable (for inserts without .select()) AND chainable.
          return {
            select: () => ({ single: async () => ({ data: row, error: null }) }),
            then: (resolve: (v: any) => void) => resolve({ error: null }),
          };
        },
      };
    },
  };
}

class Redirected extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => fakeClient() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

import { createPet } from "./pets/actions";
import { createContact } from "./contacts/actions";
import { createShareLink } from "./share/actions";

async function run(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Redirected) return e.url;
    throw e;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  dbCall.table = undefined;
  dbCall.op = undefined;
  dbCall.payload = undefined;
});

describe("add-a-pet feature", () => {
  it("inserts a pet with the demo owner and redirects to its page", async () => {
    const fd = new FormData();
    fd.set("name", "  Lenny  ");
    fd.set("species", "dog");
    fd.set("breed", "Labrador");
    fd.set("age_text", "");

    const url = await run(() => createPet(fd));

    expect(dbCall.table).toBe("pets");
    expect(dbCall.op).toBe("insert");
    expect(dbCall.payload.name).toBe("Lenny"); // trimmed
    expect(dbCall.payload.species).toBe("dog");
    expect(dbCall.payload.breed).toBe("Labrador");
    expect(dbCall.payload.age_text).toBeNull(); // empty -> null
    expect(dbCall.payload.user_id).toBe("00000000-0000-0000-0000-000000000000");
    expect(url).toBe("/dashboard/pets/row-1");
  });
});

describe("add-a-contact feature", () => {
  it("inserts a contact and maps checkbox flags", async () => {
    const fd = new FormData();
    fd.set("name", "Sarah Miller");
    fd.set("phone", "07700 900123");
    fd.set("can_contact_in_emergency", "on");
    fd.set("has_home_access", "on");

    const url = await run(() => createContact(fd));

    expect(dbCall.table).toBe("contacts");
    expect(dbCall.payload.name).toBe("Sarah Miller");
    expect(dbCall.payload.can_contact_in_emergency).toBe(true);
    expect(dbCall.payload.has_home_access).toBe(true);
    expect(dbCall.payload.visible_in_shared_guide).toBe(false); // unchecked
    expect(url).toBe("/dashboard/contacts?saved=1");
  });
});

describe("create-share-link feature", () => {
  it("inserts a link with a URL-safe token and the chosen sections", async () => {
    const fd = new FormData();
    fd.set("title", "Weekend with Sarah");
    fd.set("include_basic_details", "on");
    fd.set("include_routine", "on");
    fd.set("include_medical", "on");

    const url = await run(() => createShareLink("pet-1", fd));

    expect(dbCall.table).toBe("share_links");
    expect(dbCall.payload.pet_id).toBe("pet-1");
    expect(dbCall.payload.title).toBe("Weekend with Sarah");
    expect(dbCall.payload.include_basic_details).toBe(true);
    expect(dbCall.payload.include_routine).toBe(true);
    expect(dbCall.payload.include_medical).toBe(true);
    expect(dbCall.payload.include_contacts).toBe(false);
    // The fix: a valid URL-safe token (no base64url DB dependency)
    expect(dbCall.payload.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(url).toContain("/dashboard/pets/pet-1?tab=share&created=");
  });
});
