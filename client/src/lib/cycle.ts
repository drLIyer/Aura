import { useQuery } from "@tanstack/react-query";
import { tracksMenstrualCycle } from "@shared/engine/cds/patterns";
import type { ProfileRecord } from "@/lib/types";

/** Trigger and exposure id for the perimenstrual window. */
export const MENSTRUATION = "menstruation";

/** True when cycle tracking applies to this user (female, menstruating age). False while the profile loads. */
export function useCycleTracking(): boolean {
  const { data } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  return tracksMenstrualCycle(data?.profile, new Date().getFullYear());
}
