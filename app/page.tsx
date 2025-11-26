import Link from "next/link";
import {
  Calendar,
  Settings,
  Clock,
  Users,
  Zap,
  Shield,
  Layers,
  Timer,
  Database,
  GitBranch,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* 1. Hero Section */}
        <header className="text-center py-32 mb-20">
          <h1 className="text-7xl font-bold text-white mb-8">
            ConvexBooking
          </h1>
          <p className="text-3xl text-neutral-400 mb-6">
            Real-time booking system for Convex
          </p>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto">
            A production-ready booking component with presence-aware slot locking,
            multi-duration support, and O(1) availability queries.
          </p>
        </header>

        {/* 2. Demo Cards (Primary CTA) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          <Link
            href="/book"
            className="group p-8 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all duration-200"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">
                  Try Booking
                </h2>
                <p className="text-sm text-neutral-400">
                  Experience the customer-facing booking flow
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/demo"
            className="group p-8 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all duration-200"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Settings className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">
                  Admin Dashboard
                </h2>
                <p className="text-sm text-neutral-400">
                  Manage resources, schedules, and bookings
                </p>
              </div>
            </div>
          </Link>
        </section>

        {/* 3. Features Section */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
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
          <h2 className="text-2xl font-bold text-white text-center mb-10">
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
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            Tech Stack
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <TechBadge icon={<Database className="w-4 h-4" />} label="Convex" />
            <TechBadge icon={<GitBranch className="w-4 h-4" />} label="Next.js 15" />
            <TechBadge label="React 19" />
            <TechBadge label="TypeScript" />
            <TechBadge label="shadcn/ui" />
            <TechBadge label="Tailwind CSS" />
          </div>
        </section>

        {/* 6. Footer */}
        <footer className="text-center pt-8 border-t border-neutral-800">
          <p className="text-neutral-500 text-sm">
            Built with{" "}
            <a
              href="https://convex.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Convex
            </a>
          </p>
          <p className="text-neutral-600 text-xs mt-2">
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
    <div className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/30">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-md bg-neutral-800 text-neutral-400">
          {icon}
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
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
    <div className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/30">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 mb-3">{description}</p>
      <code className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
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
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-300 text-sm">
      {icon}
      {label}
    </span>
  );
}
