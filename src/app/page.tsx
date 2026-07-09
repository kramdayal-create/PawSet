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
    title: "Add your furbaby",
    description: "Their name, their face, and all the little things that make them family.",
  },
  {
    step: "2",
    title: "Capture their world",
    description: "Meals, walks, meds, and the quirks only family would ever know.",
  },
  {
    step: "3",
    title: "Add their people",
    description: "Your vet, sitter, dog walker, the grandparents — everyone who loves them too.",
  },
  {
    step: "4",
    title: "Share in one tap",
    description: "A care guide anyone can follow, plus a wallet card for the just-in-case.",
  },
];

const features = [
  {
    icon: Heart,
    title: "Their daily rhythm",
    description: "Meals, walks, naps, favourite toys, and the little habits a sitter could never guess.",
  },
  {
    icon: Stethoscope,
    title: "Health, always ready",
    description: "Vet, conditions, meds, and allergies — on hand for a check-up or a midnight worry.",
  },
  {
    icon: Users,
    title: "Their whole village",
    description: "Everyone who loves them too — with who has a spare key and who to call first.",
  },
  {
    icon: Share2,
    title: "One link, total peace of mind",
    description: "A read-only guide for whoever's watching them — and you choose exactly what shows.",
  },
  {
    icon: FileText,
    title: "For the just-in-case",
    description: "Key contacts and a link to their full profile — for your wallet or your phone.",
  },
  {
    icon: Shield,
    title: "Private, always",
    description: "It's all yours. Shared links reveal only what you pick, and switch off in a tap.",
  },
];

const included = [
  "Profile with photo & personality",
  "Daily routine & feeding schedule",
  "Behaviour, quirks & comforts",
  "Vet & medical records",
  "Everyone in their village",
  "Sitter-ready care guide",
  "One-tap shareable link",
  "Printable wallet card",
  "Care completeness score",
  "Full control over what's shared",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-display text-xl tracking-wide text-card-foreground">PawSet</span>
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
        <div className="inline-flex items-center gap-2 bg-card text-card-foreground rounded-full px-4 py-1.5 text-xs font-semibold mb-6 shadow-card eyebrow">
          <span>🐾</span>
          Because they're family, not pets
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl text-canvas leading-[1.05] mb-6">
          Whoever&apos;s watching your furbaby{" "}
          <span className="text-terra">will care for them just like you.</span>
        </h1>
        <p className="text-lg sm:text-xl text-canvas-muted max-w-2xl mx-auto mb-10">
          Their meals, their meds, their favourite spot on the couch, their vet,
          their people — all in one place. Hand it to a sitter or your mum in one
          tap, and never lie awake wondering if they got it right.
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
        <p className="text-sm text-canvas-muted mt-4">
          Free to start · No credit card · Ready before your next trip
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
            Everything about them, out of your head and into one calm place
          </h2>
          <p className="text-muted-foreground text-lg">
            The feeding quirks. The 3pm meds. Which treats are a hard no. The vet&apos;s number and
            the neighbour with the spare key. Right now it all lives in your memory and a mess of
            text threads — until the one time you&apos;re not there. PawSet keeps it together, ready
            to hand over.
          </p>
          <div className="mt-8 p-5 bg-paw-yellowsoft rounded-2xl text-left">
            <p className="text-foreground font-medium mb-2">
              &ldquo;Leaving them with a sitter? Just send one link.&rdquo;
            </p>
            <p className="text-muted-foreground text-sm">
              They&apos;ll see exactly how your furbaby likes things — and you can finally relax,
              knowing nothing got lost in translation.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl text-canvas mb-3">How it works</h2>
          <p className="text-canvas-muted">Set it up once. Ready every time you have to leave them.</p>
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
            <h2 className="text-4xl text-foreground mb-3">Everything their carer needs — nothing they don&apos;t</h2>
            <p className="text-muted-foreground">Organised, always current, and ready the moment you share it.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-paw-pinksoft flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-paw-pink" />
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
            <h2 className="text-4xl text-canvas mb-4">What&apos;s included</h2>
            <p className="text-canvas-muted mb-8">
              From their morning routine to the vet&apos;s number — everything whoever&apos;s
              watching them could need, ready to hand over in a tap.
            </p>
            <ul className="space-y-2.5">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-canvas">
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
              <div className="bg-secondary rounded-2xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Feeding</p>
                <p className="text-foreground">Morning and evening · 2 cups Royal Canin · Bowl away from fridge</p>
              </div>
              <div className="bg-secondary rounded-2xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Trusted contact</p>
                <p className="text-foreground">Sarah M. · 07700 900123 · Has spare key</p>
              </div>
              <div className="bg-secondary rounded-2xl p-3">
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
            <span className="font-semibold text-foreground">Private by default, always</span>
          </div>
          <p className="text-muted-foreground">
            Your pet&apos;s details are only ever visible to you. When you share, the link shows
            just what you choose — sensitive things like spare-key notes stay hidden unless you
            say so. Change your mind? Switch any link off in a tap.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-4xl sm:text-5xl text-canvas mb-4">
          Give them your care, even when you can&apos;t be there
        </h2>
        <p className="text-canvas-muted mb-8 max-w-xl mx-auto">
          Ten minutes now buys a lifetime of easier goodbyes. Set it up once, and every
          trip, sitter, and just-in-case is already handled.
        </p>
        <Link href="/signup">
          <Button size="lg" className="px-10">
            Get started free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>🐾</span>
            <span className="font-display tracking-wide text-canvas">PawSet</span>
          </div>
          <p className="text-sm text-canvas-muted">
            Because they&apos;re family.
          </p>
          <div className="flex gap-4 text-sm text-canvas-muted">
            <Link href="/login" className="hover:text-canvas transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-canvas transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
