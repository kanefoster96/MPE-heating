import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 4.5h3.2l1.4 4.2-2 1.6a11.5 11.5 0 0 0 5.6 5.6l1.6-2 4.2 1.4v3.2c0 1-.9 1.7-1.8 1.5A16.5 16.5 0 0 1 3 5.3c-.2-.9.5-1.8 1.5-1.8Z" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8L12 2.5Z" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21.5S5 15 5 10a7 7 0 1 1 14 0c0 5-7 11.5-7 11.5Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
    </svg>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.2 1-1.2 1.9v.4" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10.5v4" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5.5c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.7 4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 1.8a8 8 0 1 1-4.3 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3.1 4c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.7 1.2 2.9c.1.2 2 3 4.7 4.2 2.3 1 2.7.8 3.2.8.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-2.2-1c-.3-.2-.5-.2-.7.1l-.9 1.1c-.2.2-.4.2-.6.1-.4-.1-1.5-.5-2.8-1.7-1-1-1.7-2-1.9-2.4-.2-.4 0-.5.1-.7l.5-.6c.2-.2.2-.4.1-.6l-1-2.3c-.1-.3-.3-.3-.5-.3h-.6Z" />
    </svg>
  );
}

/* --- Service / illustration icons --- */

export function BoilerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <circle cx="12" cy="16" r="2.4" />
      <path d="M9.5 13.5v-6M14.5 13.5v-6M9 7.5h1.6M9 9.5h1.6" />
    </svg>
  );
}

export function ServiceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.7 6.3a3.5 3.5 0 0 1-4.6 4.6L4 17l2 2 6.1-6.1a3.5 3.5 0 0 1 4.6-4.6l-2.4 2.4-1.4-1.4 2.4-2.4Z" />
    </svg>
  );
}

export function NewBoilerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="2.5" width="10" height="16" rx="2.2" />
      <circle cx="12" cy="14.2" r="1.8" />
      <path d="M9 6h6M4.5 21.5h15" />
    </svg>
  );
}

export function PlumbingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v4a4 4 0 0 0 4 4h1v3" />
      <circle cx="11" cy="17.5" r="3" />
      <path d="M3.5 4h5" />
    </svg>
  );
}

export function ElectricsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function LandlordIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
      <path d="M15.5 17.5l1.5 1.5 3-3" />
    </svg>
  );
}

export function VanIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8h11v8H3z" />
      <path d="M14 11h3.5L20 13.5V16h-6z" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}

export function PriceTagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.5 3.5H20v7.5L11 20l-8-8 8.5-8.5Z" />
      <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function FormIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  );
}

export function DoorstepIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function WrenchFixIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="3" width="10" height="14" rx="2" />
      <circle cx="12" cy="16.5" r="2.2" />
      <path d="M9.5 7h5" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="10" height="18" rx="1.5" />
      <rect x="14" y="9" width="6" height="12" rx="1.5" />
      <path d="M7 7h1M10 7h1M7 10.5h1M10 10.5h1M7 14h1M10 14h1M17 12.5h1M17 16h1" />
    </svg>
  );
}

export function AwardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5" />
    </svg>
  );
}

export function GasSafeMarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5l8 3.5v5c0 5.5-3.4 9.4-8 10.5-4.6-1.1-8-5-8-10.5V6l8-3.5Z" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.5-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S5.8 5.5 12 5.5 21.5 12 21.5 12 18.2 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.7c.45-.1.9-.15 1.4-.15 6.2 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3.3 4.1M6.6 6.6C4.2 8.2 2.5 10.5 2.5 10.5S5.8 17 12 17c1 0 1.9-.15 2.75-.4" />
      <path d="M9.9 10c-.25.35-.4.78-.4 1.25 0 1.24 1.01 2.25 2.25 2.25.47 0 .9-.14 1.25-.4" />
    </svg>
  );
}
