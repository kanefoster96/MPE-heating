// Blog content — plain typed data rather than MDX, consistent with how
// the rest of the site's copy lives in content.ts. Each post's `content`
// is a small set of block types (see richContent.ts) rendered by
// RichContent.tsx.

import type { ContentBlock } from "./richContent";

export type BlogPost = {
  slug: string;
  title: string;
  // Shown on the index card and used as the meta description.
  description: string;
  category: "Common Issues" | "Servicing & Maintenance" | "New Boilers";
  readTime: string;
  publishedAt: string; // ISO date
  relatedService: { label: string; href: string };
  content: ContentBlock[];
};

const GAS_SAFETY_CALLOUT: ContentBlock = {
  type: "callout",
  text: "Never attempt gas work yourself — it's illegal as well as dangerous. If you ever smell gas, don't touch switches or naked flames: turn off the gas at the meter if it's safe to do so, open windows, leave the property, and call the National Gas Emergency Service on 0800 111 999.",
};

export const blogPosts: BlogPost[] = [
  {
    slug: "why-is-my-boiler-losing-pressure",
    title: "Why is my boiler losing pressure?",
    description:
      "The common causes of a boiler losing pressure, how to check and top it up safely, and when a drop in pressure means it's time to call an engineer.",
    category: "Common Issues",
    readTime: "4 min read",
    publishedAt: "2026-08-28",
    relatedService: { label: "Book a boiler repair", href: "/boiler-repair" },
    content: [
      {
        type: "p",
        text: "Most modern boilers are sealed systems that need to hold a set water pressure — usually between 1 and 1.5 bar when cold — to work properly. If the gauge keeps dropping below that, something is letting water (or occasionally air) out of the system faster than it should.",
      },
      { type: "h2", text: "The usual causes" },
      {
        type: "list",
        items: [
          "A small leak somewhere in the system — often at a radiator valve, pipe joint, or the boiler itself. Even a slow drip that never puddles can drain pressure over weeks.",
          "Bleeding a radiator without topping the pressure back up afterwards.",
          "A faulty pressure relief valve letting water escape, sometimes visible as a drip from an external overflow pipe outside the property.",
          "An issue with the filling loop or expansion vessel not holding pressure correctly.",
        ],
      },
      { type: "h2", text: "What you can safely check yourself" },
      {
        type: "p",
        text: "Look at the pressure gauge on the front of the boiler. If it's below 1 bar, you can usually top it up yourself using the filling loop (the braided flexible pipe under most boilers) — your boiler's manual will show exactly how, and it only takes a minute. If the pressure keeps dropping again within a few days, topping it up is a temporary fix, not a repair — there's a leak or fault somewhere that needs finding.",
      },
      { type: "h2", text: "When to call an engineer" },
      {
        type: "p",
        text: "If you can't find an obvious leak, if the pressure drops repeatedly after refilling, or if you're not comfortable using the filling loop, it's time to get a Gas Safe engineer to look at it. Persistently losing pressure is also often the first sign of a bigger issue, so it's worth getting checked before it leads to a full breakdown.",
      },
      GAS_SAFETY_CALLOUT,
    ],
  },
  {
    slug: "boiler-making-strange-noises",
    title: "Boiler making a banging, gurgling or whistling noise? Here's why",
    description:
      "What kettling, gurgling and whistling boiler noises usually mean, and which ones you can leave until your next service versus which need an engineer now.",
    category: "Common Issues",
    readTime: "4 min read",
    publishedAt: "2026-08-28",
    relatedService: { label: "Book a boiler repair", href: "/boiler-repair" },
    content: [
      {
        type: "p",
        text: "A boiler that's working properly should be close to silent, so any new noise is worth paying attention to. The good news is the noise itself is usually a decent clue as to what's wrong.",
      },
      { type: "h2", text: "Banging or 'kettling'" },
      {
        type: "p",
        text: "A rumbling or banging sound, a bit like a kettle boiling, is usually caused by limescale or sludge building up on the heat exchanger. It restricts water flow and creates hot spots, which is what causes the noise — and over time it makes the boiler work harder and less efficiently. A power flush usually clears it.",
      },
      { type: "h2", text: "Gurgling" },
      {
        type: "p",
        text: "Often just trapped air in the system, especially after radiators have been bled or worked on. Bleeding the radiators usually sorts it. If it keeps coming back, there may be a bigger air pocket or a fault letting air into the system.",
      },
      { type: "h2", text: "Whistling" },
      {
        type: "p",
        text: "Can point to low water pressure, trapped air, or a partially closed valve restricting flow somewhere in the system. Worth checking the pressure gauge first (see our guide on boiler pressure) before booking an engineer.",
      },
      { type: "h2", text: "Buzzing or humming" },
      {
        type: "p",
        text: "Often the pump. A failing pump can usually be heard as a persistent hum or buzz, sometimes with vibration you can feel through the pipework.",
      },
      {
        type: "p",
        text: "None of these noises are things to ignore — left alone, most of them lead to reduced efficiency and, eventually, a breakdown. If a noise is new, gets louder, or is joined by a drop in heating performance, it's worth booking someone out.",
      },
      GAS_SAFETY_CALLOUT,
    ],
  },
  {
    slug: "boiler-wont-turn-on",
    title: "My boiler won't turn on — what should I check before calling someone?",
    description:
      "A few safe, simple checks to run through if your boiler won't fire up, before you need to book a Gas Safe engineer.",
    category: "Common Issues",
    readTime: "3 min read",
    publishedAt: "2026-08-28",
    relatedService: { label: "Request an emergency callout", href: "/contact" },
    content: [
      {
        type: "p",
        text: "Before assuming the worst, there are a handful of quick, safe checks that solve a surprising number of 'dead boiler' calls.",
      },
      { type: "h2", text: "1. Check the thermostat and timer" },
      {
        type: "p",
        text: "Make sure the thermostat is set above room temperature and the timer has the heating scheduled on. It sounds obvious, but a knocked thermostat or a timer that's fallen out of sync (after a power cut, for example) is one of the most common causes.",
      },
      { type: "h2", text: "2. Check the boiler pressure" },
      {
        type: "p",
        text: "Most boilers won't fire if the pressure has dropped too low. See our guide on losing pressure — if it's below 1 bar, topping it up via the filling loop may solve it immediately.",
      },
      { type: "h2", text: "3. Check for a lockout or fault code" },
      {
        type: "p",
        text: "Most modern boilers display a fault code on the front panel when something's wrong. Many can be reset with the reset button — check your manual first, and only try this once. If it locks out again straight away, don't keep resetting it; that just masks whatever's actually wrong.",
      },
      { type: "h2", text: "4. Check the power and gas supply" },
      {
        type: "p",
        text: "Check the boiler's fused spur or plug hasn't tripped, and that other gas appliances in the house are working. If nothing gas-related is working anywhere in the property, it may be a supply issue rather than the boiler itself.",
      },
      { type: "h2", text: "Still nothing?" },
      {
        type: "p",
        text: "If you've checked all of the above and it's still not firing up, it's time to call a Gas Safe engineer rather than keep investigating — especially if there's any smell of gas.",
      },
      GAS_SAFETY_CALLOUT,
    ],
  },
  {
    slug: "why-annual-boiler-servicing-matters",
    title: "Why annual boiler servicing actually matters",
    description:
      "What an annual boiler service checks for, why manufacturers require it for your warranty, and what tends to happen to boilers that never get serviced.",
    category: "Servicing & Maintenance",
    readTime: "3 min read",
    publishedAt: "2026-08-28",
    relatedService: { label: "Book a service", href: "/servicing" },
    content: [
      {
        type: "p",
        text: "It's an easy thing to put off — the boiler's working, so why pay for someone to look at it? But an annual service catches the small, cheap-to-fix issues before they turn into the expensive, no-heat-in-January kind.",
      },
      { type: "h2", text: "It keeps your warranty valid" },
      {
        type: "p",
        text: "Almost every boiler manufacturer requires proof of an annual service to keep the warranty valid — usually years of cover that's void the moment a service is missed. If a major part fails outside that window without a service history, you're paying full price for a fix that would have been covered.",
      },
      { type: "h2", text: "It's a genuine safety check" },
      {
        type: "p",
        text: "A service includes a flue gas analysis and a check of the boiler's safety devices — the parts of the check that catch a carbon monoxide risk before it becomes dangerous. This isn't a box-ticking exercise; it's the one part of the service that exists purely to keep the people in the house safe.",
      },
      { type: "h2", text: "It catches small problems early" },
      {
        type: "p",
        text: "A worn part spotted during a service costs a fraction of what the same part costs to replace in an emergency callout once it's actually failed — and you're not without heating while it's sorted.",
      },
      { type: "h2", text: "What happens if you skip it" },
      {
        type: "p",
        text: "Nothing, usually — for a year or two. Then small inefficiencies compound: the boiler works harder to do the same job, wears out faster, and when something does go wrong there's no warranty left to fall back on.",
      },
      {
        type: "p",
        text: "It takes about 45 minutes and, done every year, is the single cheapest thing you can do to avoid a much bigger bill later.",
      },
    ],
  },
  {
    slug: "signs-you-need-a-new-boiler",
    title: "Signs it might be time for a new boiler",
    description:
      "The signs — age, repair frequency, rising bills, and more — that suggest repairing your boiler again isn't the best value for money anymore.",
    category: "New Boilers",
    readTime: "3 min read",
    publishedAt: "2026-08-28",
    relatedService: { label: "Get a new boiler quote", href: "/new-boilers" },
    content: [
      {
        type: "p",
        text: "Boilers rarely fail all at once — it's usually a gradual build-up of small signs. Here's what's worth paying attention to.",
      },
      { type: "h2", text: "It's over 10-15 years old" },
      {
        type: "p",
        text: "Most boilers are designed to last around 10-15 years. Past that point, efficiency drops and parts get harder to source — modern boilers are also significantly more efficient, so a new one often pays some of itself back in lower bills.",
      },
      { type: "h2", text: "You're calling someone out more than once a year" },
      {
        type: "p",
        text: "One repair is normal wear and tear. Two or three in a year, especially if they're different faults each time, is usually a sign the boiler is on its way out rather than genuinely unlucky.",
      },
      { type: "h2", text: "Your energy bills have crept up" },
      {
        type: "p",
        text: "If your usage hasn't changed but your bills have, an ageing, less efficient boiler is often part of the reason — it's working harder to produce the same heat.",
      },
      { type: "h2", text: "It's no longer covered by a warranty" },
      {
        type: "p",
        text: "Once the manufacturer's warranty has run out, every repair is coming out of your pocket in full. At some point the maths shifts from 'repair it again' to 'this money's better spent on a new one'.",
      },
      { type: "h2", text: "Replacement parts are getting hard to find" },
      {
        type: "p",
        text: "Manufacturers stop making parts for older models eventually. If an engineer starts mentioning a part is discontinued or has to be sourced specially, that's usually a sign the model's reaching end of life.",
      },
      {
        type: "p",
        text: "If a couple of these sound familiar, it's worth getting a free quote before the next breakdown forces the decision at the worst possible time.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
