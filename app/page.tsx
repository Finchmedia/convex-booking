"use client";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neutral-100 mb-4">
            Convex Booking System
          </h1>
          <p className="text-neutral-400">
            Beautiful booking calendar powered by Convex
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-neutral-500">
            Calendar will appear here...
          </p>
        </div>
      </div>
    </div>
  );
}
