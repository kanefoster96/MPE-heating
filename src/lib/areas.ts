// Dedicated local landing pages — deliberately not a mass-produced
// "service in [town]" template swapped across every town in
// business.areasList. Google (and readers) treat that pattern as thin,
// near-duplicate content. Start with the one area explicitly asked for,
// written with real local detail, and add more the same way if it earns
// its place rather than automatically.

export type AreaPage = {
  slug: string;
  name: string;
  headline: string;
  subline: string;
  intro: string[];
  // Other towns from business.areasList worth namechecking as nearby
  // coverage — kept as plain text, not links, since they don't have
  // their own page yet.
  nearby: string[];
};

export const whitleyBayPage: AreaPage = {
  slug: "whitley-bay",
  name: "Whitley Bay",
  headline: "Boiler Repairs & Heating Engineers in Whitley Bay",
  subline:
    "Gas Safe registered engineers covering Whitley Bay and the North Tyneside coast — same-day response where we can, £50 call-out refunded when we fix it.",
  intro: [
    "Whitley Bay's a mix of Victorian and Edwardian terraces, seafront apartments and newer builds — which in practice means every kind of heating system, from older back boilers still going strong to combi systems only a few years old. We work on all of it.",
    "Coastal properties take more of a battering than most: salt air is harder on external flues, condensate pipes and outdoor fittings, which is one of the more common reasons we get called out along this stretch of coast. If yours needs a look, we're local and can usually get to you the same day.",
  ],
  nearby: ["Wallsend", "Gosforth", "Newcastle"],
};
