import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Shield,
  FileText,
  Share2,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  Users,
} from "lucide-react";

const steps = [
  {
    step: "1",
    title: "Add your pet",
    description: "Basic details, photo, microchip number, and insurance information.",
  },
  {
    step: "2",
    title: "Document their routine",
    description: "Feeding schedule, walks, medication, behaviour notes — everything a carer needs.",
  },
  {
    step: "3",
    title: "Add your people",
    description: "Sitters, neighbours, family, and your vet — everyone who helps look after them.",
  },
  {
    step: "4",
    title: "Generate your plan",
    description: "A polished, shareable care guide plus a printable pocket card for your wallet.",
  },
];

const features = [
  {
    icon: Heart,
    title: "Daily care instructions",
    description: "Feeding, walks, sleep routine, favourite toys, and behaviour notes — all in one place.",
  },
  {
    icon: Stethoscope,
    title: "Vet and medical details",
    description: "Vet contact, known conditions, medications, allergies, and vaccination history.",
  },
  {
    icon: Users,
    title: "Your trusted circle",
    description: "The people who help — with notes on who has keys and who to call first.",
  },
  {
    icon: Share2,
    title: "Shareable sitter guide",
    description: "A clean read-only link for pet sitters — with controls over what information is shared.",
  },
  {
    icon: FileText,
    title: "Printable pocket card",
    description: "A card with key contacts and a link to your pet's care profile — for your wallet or phone.",
  },
  {
    icon: Shield,
    title: "Private by default",
    description: "Your data is secure and private. Sensitive details are hidden from shared links unless you choose to include them.",
  },
];

const included = [
  "Pet profile with photo",
  "Daily routine and feeding schedule",
  "Behaviour and temperament notes",
  "Vet and medical information",
  "Trusted contacts",
  "Sitter handover guide",
  "Shareable care link",
  "Printable pocket card",
  "Plan completion score",
  "Section-level privacy controls",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-primary text-lg">PawSet</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <span>🐾</span>
          The home for your pet’s care
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
          Everything your pet needs,{" "}
          <span className="text-terra">in one lovely place.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Routines, quirks, vet details, and the people who help — organised
          into a beautiful care guide you can share in one tap.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="px-8">
              Get started free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="#whats-included">
            <Button size="lg" variant="outline" className="px-8">
              See what&apos;s included
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Free to get started · No credit card required
        </p>
      </section>

      {/* Problem statement */}
      <section className="bg-card border-y border-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 text-terra mb-4">
            <Heart className="h-5 w-5" />
            <span className="font-semibold text-sm uppercase tracking-wider">Why PawSet</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            One home for everything about them
          </h2>
          <p className="text-muted-foreground text-lg">
            Feeding quirks, medication doses, the sitter&apos;s number, the vet&apos;s address —
            it all lives in one calm, organised place instead of a dozen chats and notes apps.
          </p>
          <div className="mt-8 p-5 bg-background rounded-2xl border border-border text-left">
            <p className="text-foreground font-medium mb-2">
              &ldquo;Off for the weekend? Send your sitter one link.&rdquo;
            </p>
            <p className="text-muted-foreground text-sm">
              Whoever steps in sees exactly what they need — routines, contacts,
              and vet details. Nothing more, nothing less. You choose what’s shared.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">How it works</h2>
          <p className="text-muted-foreground">Create your complete pet plan in under 15 minutes.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.step} className="bg-card rounded-3xl p-5 shadow-card">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y border-border py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Everything in one place</h2>
            <p className="text-muted-foreground">All the information a carer or sitter needs — organised and ready to share.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section id="whats-included" className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-4">What&apos;s included</h2>
            <p className="text-muted-foreground mb-8">
              Everything a sitter, friend, or family member needs to step in
              confidently — from daily routines to trusted contacts and vet details.
            </p>
            <ul className="space-y-2.5">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card rounded-3xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                🐶
              </div>
              <div>
                <p className="font-semibold text-foreground">Lenny&apos;s Care Guide</p>
                <p className="text-xs text-muted-foreground">Golden Retriever · 4 years old</p>
              </div>
              <span className="ml-auto text-xs bg-success/15 text-success px-2 py-0.5 rounded-full font-medium">
                Plan ready
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Feeding</p>
                <p className="text-foreground">Morning and evening · 2 cups Royal Canin · Bowl away from fridge</p>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Trusted contact</p>
                <p className="text-foreground">Sarah M. · 07700 900123 · Has spare key</p>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Vet</p>
                <p className="text-foreground">Green Lane Vets · 01234 567890</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Shareable link · Last updated today</p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy note */}
      <section className="bg-card border-y border-border py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Private and secure by default</span>
          </div>
          <p className="text-muted-foreground">
            Your pet&apos;s information is only visible to you. Shared links show only what you
            choose to include. Sensitive details like home access notes are hidden unless you
            explicitly enable them. You can revoke any shared link at any time.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Ready to get their world in order?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          About 15 minutes now — and every future handover becomes a single link.
        </p>
        <Link href="/signup">
          <Button size="lg" className="px-10">
            Create our care guide
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>🐾</span>
            <span className="font-semibold text-primary">PawSet</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Everything your pet needs, in one place.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
