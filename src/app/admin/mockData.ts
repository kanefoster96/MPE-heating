// Placeholder data so the admin screens are demoable before Supabase
// exists — swap for real `profiles`/`bookings`/`job_notes` queries (see
// supabase/migrations/20260828000000_init.sql) once it does. Not real
// customers. Each admin page seeds its own useState from these arrays, so
// edits don't persist across navigations — expected for a preview, not a
// bug: real persistence arrives with Supabase.

export type BookingStatus = "new" | "answered" | "confirmed" | "completed" | "cancelled";
export type BookingSource = "form" | "phone" | "whatsapp" | "email";

export type MockCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  boilerMake?: string;
  boilerAge?: string;
  hasCardOnFile: boolean;
  stripeCustomerId?: string;
};

export type MockNote = {
  id: string;
  customerId: string;
  date: string;
  text: string;
};

export type MockBooking = {
  id: string;
  customerId: string;
  message: string;
  sameDayRequested: boolean;
  submittedAgo: string;
  status: BookingStatus;
  source: BookingSource;
  calloutDate?: string;
  timeWindow?: string;
  amountChargedPence?: number;
};

export const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    id: "c1",
    name: "Sarah Thompson",
    phone: "07911 123456",
    email: "sarah.t@example.com",
    hasCardOnFile: false,
  },
  {
    id: "c2",
    name: "Mark Reid",
    phone: "07700 900123",
    email: "",
    hasCardOnFile: false,
  },
  {
    id: "c3",
    name: "Priya Kaur",
    phone: "07822 456789",
    email: "priya.k@example.com",
    address: "14 Overhill Lane, Whitley Bay, NE26 2ST",
    boilerMake: "Worcester Bosch",
    boilerAge: "6–10 years",
    hasCardOnFile: true,
    stripeCustomerId: "cus_mock_priya01",
  },
  {
    id: "c4",
    name: "Dave Henshaw",
    phone: "07555 200144",
    email: "dave.h@example.com",
    address: "3 Coach Road, Gosforth, NE3 1RJ",
    boilerMake: "Vaillant",
    boilerAge: "10+ years",
    hasCardOnFile: true,
    stripeCustomerId: "cus_mock_dave01",
  },
];

export const MOCK_NOTES: MockNote[] = [
  {
    id: "n1",
    customerId: "c3",
    date: "2026-06-14",
    text: "Replaced diverter valve. Advised to keep an eye on pressure over the next month.",
  },
  {
    id: "n2",
    customerId: "c4",
    date: "2025-11-02",
    text: "Annual service. Flue gas readings all within range.",
  },
];

export const MOCK_BOOKINGS: MockBooking[] = [
  {
    id: "b1",
    customerId: "c1",
    message: "No hot water since this morning, radiators are cold too.",
    sameDayRequested: true,
    submittedAgo: "12 minutes ago",
    status: "new",
    source: "form",
  },
  {
    id: "b2",
    customerId: "c2",
    message: "Just wanted to check what your call-out charge covers before booking anything in.",
    sameDayRequested: false,
    submittedAgo: "1 hour ago",
    status: "new",
    source: "form",
  },
  {
    id: "b3",
    customerId: "c3",
    message: "Pressure keeps dropping every few days, topped it up twice this month.",
    sameDayRequested: false,
    submittedAgo: "Yesterday",
    status: "confirmed",
    source: "form",
    calloutDate: "2026-09-02",
    timeWindow: "11am – 2pm",
  },
  {
    id: "b4",
    customerId: "c4",
    message: "Annual service booked over the phone.",
    sameDayRequested: false,
    submittedAgo: "3 days ago",
    status: "completed",
    source: "phone",
    calloutDate: "2026-08-29",
    timeWindow: "8am – 11am",
    amountChargedPence: 7900,
  },
];

export function getCustomer(id: string): MockCustomer | undefined {
  return MOCK_CUSTOMERS.find((c) => c.id === id);
}

export function getBookingsForCustomer(customerId: string): MockBooking[] {
  return MOCK_BOOKINGS.filter((b) => b.customerId === customerId);
}

export function getNotesForCustomer(customerId: string): MockNote[] {
  return MOCK_NOTES.filter((n) => n.customerId === customerId).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

export const TIME_WINDOWS = ["8am – 11am", "11am – 2pm", "2pm – 5pm", "5pm – 7pm"];
