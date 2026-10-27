import type { AssistMemory } from "@shared/assist/types";
import type { AttackInput, DailyLogInput, MedicationInput, PatternsInput, ProfileInput, SupplementInput } from "@shared/api";

export type Medication = MedicationInput & { id: string };
export type Supplement = SupplementInput & { id: string };
export type Attack = AttackInput & { id: string };
export type CheckIn = DailyLogInput & { date: string };
export interface ProfileRecord {
  profile: ProfileInput;
  patterns: PatternsInput;
  timezone: string | null;
  memory?: AssistMemory;
}
export interface Period {
  id: string;
  startDate: string;
  endDate: string | null;
}
export interface QuickLog {
  id: string;
  timestamp: string;
  localDate: string | null;
}
export type { Recommendation } from "@shared/engine/domain/types";
export type { Forecast } from "@shared/engine/cds/riskModel";
export type { CycleStatus } from "@shared/engine/cds/patterns";
