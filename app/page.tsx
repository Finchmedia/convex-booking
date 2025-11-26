import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Settings,
  Clock,
  Users,
  Zap,
  Shield,
  Layers,
  Timer,
  Github,
  Linkedin,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-300 to-white dark:from-background dark:via-muted dark:to-background">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* 1. Hero Section */}
        <header className="text-center py-32 mb-20">
          <h1 className="text-7xl font-bold text-foreground mb-8">
            ConvexBooking
          </h1>
          <p className="text-3xl text-foreground mb-6 flex items-center justify-center">
            <span>Real-time booking system for</span>
            <Image src="/convex-logotype-black.svg" alt="Convex" width={170} height={38} className="dark:hidden -ml-1 translate-y-[1px]" />
            <Image src="/convex-logotype-white.svg" alt="Convex" width={170} height={38} className="hidden dark:block -ml-1 translate-y-[1px]" />
          </p>
          <p className="text-xl text-muted-foreground/70 max-w-2xl mx-auto">
            An open-source booking component with presence-aware slot locking,
            multi-duration support, and O(1) availability queries.
          </p>
        </header>

        {/* 2. Demo Cards (Primary CTA) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          <Link
            href="/book"
            className="group p-8 rounded-xl border border-border bg-card/50 hover:bg-muted hover:border-foreground/20 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Try Booking
                </h2>
                <p className="text-sm text-muted-foreground">
                  Experience the customer-facing booking flow
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/demo"
            className="group p-8 rounded-xl border border-border bg-card/50 hover:bg-muted hover:border-foreground/20 hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Settings className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Admin Dashboard
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage resources, schedules, and bookings
                </p>
              </div>
            </div>
          </Link>
        </section>

        {/* 3. Features Section */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Users className="w-5 h-5" />}
              title="Real-time Presence"
              description="Slot locking prevents double bookings. Other users see reserved slots instantly."
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="Multi-Duration"
              description="Support for flexible booking lengths (30min, 1h, 2h, 5h) with intelligent conflict detection."
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="O(1) Queries"
              description="Availability checks scale to millions of bookings using discrete time buckets."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="ACID Transactions"
              description="Race-condition free bookings with Convex's transactional guarantees."
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5" />}
              title="Multi-Resource"
              description="Book rooms, equipment, or people. Resources can be bundled or standalone."
            />
            <FeatureCard
              icon={<Timer className="w-5 h-5" />}
              title="Flexible Schedules"
              description="Define availability windows, date overrides, and buffer times."
            />
          </div>
        </section>

        {/* 4. Architecture Section */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ArchCard
              title="96-Slot Quantum"
              description="Time normalized into 15-minute chunks (0-95 per day). Fast integer math, predictable memory."
              detail="Slot 0 = 00:00, Slot 56 = 14:00"
            />
            <ArchCard
              title="Presence System"
              description="10-second heartbeat timeout with batched updates. Slots auto-release when users leave."
              detail="5s heartbeat interval"
            />
            <ArchCard
              title="Frontend Derivation"
              description="Stable booking queries + volatile presence queries merged client-side for O(1) cache invalidation."
              detail="No query thrashing"
            />
          </div>
        </section>

        {/* 5. Tech Stack */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-6">
            Tech Stack
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <TechBadge
              icon={<Image src="/convex-color.svg" alt="Convex" width={24} height={24} />}
              label="Convex"
            />
            <TechBadge
              icon={
                <>
                  <Image src="/nextjs-icon-light-background.svg" alt="Next.js" width={24} height={24} className="dark:hidden" />
                  <Image src="/nextjs-icon-dark-background.svg" alt="Next.js" width={24} height={24} className="hidden dark:block" />
                </>
              }
              label="Next.js 15"
            />
            <TechBadge
              icon={<Image src="/react.png" alt="React" width={26} height={24} />}
              label="React 19"
            />
            <TechBadge
              icon={<Image src="/typescript.svg" alt="TypeScript" width={24} height={24} className="rounded" />}
              label="TypeScript"
            />
            <TechBadge
              icon={<ShadcnIcon />}
              label="shadcn/ui"
            />
            <TechBadge
              icon={<Image src="/tailwind.svg" alt="Tailwind CSS" width={28} height={18} />}
              label="Tailwind CSS"
            />
          </div>
        </section>

        {/* 6. About Me */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            About Me
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-8 p-8 rounded-xl border border-border bg-card/30">
            <Image
              src="/daniel_avatar.jpg"
              alt="Daniel Finke"
              width={128}
              height={128}
              className="w-32 h-32 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold text-foreground mb-3">Daniel Finke</h3>
              <p className="text-muted-foreground mb-4">
                From crafting beats as a musician and producer to building workflows in Airtable and no-code tools,
                my journey has been one of constant learning. Now I&apos;m exploring fullstack development with Convex,
                curious to see how far I can push myself and picking up something new every day. This booking component
                is my first contribution to the open-source community — still a work in progress, so if you spot bugs
                or have ideas, I&apos;d genuinely love to hear from you.
              </p>
              <div className="flex gap-3 justify-center md:justify-start">
                <a
                  href="https://www.linkedin.com/in/daniel-finke-563623178/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
                <a
                  href="https://github.com/Finchmedia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Footer */}
        <footer className="text-center pt-8 border-t border-border">
          <p className="text-muted-foreground text-sm">
            Built with{" "}
            <a
              href="https://convex.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Convex
            </a>
          </p>
          <p className="text-muted-foreground/50 text-xs mt-2">
            Development Demo
          </p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg border border-border bg-card/30">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ArchCard({
  title,
  description,
  detail,
}: {
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <div className="p-6 rounded-lg border border-border bg-card/30">
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <code className="text-xs text-muted-foreground/70 bg-muted px-2 py-1 rounded">
        {detail}
      </code>
    </div>
  );
}

function TechBadge({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-muted dark:bg-neutral-700 text-foreground text-base font-medium">
      {icon}
      {label}
    </span>
  );
}

function ShadcnIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className="w-6 h-6"
    >
      <rect width="256" height="256" fill="none" />
      <line
        x1="208"
        y1="128"
        x2="128"
        y2="208"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <line
        x1="192"
        y1="40"
        x2="40"
        y2="192"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
    </svg>
  );
}
