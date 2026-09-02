// Ten more journal posts (batch 2). Same shape as blogPosts.js; published
// through the admin, or: ENV_FILE=.env.prod-local node src/seeds/blogPosts.js
const POSTS = [
  {
    title: 'How to organise your Instagram saved reels (without a spreadsheet)',
    slug: 'organise-instagram-saved-reels',
    coverEmoji: '🗂️',
    keywords: ['organise instagram saved reels', 'instagram saved folders', 'save reels app', 'bookmark manager for reels'],
    excerpt: 'Folders on Instagram hide the one thing that matters: what the reel actually said. Here is a way to organise saves by what you will do with them.',
    body: `Instagram lets you sort saved reels into collections. Most people make three — *Food*, *Travel*, *Later* — and then stop opening them, because a folder of thumbnails tells you nothing about which cafe was the quiet one or which trek the creator said to do before October.

## Organise by intent, not by topic

A topic folder answers "what is this?". An intent answers "what will I do with it?". Three statuses are enough:

- **Want to try** — the default. Everything lands here.
- **Planning** — you have a date in mind. This is the only list worth checking on a Friday.
- **Tried** — done, with a one-line verdict so future you remembers.

That single change turns a pile into a queue.

## Keep the details, not the thumbnail

The reel's value is in what was said: the dish to order, the price the creator paid, the area, the timing. When you save, write those four things down. If you can't be bothered (fair), let software do it: Wanna Try reads the reel — audio, captions, on-screen text — and keeps exactly those details as key points under the title, with no thumbnail in the way.

## Let location do the sorting

The best organiser is a map you never have to open. Anything with a place gets a pin; when you are near it, it comes back. Your saves stay in one list, but the right ones surface at the right time. That is the whole trick: not more folders, better timing.

Start with the ten reels you saved most recently. Mark two as Planning for this weekend. See what happens.`,
  },
  {
    title: 'Best cafes in Gurgaon — the ones your reels already told you about',
    slug: 'best-cafes-gurgaon-from-reels',
    coverEmoji: '☕',
    keywords: ['best cafes in gurgaon', 'work friendly cafes gurgaon', 'cafes gurugram sector 29', 'quiet cafes gurgaon'],
    excerpt: 'You have saved a dozen Gurgaon cafe reels. Here is how to turn them into an actual Sunday, and what to look for in each one.',
    body: `Every Gurgaon cafe reel promises "the most aesthetic spot in Gurugram". Aesthetic is not a reason to go. These are:

- **Plugs and quiet** if you are working. Reels rarely say this; comments often do. Save the reel *and* the comment.
- **What to order.** The one dish the creator actually ate, not the menu.
- **Price for two.** Most creators say it in passing — "₹800 for two, not bad".
- **When it is empty.** Weekday afternoons in Sector 29 are a different place from Saturday nights.

## A way to shortlist

Open your saved cafes and filter *Near you*. Two within 3 km is a plan; one across the city is a maybe. Then ask, in plain words: *"Somewhere quiet for a lazy Sunday in Gurgaon?"* — and let your own saves answer, sorted by what you said you like (budget, with friends or solo).

## What we do with a cafe reel

When you share a cafe reel to Wanna Try it pulls the area, the price the creator mentioned, the dish, and the vibe words from the caption and audio. It then joins a shared index of places, so when other people save the same cafe you see "saved by 12 people" — a better signal than a like count.

Gurgaon has more good cafes than you have free weekends. The point is not the list; it is picking one and going.`,
  },
  {
    title: 'Weekend getaways from Delhi under ₹5,000 — planned from reels',
    slug: 'weekend-getaways-from-delhi-under-5000',
    coverEmoji: '🚌',
    keywords: ['weekend getaways from delhi', 'budget weekend trip from delhi', 'trips near delhi under 5000', 'kasol from delhi budget'],
    excerpt: 'Kasol, Jibhi, Rishikesh, Lansdowne — the reels are all saved. Here is the budget shape of each, and how to turn three reels into a plan.',
    body: `The reels make it look effortless: a Volvo at night, a riverside cafe by morning. The budget is the part they skip. Roughly, for one person on a two-night weekend:

- **Rishikesh** — bus ₹500–₹700 each way, hostel ₹500/night, rafting ₹600–₹1,200. Under ₹4,000 is easy.
- **Kasol / Kheerganga** — Volvo ₹1,200 each way, Kasol stay ₹600–₹900, camp at the top ₹500–₹800 with dinner. Around ₹5,500–₹7,000 for four days.
- **Jibhi** — bus to Aut ₹1,000, shared cab up ₹200, homestay ₹800–₹1,200. About ₹5,000 for two nights.
- **Lansdowne** — closest, quietest; bus ₹400, stay ₹1,000–₹2,000. Under ₹4,000.

## From three reels to a plan

Save the reels. Wanna Try merges them into one trip: the stops in order, the day count, the budget the creators quoted, the best months. Tap *Plan this trip* and it puts the stops into days, adds stays and buses, and stays under your budget. Share one link to the group so the "so what's the plan?" thread ends.

## The one rule

Book the bus first. Everything else on these trips is walk-in; the Friday-night Volvo is not.`,
  },
  {
    title: 'Voice notes as reminders: "yaad dilana" that actually works',
    slug: 'voice-note-reminders-hindi-english',
    coverEmoji: '🎙️',
    keywords: ['voice note reminder app', 'hindi voice reminder', 'speech to reminder', 'remind me app india'],
    excerpt: 'Say it once — in Hindi, English, or both — and get a structured note with the date, the amount and the people in it. No typing, no forms.',
    body: `"Goa airport pe Rahul mila, six months mein follow up karna hai." That is a complete reminder: a person, a place, a time. Typing it into a reminder app takes five taps and you never do it. Saying it takes four seconds.

## What a voice note should become

Not a transcript. A note with the parts pulled out:

- **Who** — Rahul.
- **Where** — Goa airport.
- **When** — six months from today, resolved to an actual date.
- **What** — follow up.

If the note is a bill — "Flipkart Axis card, 24,618, pay before the third" — the amount and the due date become the reminder. If it is a trip plan spoken as one long breath, it becomes an itinerary with the legs in order.

## Hindi, English, Hinglish

Most of us speak all three in one sentence. The transcription has to handle that without turning "Manikaran" into something else. Wanna Try uses speech models built for Indian languages first and falls back to a general one; the original wording is kept so you can check it.

## When it comes back

The morning of the day, not at midnight. And if you said "when I'm near Hauz Khas", then when you are near Hauz Khas. A reminder you did not have to type is one you will actually set.`,
  },
  {
    title: 'The recipe reel problem: ingredients you never wrote down',
    slug: 'save-recipe-from-instagram-reel',
    coverEmoji: '🍳',
    keywords: ['save recipe from instagram reel', 'recipe organiser app', 'extract recipe from video', 'instagram recipes india'],
    excerpt: 'A 30-second recipe reel has ten ingredients and six steps in it. By the time you are in the kitchen you remember "paneer" and "something with curd".',
    body: `Recipe reels are the most saved and the least cooked. The reason is simple: the recipe is *in* the video, and a video is a terrible place to store a list.

## What you actually need on the counter

- The ingredient list, with quantities where the creator said them.
- The steps, numbered.
- Time and serves.
- The one trick — "add the curd off the heat" — that the reel said in passing.

## What we do with a recipe reel

Share it to Wanna Try and it listens to the audio, reads the on-screen text (most recipe reels put quantities on screen), and writes the recipe out: ingredients, numbered steps, time, servings, cuisine. Hindi recipes are transcribed and translated, with the original kept.

In the kitchen, open the save — it is text, so it stays readable with wet hands — and tap *Cook this* to add your own note for next time ("less chilli", "double the tadka").

## Two habits that help

1. Tag the ones you will make on a weeknight as **quick**. When you ask "what can I cook in 20 minutes?", the answer comes from your own saves.
2. When you cook it, mark it **Tried** with a rating. A year later you will have a personal cookbook of things that worked.

Two hundred saved recipes and nothing for dinner is a solvable problem.`,
  },
  {
    title: 'Screenshot the menu, the bill, the list a friend sent: what the app reads',
    slug: 'screenshots-to-saves-menus-bills-lists',
    coverEmoji: '📸',
    keywords: ['screenshot to text app', 'save screenshots organise', 'read bill from screenshot', 'menu screenshot reminder'],
    excerpt: 'Half of what we want to remember arrives as a screenshot. Here is what happens when the app reads them instead of you.',
    body: `A WhatsApp message with five cafes. A menu photographed at the table. An SMS with a credit card bill. A "places to visit in Jaipur" list from a blog. All screenshots, all in the camera roll, all forgotten by Thursday.

## Reading a screenshot properly

The trick is not OCR — it is knowing what kind of screenshot it is:

- **A list of places** → every place becomes its own save, with the area if it was written.
- **A menu** → the dishes and prices, so you can decide before you go.
- **A bill or invoice** → the amount, the biller, the due date, and a reminder set for that morning.
- **A chat** → the plan inside it: who, where, when.
- **Notes or a receipt** → the key lines, kept as text you can search.

Upload a batch and Wanna Try groups them, reads each one, and gives you a summary across all of them ("three cafes in Hauz Khas, two under ₹500 for two").

## The bill case deserves its own line

The whole "tension" of bills is that they arrive as text you do not act on. A screenshot with a due date should *become* the reminder, with the amount on it. That is exactly what the bills & screenshots option does — and you can say the bill out loud instead if that is faster.

Stop scrolling the camera roll for that list. Read it once, properly, and let it come back when it matters.`,
  },
  {
    title: 'Price drop alerts for things you saved from reels',
    slug: 'price-drop-alerts-for-saved-products',
    coverEmoji: '🏷️',
    keywords: ['price drop alert india', 'track price of product from reel', 'shopping reels save', 'price tracker app india'],
    excerpt: 'You saved the kurta at ₹1,800. It is ₹1,600 now. You would never have known.',
    body: `Shopping reels are a trap in one specific way: the product looks great, the link is in the bio, and the price is whatever it was that day. You save it, forget it, and a month later buy something worse at full price.

## What a saved product should carry

- The name and brand, as the creator said it.
- The price at the time you saved it.
- The buy link — *only if it can be verified against the original*. Fake links in captions are common; we strip anything we cannot confirm and tell you we did.
- The variants mentioned (sizes, colours) so you know what to look for.

## Then the part you cannot do by hand

With the price stored, a drop is a comparison. When it moves, you get one line: *"Chikankari kurta dropped to ₹1,600 — ₹200 less than when you saved it."* Not a daily digest, not a coupon feed. One line, when it matters, with the old price next to the new one.

## A note on trust

We do not take money to move a product up your list. Recommendations in Discover come from what people actually saved, and price alerts come from prices, not promotions. If that ever changes, it will say so on the row.

Save the reel. Let the price do the waiting.`,
  },
  {
    title: 'A Goa trip from reels: 7 days on ₹15,000, and how the plan got made',
    slug: 'goa-7-days-15000-budget-plan-from-reels',
    coverEmoji: '🏖️',
    keywords: ['goa budget itinerary 7 days', 'goa trip plan from reels', 'goa under 15000', 'north goa south goa plan'],
    excerpt: 'One reel promised "7 days in Goa on ₹15k". Here is what that looks like day by day when the plan is built from the reels themselves.',
    body: `The ₹15k number is real if you sleep in hostels, eat thali, and take the bus. Here is the shape of it, built from three saved reels and one afternoon of not opening a single travel site.

## The week

- **Day 1–2, Panjim.** Fontainhas walk before 11 for the light (free). Fish thali at a Ritz Classic-type place, ₹250, queue after 1:30 so go early. Miramar sunset by bus 4, ₹15.
- **Day 3–4, South.** Palolem, quiet before noon; a hut at ₹800–₹1,200. Kayak at sunset, ₹500.
- **Day 5–6, North.** Anjuna market on the day it runs, Vagator cliffs, one night out budgeted at ₹1,500.
- **Day 7.** Slow morning, airport or the train.

Rough total for one person: stays ₹5,500, food ₹4,000, buses and scooter ₹2,500, activities ₹2,000. Under ₹15,000 with a little left for the night out.

## How the plan was made

The three reels were shared to Wanna Try. Each one was read — the creator's voice, the captions, the on-screen text — so the stops, the tips ("go before 11", "queue after 1:30") and the prices were already there. They merged into one trip. *Plan this trip* put the stops into days, kept it under ₹15k, and added stays for each night and how to get between beaches. One link went to the group.

Nobody looked up "things to do in Goa". They had already saved the answer.`,
  },
  {
    title: 'Why Wanna Try does not show thumbnails',
    slug: 'why-no-thumbnails',
    coverEmoji: '📝',
    keywords: ['text first app design', 'save reels without thumbnails', 'minimal bookmarking app', 'wanna try app'],
    excerpt: 'Every save app is a grid of pictures. Ours is a list of words. Here is why that is a feature, not a limitation.',
    body: `Open any bookmarking app and you get a wall of thumbnails. It looks rich. It is useless: a picture of a cafe does not tell you the area, the price, or whether it is quiet. You end up re-watching the reel to find out — which is the problem you were trying to solve.

## What a save should look like

A title you would say out loud. Under it, the three things you need to decide: where, what it costs, why you saved it. Then the details in full — key points, the recipe, the plan — as text you can search, share, and read with one thumb.

That is the entire design. A category tile instead of a picture, so the list scans fast. Serif titles, because they are meant to be read. No infinite feed, because the app should be closed most of the time.

## What it makes possible

- **Search that works.** You can search "plugs" and find the cafe, because the reel's words were kept.
- **Ask.** "Which recipe under 30 minutes?" is answerable only if the recipes are text.
- **Speed.** A list of 200 saves opens instantly. A grid of 200 thumbnails does not.
- **Sharing that means something.** The shared page carries the ingredients and the plan, not a cover image.

We keep the reel's link, so the original is one tap away. We just do not put it between you and the details.`,
  },
  {
    title: 'How the nudges decide when to remind you (and when to stay quiet)',
    slug: 'how-nudges-decide-when-to-remind-you',
    coverEmoji: '🔔',
    keywords: ['smart reminders', 'notification timing', 'reminder app that is not annoying', 'location based reminder india'],
    excerpt: 'One a day at most, and only when there is something you can act on. The rules behind a nudge, in plain words.',
    body: `Most apps notify you to remind you the app exists. We would rather you forget it exists until a nudge is worth your attention. These are the rules.

## When a nudge fires

- **You planned something for today.** "Today: Blue Tokai — you planned this for today. Still on?" That morning, at the time you prefer (morning people get the 9 am run, evening people the 8 pm one).
- **You asked to be reminded.** A voice note that said "six months", a bill with a due date, a reminder you set on an item.
- **You are near something you saved.** Within walking distance, while you are out, not while you are at home.
- **It is the weekend and three of your saves fit.** Friday evening, once.
- **A price dropped** on something you saved, with the old and new price.
- **Something you saved months ago is still waiting.** "Saved 3 months ago. Still want to try it?"

## When it stays quiet

- Never more than one a day.
- Never for something you have marked Tried or dismissed.
- Never a digest, never "you have 24 unread saves".
- Never at night.

## Where the control is

**Me → Nudge me** turns them on, and morning or evening picks the run. Turn on location and the nearby nudge lights up; leave it off and everything else still works.

A reminder is a favour only if it arrives at the moment you can use it. That is the bar.`,
  },
];

module.exports = { POSTS };
