// First posts for the journal (ADR 0018). Run once against the target DB:
//   ENV_FILE=.env.prod-local node src/seeds/blogPosts.js
// Upserts by slug; re-running updates copy without duplicating.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
if (process.env.ENV_FILE) require('dotenv').config({ path: require('path').join(__dirname, '../../', process.env.ENV_FILE), override: true });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const page = require('../services/blogPage');

const POSTS = [
  {
    title: 'You saved 200 reels. You went to none of them.',
    slug: 'saved-reels-never-went',
    coverEmoji: '🎬',
    keywords: ['save instagram reels', 'organise saved reels', 'reels to places', 'what to do this weekend'],
    excerpt: 'Instagram’s Saved tab is where plans go to die. Here is why, and a two-minute habit that turns a saved reel into a Saturday.',
    body: `Open your Instagram Saved tab right now. Scroll. Somewhere in there is a rooftop cafe in Hauz Khas, a Kasol trek someone filmed in October, a 15-minute paneer recipe, and a kurta you meant to price-check. You saved every one of them with the same thought: *later.*

Later never gets a notification.

## Why the Saved tab doesn’t work

Instagram stores a thumbnail and a link. That’s it. It doesn’t know the cafe is 900 metres from your office, that the trek is best before the snow, or that the recipe needs an ingredient you don’t have. So the reel sits there, exactly as useful as the day you saved it — which is to say, not very. Three weeks later you can’t even remember why you saved it.

The problem was never *saving*. It’s that saving and *doing* are separated by everything that matters: where, when, how much, with whom.

## The two-minute habit

When you save a reel, ask one question: **what would I need to know to actually go?**

- For a place: the name, the area, roughly what it costs, and when it’s worth it.
- For a recipe: the ingredients and the steps, not the vibe.
- For a trip: how many days, the budget the creator mentioned, the stops in order.

Write that down somewhere you’ll see it again. That’s the whole habit. It feels like extra work for about a week, and then you notice you’re actually going to places.

## Or let the app read the reel for you

This is what we built Wanna Try to do. Share a reel to it and it watches the video, reads the captions and the on-screen text, and writes the answer to that question for you: the place, the price the creator said, the ingredients, the trek days. No thumbnail — just the details you needed.

Then it does the part your Saved tab never could: it brings the reel back **when you can act on it**. A free Saturday. A walk past that cafe. The month the trek is best. That’s the difference between a collection and a plan.

Two hundred reels is a lot of good ideas. Pick one for this weekend.`,
  },
  {
    title: 'Bill tension, solved: a reminder that reads the bill for you',
    slug: 'bill-reminder-that-reads-the-bill',
    coverEmoji: '🧾',
    keywords: ['bill reminder app india', 'credit card bill reminder', 'invoice reminder', 'due date reminder'],
    excerpt: 'Screenshot the bill or just say it out loud. Wanna Try pulls the amount and due date, and nudges you the morning it matters.',
    body: `The Flipkart Axis bill is ₹24,618 and due on the 3rd. You know this because you read the SMS, thought “I’ll pay it on the 2nd”, and then the 2nd happened to be a Tuesday.

Late fees are a tax on being busy.

## Reminders fail because they’re typed

Every reminder app works the same way: open it, type the title, pick a date, pick a time, save. Five taps, on a good day. Which is why the bill goes unpaid — not because you forgot the bill, but because you skipped the five taps.

The fix is not a better reminder app. It’s a reminder you don’t have to type.

## Screenshot it, or say it

In Wanna Try there are two ways in, and both take one action:

1. **Screenshot the bill** — the SMS, the email, the invoice PDF — and share it to the app. It reads the amount, the biller, and the due date off the image.
2. **Say it.** Tap the mic: “Flipkart Axis card, 24,618, pay it before the third.” It transcribes the note (Hindi, English, or both mixed), pulls out the amount and the date, and sets the reminder.

Either way you get one saved item: *Flipkart Axis Card bill — ₹24,618 — due 3 Sept*, with the reminder already on it. The morning it’s due, your phone says so. Not at midnight; the morning.

## What “tension-free” actually means

- **One place for every bill** — card, electricity, the tailor’s invoice, the money you owe Avi. Ask “what do I need to pay this week?” and it answers from your own notes.
- **The reminder is on the item**, so when it fires you see the amount and the biller, not just a title.
- **Nothing to type.** If you can take a screenshot or say a sentence, you’re done.

Bills are boring. The reminder should be too — boring enough that it just works, every month, without you thinking about it.`,
  },
  {
    title: 'The smart nudge: a reminder that knows where you are',
    slug: 'smart-nudges-location-aware-reminders',
    coverEmoji: '📍',
    keywords: ['smart nudges', 'location based reminders', 'reminder near me', 'resurface saved places'],
    excerpt: 'Time-based reminders interrupt. A nudge that fires when you’re 400 metres from the cafe you saved is a different thing entirely.',
    body: `Every reminder you’ve ever set was about *time*. 9 am. Thursday. In two weeks. Time is easy for software and useless for most of the things we save — because the right moment to try a cafe isn’t a date, it’s **being near it with nothing to do**.

## The reminder that interrupts vs. the nudge that helps

A time reminder for “try Blue Tokai” fires on Thursday at 9 am, while you’re in a meeting in Noida. You dismiss it. It has now made the cafe slightly *less* likely to happen, because you associated it with an interruption.

A nudge fires when you’re walking past Hauz Khas on a Saturday afternoon: *“You’re 400 m from Blue Tokai. Saved 12 days ago — quiet upstairs room, plugs at every table.”* Same cafe, opposite effect. You go.

## What makes a nudge smart

We use three signals, and never more than one nudge a day:

- **Where you are.** A saved place within walking distance, when your location says you’re out, not at home.
- **When you’re free.** Friday evening for weekend plans; the morning of a day you planned something.
- **When it’s worth it.** The month a trek is best. A price that dropped on something you saved. A restaurant that other people on Wanna Try keep saving this week.

The reason this works is that a nudge is *specific*. It doesn’t say “you have 24 saved items.” It says one thing, with the one detail that helps you decide, and a way to act on it right there.

## You’re in control of it

Turn nudges on from **Me → Nudge me**. Tell it whether you’re a morning or an evening person and it picks the run that suits you. Turn on location and “near you” lights up on Explore too — everything you saved, and the places other people saved, sorted by how far you are.

Reminders you set are a chore. Nudges you get are a favour. We’re trying to build the second one.`,
  },
  {
    title: 'A budget trip plan from three reels: Kasol, Kheerganga, Manikaran',
    slug: 'budget-trip-plan-from-reels-kasol-kheerganga',
    coverEmoji: '🏔️',
    keywords: ['budget trip planner', 'kasol kheerganga trip plan', 'itinerary from instagram reels', 'trip planning app india'],
    excerpt: 'Three saved reels became a four-day plan with stays, buses and a budget — without opening a single travel site. Here’s the plan, and how it was made.',
    body: `Three reels: a Kasol cafe with a river view, a Kheerganga trek shot in golden light, and Manikaran’s hot springs. That was the entire “plan” for two months. Then a long weekend appeared and the plan had to become real.

## The four days

**Day 1 — Delhi → Kasol.** Overnight Volvo from Majnu ka Tila, about ₹1,200. Arrive by 10, check in, do nothing. Kasol is for the evening: the riverside cafes the reel showed, dinner around ₹400.

**Day 2 — Barshaini → Kheerganga.** Local bus or shared cab to Barshaini (₹50–₹300). Start the trek by 11; it’s 12 km and most people reach the top around 7. Stay in a camp at Kheerganga — ₹500–₹800 with dinner. Bring a jacket even in summer.

**Day 3 — Down, then Manikaran.** Leave camp at 8, back in Barshaini by 11. Bus to Manikaran, an hour or two for the gurudwara and the hot springs, then back to Kasol for the night.

**Day 4 — Kasol → Delhi.** Slow morning, evening bus back.

**Budget for one person:** roughly ₹5,500–₹7,000 including buses, two nights in Kasol, one in a camp, and food. Best months: March–June and September–November.

## How the plan was made

Nothing above came from a travel site. It came from the reels — the creator said *“Barshaini se 11 baje nikle, 7 baje pahunche”* and the app kept it. Here’s the process in Wanna Try:

1. **Share the reels** to the app. It transcribes what the creator says (Hindi included), reads the on-screen text, and pulls out the stops, the timings and any prices mentioned.
2. **Open the trip.** The three reels merge into one trip with the stops in order, a day count, and the budget the creators quoted.
3. **Tap “Plan this trip”.** It puts the stops into days, adds stays for each night and how to get between them, and keeps the whole thing under the budget you set. Say you’re going with friends and it plans for a group; say “keep it cheap” and it does.
4. **Share the plan.** One link, with the days, the stays and the getting-there, so the group stops asking “so what’s the plan?”

The plan took about a minute. The reels had been waiting two months.`,
  },
  {
    title: 'What to do this weekend in Delhi NCR? Let your saves decide.',
    slug: 'what-to-do-this-weekend-delhi-ncr',
    coverEmoji: '🗓️',
    keywords: ['what to do this weekend delhi', 'things to do in gurgaon', 'weekend plans delhi ncr', 'cafes to try near me'],
    excerpt: 'You don’t need another listicle. You need the four things you already saved, sorted by how far they are and whether you’re free.',
    body: `Every Friday the same search: *things to do in Delhi this weekend*. Every Friday the same listicle — Dilli Haat, Lodhi Garden, a “hidden” cafe that’s been on the list since 2019. You skim it, save nothing, and end up at the same place as last week.

The better list already exists. It’s the one you made, one reel at a time.

## Use what you already saved

Open your saves and filter by **This weekend**. Everything you marked *Planning* is there. Now the useful questions:

- **What’s close?** Explore → Near you sorts your saves and other people’s by distance. Two things within 3 km is a plan; one thing across the city is a maybe.
- **What fits the day?** A cafe with a quiet upstairs room is a Sunday afternoon. A market with ₹30 entry and momos is a Saturday morning. The details you saved decide this for you.
- **Who’s coming?** Tell the app you usually go with friends or your partner and the nudges and picks lean that way.

## Ask it, in plain words

The fastest way is to just ask. *“Somewhere for a lazy Sunday in Gurgaon?”* — and Ask answers from your own saves: the two cafes you kept, the one you already tried and rated, and the one you haven’t. It won’t suggest a place you never saved, which is the point: you already did the finding. It just does the remembering.

## A Delhi NCR weekend from real saves

Here’s what that looked like last week, from a list of 24 saves:

- **Saturday morning** — Pizzeria Da Susy in Gurgaon, saved from a food vlog, never tried. 15 minutes away.
- **Saturday evening** — Gilded Yard, tried before and rated 4/5, good enough to go back with people.
- **Sunday** — nothing planned on purpose. The app nudged “you planned Homemade Pizza for Sept 5” instead. Fine. Cook.

No listicle. Three saves, sorted by distance, one of them cooked at home. Save what you find, mark the ones you mean, and let the weekend fill itself in.`,
  },
];

module.exports = { POSTS };
if (require.main !== module) return;

(async () => {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  // Atlas URIs carry no db name; without dbName this would seed the default `test` db.
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});
  for (const p of POSTS) {
    const doc = { ...p, html: page.render(p.body), readingMinutes: page.readingMinutes(p.body), status: 'published', authorName: 'Wanna Try' };
    const existing = await Post.findOne({ slug: p.slug });
    if (existing) { Object.assign(existing, doc); await existing.save(); console.log('updated ', p.slug); }
    else { await Post.create({ ...doc, publishedAt: new Date() }); console.log('created ', p.slug); }
  }
  await mongoose.disconnect();
  console.log(`\n${POSTS.length} posts live at ${require('../utils/publicUrl').publicBaseUrl()}/blog`);
})().catch((e) => { console.error(e.message); process.exit(1); });
