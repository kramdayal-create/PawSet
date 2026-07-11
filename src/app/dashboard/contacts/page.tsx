import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";
import { createContact, updateContact, deleteContact } from "./actions";
import type { Contact } from "@/lib/pawset/types";
import { Plus, Phone, Mail, Key, AlertTriangle, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

const contactTypeOptions = [
  "Emergency contact",
  "Backup carer",
  "Pet sitter",
  "Dog walker",
  "Vet",
  "Groomer",
  "Neighbour",
  "Family / friend",
  "Building manager",
  "Other",
];


export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string; add?: string; edit?: string };
}) {
  const supabase = db();
  let userId = "00000000-0000-0000-0000-000000000000";
  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) userId = user.id;
  }

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  const contacts = (data as Contact[]) ?? [];
  const editContact = searchParams.edit
    ? contacts.find((c) => c.id === searchParams.edit) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-canvas">Contacts</h1>
          <p className="text-canvas-muted text-sm mt-1">
            People who can help care for your pet
          </p>
        </div>
      </div>

      {searchParams.saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          Contact saved successfully.
        </div>
      )}
      {searchParams.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      {/* Contact list */}
      {contacts.length > 0 && (
        <div className="space-y-3">
          {contacts.map((contact, i) => (
            <div
              key={contact.id}
              className={`${["bg-paw-pinksoft", "bg-paw-yellowsoft", "bg-paw-skysoft", "bg-paw-limesoft"][i % 4]} rounded-3xl p-4 shadow-card`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-lg flex-shrink-0">
                  {contact.can_contact_in_emergency ? "⚡" : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    {contact.contact_type && (
                      <span className="text-xs bg-card text-foreground px-2 py-0.5 rounded-full">
                        {contact.contact_type}
                      </span>
                    )}
                  </div>
                  {contact.relationship && (
                    <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {contact.can_contact_in_emergency && (
                      <span className="flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Emergency contact
                      </span>
                    )}
                    {contact.has_home_access && (
                      <span className="flex items-center gap-1 text-xs bg-paw-yellowsoft text-warning-foreground px-2 py-0.5 rounded-full">
                        <Key className="h-2.5 w-2.5" />
                        Has spare key
                      </span>
                    )}
                    {contact.visible_in_shared_guide && (
                      <span className="flex items-center gap-1 text-xs bg-card text-foreground px-2 py-0.5 rounded-full">
                        <Eye className="h-2.5 w-2.5" />
                        Visible in guide
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <a href={`/dashboard/contacts?edit=${contact.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs h-7">Edit</Button>
                  </a>
                  <form action={deleteContact.bind(null, contact.id)}>
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
              {contact.notes && (
                <p className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                  {contact.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {(searchParams.add || editContact || contacts.length === 0) && (
        <div className="bg-card rounded-3xl p-5 shadow-card">
          <h2 className="font-semibold text-foreground mb-4">
            {editContact ? `Edit ${editContact.name}` : "Add a contact"}
          </h2>

          <form
            action={editContact
              ? updateContact.bind(null, editContact.id)
              : createContact}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={editContact?.name ?? ""}
                  placeholder="Sarah Miller"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_type">Contact type</Label>
                <select
                  id="contact_type"
                  name="contact_type"
                  defaultValue={editContact?.contact_type ?? ""}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select type</option>
                  {contactTypeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  name="relationship"
                  defaultValue={editContact?.relationship ?? ""}
                  placeholder="Best friend, Sister, Neighbour..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={editContact?.phone ?? ""}
                  placeholder="07700 900123"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editContact?.email ?? ""}
                placeholder="sarah@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={editContact?.notes ?? ""}
                placeholder="She's great with dogs and happy to step in short notice."
              />
            </div>

            <div className="space-y-2.5 pt-1">
              <p className="text-sm font-medium text-foreground">Permissions</p>
              {[
                { name: "can_contact_in_emergency", label: "Can be contacted in an emergency", defaultChecked: editContact?.can_contact_in_emergency ?? false },
                { name: "has_home_access", label: "Has spare key / home access", defaultChecked: editContact?.has_home_access ?? false },
                { name: "visible_in_shared_guide", label: "Show in shared sitter guide", defaultChecked: editContact?.visible_in_shared_guide ?? false },
              ].map((opt) => (
                <label key={opt.name} className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    name={opt.name}
                    defaultChecked={opt.defaultChecked}
                    className="h-4 w-4 rounded border-input"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              {editContact && (
                <a href="/dashboard/contacts" className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </a>
              )}
              <Button type="submit" className={cn(editContact ? "flex-1" : "w-full")}>
                {editContact ? "Save changes" : "Add contact"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {contacts.length > 0 && !searchParams.add && !editContact && (
        <a href="/dashboard/contacts?add=1">
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add another contact
          </Button>
        </a>
      )}

      {contacts.length === 0 && !searchParams.add && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">👤</div>
          <h2 className="font-semibold text-foreground mb-2">Add someone your pet can count on</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Choose a trusted person who should be contacted if you are delayed, travelling, or unreachable.
          </p>
        </div>
      )}
    </div>
  );
}
