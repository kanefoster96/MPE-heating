import type { ChipIcon } from "./content";
import {
  FormIcon,
  VanIcon,
  CheckIcon,
  ShieldIcon,
  ClockIcon,
  NoteIcon,
  MailIcon,
  CalendarIcon,
  PriceTagIcon,
} from "@/components/icons";

// Maps the plain string keys used for chips in content.ts to icon
// components, so content.ts stays free of JSX.
export const chipIconMap: Record<ChipIcon, typeof CheckIcon> = {
  form: FormIcon,
  van: VanIcon,
  check: CheckIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  note: NoteIcon,
  mail: MailIcon,
  calendar: CalendarIcon,
  price: PriceTagIcon,
};
