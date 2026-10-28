# The lesson file

## Contents
- The fields
- Writing each part
- Rules the tests enforce
- Book-level files

## The fields

`src/lessons/000N.json`. `src/lessons/0001.json` in the template is a complete example.

| Field | Printed where | What it is |
|---|---|---|
| `n` | everywhere | The lesson number; it must match the file name |
| `title` | left page, toolbar, contents | 2–5 words |
| `runningHead` | left page, top | A short tag after "Lesson n ·" |
| `why` | text version | One or two sentences on why the reader should care |
| `idea` | left page | 1–2 short paragraphs: the one idea, in plain words |
| `principle` | left page, boxed | One line the reader could write on a card |
| `keywords` | left page, index | Ids in `src/content/glossary.json` (3–5) |
| `predict` | left page | `{ question, options: [3 strings], answer: index }` |
| `explain` | under the flap | Why the answer is right, in about 50 words |
| `watch` | Watch captions | 5 captions, one per camera shot |
| `watchShots` | nowhere | 5 notes `{ kind, show }` for whoever edits the shots |
| `figure` | right page, under the figure | "Fig. n" caption: what the drawing is |
| `tryHint` | right page | One line telling the reader what to try |
| `itemsHeading` | text version | Optional. A heading for the list of tappable things (default "In the figure") |
| `switches` | right page, as pills | Optional. `[{ id, label, options: [strings] }]`, one row each |
| `buttons` | right page, as pills | Optional. `[{ id, label, text }]`, where `text` is the text version's wording |
| `challenge` | left page, handwritten | `{ text, done }`. `done` is the stamp's words, under 22 characters |
| `margin` | right page margin, handwritten | `{ lines: ["{field}", …], fields: { field: "what it shows" } }` |
| `idealised` | text version | What the figure simplifies or leaves out, honestly |
| `readNext` | left page | A source id: the best free next read |
| `readNextLabel` | left page | Optional. Friendlier wording for it |
| `sources` | back of the book | Source ids for every claim in the lesson |

## Writing each part

- **Write for the reader in the brief.** For beginners:
  - use one new term per paragraph, at most;
  - give a picture before the formula;
  - choose everyday examples over textbook ones.
- **The idea** names the thing, says what it does, and says what decides the outcome. No history, no caveats; the caveats go in `idealised`.
- **The principle** is the sentence the reader should be able to say back.
- **The prediction:**
  - Ask about something the figure will then show.
  - The wrong options are what people really believe. Take them from the misconceptions in your sources, never from silly answers. When no source documents one, use the most tempting wrong line of reasoning a beginner would follow, and note in `DECISIONS.md` that it's yours.
  - Phrase all three options in parallel.
- **The explanation** starts with the answer, then says why, then gives the number or example that proves it.
- **The watch captions:** one sentence each, present tense, describing what is on screen at that moment. The last one hands over: "Your turn: …".
- **The challenge** is something to do in the figure, checked by the model. Prefer "find the setting where…" or "pick the card that…" over "read the margin". It must not be solved by the tour, or by simply copying the flap's answer.
- **The margin** shows the live working, the numbers behind what the figure shows, in three to six short lines:
  - each line is a `{field}` the model's `margin()` returns;
  - `margin()` returns `null` for a line that shouldn't show yet.

## Rules the tests enforce

- All fields above except the optional ones are present, and `n` matches.
- `answer` is a valid index.
- **The three options have the same number of words,** so length gives nothing away.
- With 3 or more lessons, the right answer isn't in the same position in every lesson.
- Every keyword is in the glossary, and every source id is in `sources.json`.
- `watch`, `watchShots` and the scene's `shots()` have the same length (5).
- Every `{field}` in `margin.lines` is documented in `margin.fields`, and every documented field is returned by the model's `margin()`.
- Every switch reports a value through the scene's `switchValue(id)`.
- **No text runs past a page's bottom margin,** and the explanation fits under the flap. The page renderer reports both as console errors, which fail every browser test.

## Book-level files

- **`src/content/book.json`:**
  - `title`, `overline` and `subtitle`, plus a `tagline` and an `imprint` line for the title page;
  - `description`, used for the meta description;
  - the `cover` and `ribbon` colours;
  - `lessons`, every planned title in order (the contents links only the ones registered);
  - `legend`, the colour key: `[{ note, items: [{ name, color }] }]`.
- **`src/content/glossary.json`:** `{ id: { term, definition } }`. A definition is under about 15 words, without the term itself.
- **`src/content/sources.json`:** `[{ id, title, publisher, url, accessed }]`, with `accessed` as YYYY-MM-DD.
  - Use real URLs that you opened, and prefer free and official ones.
  - The back of the book lists every source a lesson uses, numbered, and an index of key words.
- **`src/content/frontispiece.js`:** the title page's small ink drawing, on a 2D canvas. Draw the subject in a few strokes: pale fills, one or two accent colours, ink outlines and hatching on the shaded side.
