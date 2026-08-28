// Dedicated local landing pages — one per town in business.areasList,
// each with real, distinct detail (housing stock, rough distance/
// direction from Whitley Bay, area-specific questions) rather than a
// single template with the town name swapped in. That kind of
// find-and-replace page reads as thin, near-duplicate content to Google
// and doesn't actually help anyone searching.
//
// Distances are approximate road-trip estimates ("around X miles"), not
// looked up from a mapping API — good enough to set expectations, not
// precise enough to state as fact. Housing-stock notes lean on
// well-documented local history (Cramlington and Washington are
// designated postwar new towns, Wallsend's shipbuilding and Roman
// history, etc.) rather than anything invented. No specific parts
// suppliers/shops are named per town — that would need verifying real
// branch locations we don't have, so instead every page notes that
// engineers carry common parts on the van (see AreaPageTemplate).

export type AreaPage = {
  slug: string;
  name: string;
  headline: string;
  subline: string;
  // How this page's hero flame-icon differs, if at all — currently all
  // areas use the boiler icon, kept as a field in case a future area
  // wants to lead with a different service.
  distance: string;
  intro: string[];
  nearby: string[]; // other area slugs, or [] if genuinely none are close
  faqs: { q: string; a: string }[];
};

export const areaPages: AreaPage[] = [
  {
    slug: "whitley-bay",
    name: "Whitley Bay",
    headline: "Boiler Repairs & Heating Engineers in Whitley Bay",
    subline:
      "Gas Safe registered engineers covering Whitley Bay and the North Tyneside coast — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "Whitley Bay is MPE's home patch on the North Tyneside coast.",
    intro: [
      "Whitley Bay's a mix of Victorian and Edwardian terraces, seafront apartments and newer builds — which in practice means every kind of heating system, from older back boilers still going strong to combi systems only a few years old. We work on all of it.",
      "Coastal properties take more of a battering than most: salt air is harder on external flues, condensate pipes and outdoor fittings, which is one of the more common reasons we get called out along this stretch of coast. If yours needs a look, we're local and can usually get to you the same day.",
    ],
    nearby: ["wallsend", "gosforth", "newcastle"],
    faqs: [
      {
        q: "Do you cover all of Whitley Bay?",
        a: "Yes — the seafront, the Avenues, Monkseaton and everywhere in between.",
      },
      {
        q: "How quickly can you get to me in Whitley Bay?",
        a: "Being based right here, Whitley Bay is usually one of our quickest same-day slots.",
      },
    ],
  },
  {
    slug: "newcastle",
    name: "Newcastle",
    headline: "Boiler Repairs & Heating Engineers in Newcastle",
    subline:
      "Gas Safe registered engineers covering Newcastle and the surrounding suburbs — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 9 miles south-west of Whitley Bay, down the coast road or over the Tyne bridges.",
    intro: [
      "Newcastle's housing stock is about as varied as it gets — Victorian terraces in Heaton, Jesmond and Sandyford (a lot of them the classic Tyneside flat, an upstairs-downstairs design unique to this part of the country), high-rise and new-build apartments around the city centre and Quayside, and semis further out towards Gosforth and the West End.",
      "That variety means we see everything from decades-old back boilers to the newest combi installs on the same street. Whatever's in, we can usually get someone to you the same day if it's an emergency.",
    ],
    nearby: ["gosforth", "gateshead", "wallsend"],
    faqs: [
      {
        q: "Do you cover the city centre as well as the suburbs?",
        a: "Yes — Newcastle city centre, Jesmond, Heaton, Fenham and the wider suburbs are all part of our regular coverage.",
      },
      {
        q: "Can you work on older Tyneside flats?",
        a: "Regularly. Tyneside flats often have their own quirks (shared flues, older pipework) — our engineers know what to look for.",
      },
    ],
  },
  {
    slug: "gateshead",
    name: "Gateshead",
    headline: "Boiler Repairs & Heating Engineers in Gateshead",
    subline:
      "Gas Safe registered engineers covering Gateshead and across the Tyne — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 11 miles south-west of Whitley Bay, just across the river from Newcastle.",
    intro: [
      "Gateshead's a mix of older terraces, postwar estates, and the newer riverside developments around the Quays — a wide enough spread of ages that we see most boiler types and eras out here, including plenty of the Tyneside flats common on this side of the river too.",
      "Whether it's an older system in a Low Fell terrace or a newer combi in a Quayside apartment, the approach is the same: diagnose it, agree the price, and get it fixed.",
    ],
    nearby: ["newcastle", "washington", "sunderland"],
    faqs: [
      {
        q: "Do you cover Gateshead town centre and the Quays?",
        a: "Yes, along with Low Fell, Dunston, Felling and the surrounding areas.",
      },
      {
        q: "How much is the call-out in Gateshead?",
        a: "The same £50 call-out as everywhere we cover — refunded straight off your bill once we fix it.",
      },
    ],
  },
  {
    slug: "gosforth",
    name: "Gosforth",
    headline: "Boiler Repairs & Heating Engineers in Gosforth",
    subline:
      "Gas Safe registered engineers covering Gosforth and North Newcastle — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 7 miles south-west of Whitley Bay — one of the closer suburbs we cover.",
    intro: [
      "Gosforth's one of the more established Newcastle suburbs — a good number of larger Victorian and Edwardian villas plus 1930s semis, many with older heating systems that have been added to and adapted over the years rather than fully replaced.",
      "We see a fair few boilers here that are getting on a bit, still going but past their best. If yours is struggling, it's usually worth a service or a straight repair-vs-replace conversation rather than waiting for it to fail outright.",
    ],
    nearby: ["newcastle", "whitley-bay", "cramlington"],
    faqs: [
      {
        q: "Do you cover High Gosforth Park and the surrounding streets?",
        a: "Yes, all of Gosforth including South Gosforth and the areas around the racecourse.",
      },
      {
        q: "My boiler's original to the house — is it worth repairing?",
        a: "Depends on the age and the fault — we'll always give you an honest answer on repair vs. replace, not just fix what's in front of us.",
      },
    ],
  },
  {
    slug: "wallsend",
    name: "Wallsend",
    headline: "Boiler Repairs & Heating Engineers in Wallsend",
    subline:
      "Gas Safe registered engineers covering Wallsend and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 4 miles south of Whitley Bay, right along the coast road — one of our closest jobs.",
    intro: [
      "Wallsend's history runs deep — from Roman Segedunum at the eastern end of Hadrian's Wall through to its shipbuilding heyday at Swan Hunter. A lot of that history is still visible in the terraced housing that makes up much of the town.",
      "Being this close to base, Wallsend is usually one of the quickest same-day slots we can offer — often the same visit as a Whitley Bay job.",
    ],
    nearby: ["whitley-bay", "newcastle", "south-shields"],
    faqs: [
      {
        q: "Do you cover all of Wallsend?",
        a: "Yes, from the town centre out to Willington Quay and Battle Hill.",
      },
      {
        q: "How quickly can you get to me in Wallsend?",
        a: "Very quickly, in most cases — Wallsend is right next to our base in Whitley Bay.",
      },
    ],
  },
  {
    slug: "south-shields",
    name: "South Shields",
    headline: "Boiler Repairs & Heating Engineers in South Shields",
    subline:
      "Gas Safe registered engineers covering South Shields and South Tyneside — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 10 miles south-east of Whitley Bay, across the mouth of the Tyne.",
    intro: [
      "South Shields sits right on the coast the same way Whitley Bay does, so the same issue applies — salt air is harder on external flues, condensate pipes and outdoor boiler fittings than it is further inland. It's one of the more common call-outs we get along this part of the coast.",
      "Housing here is a mix of Victorian terraces near Ocean Road and the town centre, with newer developments along the seafront towards Sandhaven and Littlehaven.",
    ],
    nearby: ["wallsend", "sunderland", "west-boldon"],
    faqs: [
      {
        q: "Do you cover South Shields seafront as well as the town centre?",
        a: "Yes — Ocean Road, the Leas, Harton and the wider South Shields area are all covered.",
      },
      {
        q: "Are coastal boilers more prone to problems?",
        a: "External parts (flues, condensate pipes, outdoor fittings) do wear faster near the coast — worth an eye kept on them at your annual service.",
      },
    ],
  },
  {
    slug: "cramlington",
    name: "Cramlington",
    headline: "Boiler Repairs & Heating Engineers in Cramlington",
    subline:
      "Gas Safe registered engineers covering Cramlington and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 9 miles north of Whitley Bay.",
    intro: [
      "Cramlington's a Northumberland new town, mostly built from the 1960s onwards, so the housing stock here skews a lot newer than in the older Tyneside towns — largely combi boilers rather than the older back-boiler and tank systems we see more of elsewhere.",
      "That doesn't mean nothing goes wrong — newer systems still lose pressure, need servicing, and eventually reach the end of their working life like any other. We cover all of it.",
    ],
    nearby: ["whitley-bay", "blyth", "gosforth"],
    faqs: [
      {
        q: "Do you cover all of Cramlington's districts?",
        a: "Yes, from Nelson Village and Beaconhill through to Eastfield and Southridge.",
      },
      {
        q: "Most houses here have newer combi boilers — do you still recommend annual servicing?",
        a: "Yes — a newer boiler still needs an annual service to keep its manufacturer warranty valid, whatever its age.",
      },
    ],
  },
  {
    slug: "ashington",
    name: "Ashington",
    headline: "Boiler Repairs & Heating Engineers in Ashington",
    subline:
      "Gas Safe registered engineers covering Ashington and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 14 miles north of Whitley Bay.",
    intro: [
      "Ashington grew up around the coal industry — once known as the biggest mining village in the world — and a lot of that history is still visible in the rows of colliery-era terraced housing, alongside postwar estates built as the town expanded.",
      "Older terraces here often mean older heating systems too, so it's not unusual for us to be working on a boiler that's had a long life and could do with either a proper repair or an honest conversation about replacing it.",
    ],
    nearby: ["blyth", "cramlington", "morpeth"],
    faqs: [
      {
        q: "Do you cover Ashington and the surrounding villages?",
        a: "Yes, including Hirst, Lynemouth, and the wider Wansbeck area.",
      },
      {
        q: "My boiler's original to an older terrace — can it still be repaired?",
        a: "Often, yes — we'll always try a straight repair first and only suggest replacing it if that's genuinely the better value.",
      },
    ],
  },
  {
    slug: "sunderland",
    name: "Sunderland",
    headline: "Boiler Repairs & Heating Engineers in Sunderland",
    subline:
      "Gas Safe registered engineers covering Sunderland and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 13 miles south of Whitley Bay.",
    intro: [
      "Sunderland's housing mix isn't far off Newcastle's — Victorian terraces, postwar estates, and coastal areas like Roker and Seaburn that get the same sea-air exposure Whitley Bay does, which is harder on external boiler fittings than further inland.",
      "It's a big enough area that we see the full range of systems and faults here, from routine servicing to full replacements.",
    ],
    nearby: ["south-shields", "washington", "west-boldon"],
    faqs: [
      {
        q: "Do you cover Sunderland city centre and the coastal areas?",
        a: "Yes — the city centre, Roker, Seaburn, and out towards Washington are all part of our regular coverage.",
      },
      {
        q: "Do you do landlord gas safety certificates in Sunderland?",
        a: "Yes, CP12 gas safety and EICR electrical certificates for landlords, with reminders before they expire.",
      },
    ],
  },
  {
    slug: "blyth",
    name: "Blyth",
    headline: "Boiler Repairs & Heating Engineers in Blyth",
    subline:
      "Gas Safe registered engineers covering Blyth and the Northumberland coast — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 8 miles north of Whitley Bay, up the coast.",
    intro: [
      "Blyth's history as a shipbuilding and coal-exporting port has left a mix of older terraced housing near the harbour and town centre, with newer estates further out. Like Whitley Bay, it's a coastal town, so external flues and fittings tend to need a closer eye than they would inland.",
      "We cover the full range here — routine servicing, repairs, and new installs for the newer estates as much as the older terraces.",
    ],
    nearby: ["cramlington", "ashington", "whitley-bay"],
    faqs: [
      {
        q: "Do you cover all of Blyth, including the newer estates?",
        a: "Yes — the town centre, the harbour area, and the newer developments out towards Newsham and Cowpen.",
      },
      {
        q: "Is a coastal boiler more likely to need repairs?",
        a: "External parts wear a bit faster near the coast, but a well-maintained boiler with regular servicing holds up fine.",
      },
    ],
  },
  {
    slug: "morpeth",
    name: "Morpeth",
    headline: "Boiler Repairs & Heating Engineers in Morpeth",
    subline:
      "Gas Safe registered engineers covering Morpeth and the surrounding Northumberland villages — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 16 miles north of Whitley Bay.",
    intro: [
      "Morpeth's a Northumberland market town, with more traditional stone-built and Georgian-era properties in and around the town centre than the terraced streets you'd see closer to the coast, plus newer estates on the outskirts.",
      "Older stone-built properties can bring their own quirks — trickier pipe runs, older-style radiators — so it helps to have someone who's used to working on that kind of property as well as the newer builds.",
    ],
    nearby: ["ashington", "cramlington", "blyth"],
    faqs: [
      {
        q: "Do you cover Morpeth town centre and the villages around it?",
        a: "Yes, including Pegswood, Stannington and the surrounding villages.",
      },
      {
        q: "Do older stone-built properties need anything different for a boiler service?",
        a: "Not fundamentally, but older pipework and radiators sometimes need a bit more care — worth mentioning when you book.",
      },
    ],
  },
  {
    slug: "west-boldon",
    name: "West Boldon",
    headline: "Boiler Repairs & Heating Engineers in West Boldon",
    subline:
      "Gas Safe registered engineers covering West Boldon and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 12 miles south of Whitley Bay, on the South Tyneside/Sunderland border.",
    intro: [
      "West Boldon's a smaller village, with a mix of older village housing and newer estate development built up around it — quieter than the bigger towns we cover, but no less likely to need a boiler sorted on a Sunday morning.",
      "We treat village call-outs the same as anywhere else: same £50 call-out, same price-agreed-first approach, same 30-day guarantee.",
    ],
    nearby: ["south-shields", "sunderland", "washington"],
    faqs: [
      {
        q: "Do you cover villages as small as West Boldon?",
        a: "Yes — village or city centre, the same team and the same pricing either way.",
      },
      {
        q: "How quickly can you get out to West Boldon?",
        a: "Usually the same day for genuine emergencies, same as our other coverage areas.",
      },
    ],
  },
  {
    slug: "washington",
    name: "Washington",
    headline: "Boiler Repairs & Heating Engineers in Washington",
    subline:
      "Gas Safe registered engineers covering Washington and the surrounding area — same-day response where we can, £50 call-out refunded when we fix it.",
    distance: "About 15 miles south of Whitley Bay.",
    intro: [
      "Washington's a Tyne and Wear new town, designated in 1964 and built around a series of numbered 'villages' — which means, like Cramlington, the housing stock here skews newer and combi boilers are the norm rather than the exception.",
      "Newer doesn't mean maintenance-free though — we still see plenty of pressure loss, pump faults and the odd installation that was never quite right to begin with.",
    ],
    nearby: ["sunderland", "gateshead", "west-boldon"],
    faqs: [
      {
        q: "Do you cover all of Washington's villages?",
        a: "Yes, from Washington village through the numbered districts (Sulgrave, Albany, Barmston and the rest) to Washington town centre.",
      },
      {
        q: "My combi boiler is only a few years old but keeps losing pressure — is that normal?",
        a: "Not really — persistent pressure loss on a newer boiler usually means a small leak or a fault worth finding, not just topping up indefinitely.",
      },
    ],
  },
  {
    slug: "redcar",
    name: "Redcar",
    headline: "Boiler Repairs & Heating Engineers in Redcar",
    subline:
      "Gas Safe registered engineers covering Redcar on the Teesside coast — response where we can, £50 call-out refunded when we fix it.",
    distance:
      "About 38 miles south of Whitley Bay, on the Teesside coast — the furthest edge of our coverage area.",
    intro: [
      "Redcar's the furthest out of the towns we cover, so while we still take on jobs here, it's worth knowing it's a longer drive than our North Tyneside and Wearside coverage — we'd rather be upfront about that than promise a same-day slot we can't always deliver this far out.",
      "The town's history is tied to steel and shipbuilding, and like Whitley Bay it's a genuinely coastal town, so the same salt-air wear on external flues and fittings applies here too.",
    ],
    nearby: [],
    faqs: [
      {
        q: "Do you definitely cover Redcar, given the distance?",
        a: "Yes — it's part of our coverage area, though as our furthest-out town, response times can be a bit longer than closer areas. Get in touch and we'll be straight with you about timing.",
      },
      {
        q: "Is a coastal boiler in Redcar more likely to need repairs?",
        a: "External fittings (flues, condensate pipes) do wear faster on the coast — the same as we see in Whitley Bay and South Shields.",
      },
    ],
  },
];

export function getAreaPage(slug: string): AreaPage | undefined {
  return areaPages.find((area) => area.slug === slug);
}
