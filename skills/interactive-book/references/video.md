# Video for X

## Contents
- What to show
- Recording
- Cutting and joining
- The post

## What to show

- **3–4 lessons whose figures move the most:** things flying into place, pins or weights sliding, a plank tipping. Pages of text don't carry a feed.
- **Open on a page turn into the first lesson,** so the viewer sees a book in the first second.
- **Keep 2–3 captions of each lesson's tour,** 8–10 s per lesson. A full tour runs about 19 s, which is too long for a feed. Keep the wide shot and the caption where the figure changes most; cut on the frame numbers in `captions.txt`.
- **End on the title and contents spread** for 2–3 s, so the last frame says what the book is.
- **Length:** 30–50 s. X accepts up to 2 min 20 s without a subscription, but a shorter clip gets watched to the end.
- **The picture carries it:** feeds autoplay muted, and the enlarged captions say what is happening. The recordings have no sound.

## Recording

Run the dev server, or point at the deployed site, then record one segment per lesson:

```sh
npm run record -- http://127.0.0.1:5199/ clips/l2 --from 2 --to 3 --seconds 25
npm run record -- http://127.0.0.1:5199/ clips/l5 --from 5 --to 6 --seconds 25
npm run record -- http://127.0.0.1:5199/ clips/c1 --from 1 --to 1 --seconds 3
```

- **`--from` and `--to`** are spreads. The recording turns from one to the other, and the lesson's tour plays on arrival, because each run is a fresh first-time reader. `--from 1 --to 1` holds the title spread.
- **The picture:** 1280×720 at scale 1.5 gives 1920×1080, at 30 fps. The frames are exact, because each one advances a paused clock by 1/30 s, however slow the render. The toolbar is hidden and the captions are enlarged.
- **Speed:** about 2–3 s of render per second of video on a Mac GPU, and much slower with software WebGL.
- **Output:** each run writes `00000.jpg…` and `captions.txt`, which lists the frame where each caption starts. `--mp4 out.mp4` also encodes that one segment.

## Cutting and joining

Cut each segment on caption starts from its `captions.txt`. For example, keep frames 24–319 of `l2`:

```sh
ffmpeg -framerate 30 -start_number 24 -i clips/l2/%05d.jpg -frames:v 296 -c:v libx264 -pix_fmt yuv420p -crf 18 clips/l2.mp4
```

Then join the pieces:

```sh
printf "file 'l2.mp4'\nfile 'l5.mp4'\nfile 'c1.mp4'\n" > clips/list.txt
ffmpeg -f concat -safe 0 -i clips/list.txt -c copy -movflags +faststart clips/book.mp4
```

Look at the cut before posting. Use a contact sheet of one frame every 2 s (`ffmpeg -i clips/book.mp4 -vf fps=0.5,scale=480:-1,tile=4x3 clips/sheet.jpg`), and check:
- no frame catches the camera mid-flight on an empty desk;
- every caption is on screen long enough to read, about 2 s.

## The post

- **One post, with the video uploaded natively** (not a link to it) and the link to the book in the text.
- **Length:** without X Premium a post is 280 characters, and every link counts as 23. Count before handing it over: replace each URL with 23 characters, then count the rest.
- **Shape:**
  1. say what was built;
  2. say what the viewer can do with it;
  3. the link;
  4. credit.

  Say what the book teaches, who it is for and how many lessons there are, in plain words.
- **Credit** people whose work it builds on, with their @handle when you know it. A tag notifies them, and that is the point. Get handles from the person's GitHub profile (`gh api users/<login> --jq .twitter_username`), not from memory.
- **Write in the user's voice.** Ask whether they want first person ("I built…") or not, and keep their vocabulary. Avoid hype words, and use no em dashes in short social copy.
