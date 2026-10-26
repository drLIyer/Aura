import { Phone } from "lucide-react";
import type { Recommendation } from "@/lib/types";

/** Shown only for true emergencies. Calm, direct, no risk numbers. */
export default function UrgentBanner({ recommendations }: { recommendations: Recommendation[] }) {
  const urgent = recommendations.filter((r) => r.severity === "urgent");
  if (!urgent.length) return null;
  return (
    <div role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 dark:bg-red-950/40 p-5" data-testid="banner-urgent">
      <div className="flex items-start gap-3">
        <Phone className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-red-800 dark:text-red-200">These symptoms need checking right away</h2>
          <p className="text-sm text-red-900/90 dark:text-red-100/90 mt-1">
            Please call your local emergency number or have someone take you to the emergency department. Don't take a triptan until you've been
            checked.
          </p>
          <ul className="text-sm text-red-900/80 dark:text-red-100/80 mt-2 list-disc pl-5">
            {urgent.map((r) => (
              <li key={r.id}>{r.detail.split(". ")[0]}.</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
