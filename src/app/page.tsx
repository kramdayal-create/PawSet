import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Shield,
  FileText,
  Share2,
  Phone,
  MapPin,
  Clock,
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
    title: "Add emergency contacts",
    description: "Your trusted backup people, vet details, and what to do if you are unreachable.",
  },
  {
    step: "4",
    title: "Generate your plan",
    description: "A shareable care guide and printable emergency card — ready whenever you need it.",
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
    title: "Emergency contacts",
    description: "Trusted people who can step in, with notes on who has keys and who to call first.",
  },
  {
    icon: Share2,
    title: "Shareable sitter guide",
    description: "A clean read-only link for pet sitters — with controls over what information is shared.",
  },
  {
    icon: FileText,
    title: "Printable emergency card",
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
  "Emergency contacts",
  "Sitter handover guide",
  "Shareable care link",
  "Printable emergency card",
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
          <span className="text-terra">🐕</span>
          Peace of mind for solo pet parents
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
          Your pet&apos;s backup plan,{" "}
          <span className="text-primary">ready before you need it.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Create a simple emergency and care plan so trusted people know exactly
          how to care for your pet if you are away, delayed, or unreachable.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="px-8">
              Create my pet plan
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
            <Clock className="h-5 w-5" />
            <span className="font-semibold text-sm uppercase tracking-wider">The problem</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Pet information is scattered everywhere
          </h2>
          <p className="text-muted-foreground text-lg">
            It lives across WhatsApp messages, notes apps, vet invoices, paper records, and
            memory. In an emergency or when a sitter steps in, crucial details go missing —
            creating stress for you and risk for your pet.
          </p>
          <div className="mt-8 p-5 bg-background rounded-2xl border border-border text-left">
            <p className="text-foreground font-medium mb-2">
              &ldquo;What happens to my pet if something happens to me?&rdquo;
            </p>
            <p className="text-muted-foreground text-sm">
              PawSet gives you a practical safety net. Everything in one place,
              ready to share with a trusted person — or a sitter, neighbour, or vet —
              at any time.
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
            <div key={s.step} className="bg-card border border-border rounded-2xl p-5 shadow-card">
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
              PawSet covers everything a backup carer or pet sitter needs to step in
              confidently — from daily routines to emergency contacts and vet information.
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
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
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Emergency contact</p>
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
          Ready to create your pet&apos;s backup plan?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          It takes about 15 minutes. When it&apos;s done, you&apos;ll have peace of mind
          that your pet is covered — whatever happens.
        </p>
        <Link href="/signup">
          <Button size="lg" className="px-10">
            Create my pet plan
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
            Your pet&apos;s care plan, ready before you need it.
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
