import type { FeatureIcon } from "./content";
import {
  PriceTagIcon,
  ClockIcon,
  CheckIcon,
  ShieldIcon,
  GasSafeMarkIcon,
  BoilerIcon,
  ServiceIcon,
  NewBoilerIcon,
  PlumbingIcon,
  ElectricsIcon,
  LandlordIcon,
  BuildingIcon,
  AwardIcon,
} from "@/components/icons";

// Maps the plain string keys used in content.ts's ServicePage entries to
// actual icon components — shared across every service sub-page's
// FeatureGrid and ServicePageHero so the mapping only lives in one place.
export const featureIconMap: Record<FeatureIcon, typeof CheckIcon> = {
  price: PriceTagIcon,
  clock: ClockIcon,
  check: CheckIcon,
  shield: ShieldIcon,
  gassafe: GasSafeMarkIcon,
  boiler: BoilerIcon,
  service: ServiceIcon,
  newboiler: NewBoilerIcon,
  plumbing: PlumbingIcon,
  electrics: ElectricsIcon,
  landlord: LandlordIcon,
  building: BuildingIcon,
  award: AwardIcon,
};
