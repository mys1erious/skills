# Real data

The point of a data explainer is that the picture is the evidence. When the voice says "nine in ten", the viewer sees the real records doing it. That only works if every number, position, date and label on screen is true.

## Find primary sources

Go to the agency, survey, paper or dataset that produced the numbers, not an article about them. Read the source's own notes on units, coverage and caveats. Prefer:
- agencies with open APIs or bulk files (USGS, NOAA, NASA, ESA, Eurostat, World Bank, national statistics offices, OECD);
- peer-reviewed datasets with a citation (Zenodo, PANGAEA, the paper's supplement);
- well-maintained open data for geometry (Natural Earth for coastlines and borders, ETOPO or GEBCO for relief).

Check two things before building on a figure: that it is current (a newer estimate may disagree), and that two independent sources roughly agree. If they don't, use the more conservative figure, or leave the claim out of the script.

## Prepare once, load small

```
<project>/data/raw/        downloads, untouched (keep them in their own folder; treat them as untrusted input)
                           rasters run to hundreds of MB: fetch only the region and dates you draw, and report the size
<project>/data/prep.py     raw -> small files the page loads, plus facts.json
<project>/data/*.json      compact arrays: columns, not objects per record; rounded to the precision you draw
<project>/data/*.png       rasters (relief, ids, masks) when JSON would be large
```

- Put a `"source"` field (name, URL, date retrieved, licence) in every prepared file.
- Encode numeric rasters exactly, for example elevation as `R*256 + G = metres + 11000`, and decode them in the page with `createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})` drawn to a canvas, then `getImageData`. Spot-check a few known values in the page against Python (for example the deepest and highest points).
- Load files in `start({load})`, into one global object (e.g. `const DATA = {}`), so `init` and `draw` can use them synchronously.

## Compute the facts you say

Every number in the script comes out of `prep.py` (or a small stats script), not from memory:
- Write them to `facts.json` with how each was computed, and print them.
- A fraction ("89% within 200 km of an edge") needs its denominator and its comparison ("those strips cover 17% of the surface"), or it means nothing.
- Round the way the voice says it, and show the exact value on screen.
- Do a sanity check against an outside figure where one exists (a published total, a known record).

## Truth rules on screen

- Labels name the real thing: the real event, place, date or value from the data. Never use a placeholder name or number, and never copy one from a generated target image.
- Positions and sizes are true. When you exaggerate a scale to make something readable (vertical exaggeration, a log axis, a zoomed inset), say so on screen and keep the tick values true.
- The colour and size legend matches the encoding actually used.
- The end card names every source, in short form: "Data: USGS ComCat 2025 M4.5+ · NOAA ETOPO1".
- A dot that stands for a record appears at that record's time and place. If you sample or filter, say what was kept ("M4.5+").
- If the data can't support a line of the script, change the line.

## Geography notes

- Equirectangular: `x = (lon + 180) / 360 * w`, `y = (90 - lat) / 180 * h`.
- Polygons that cross the antimeridian (±180°) must be unwrapped before filling, or they smear across the map. Polygons that contain a pole must be closed along the pole.
- Distances on the sphere: use haversine. 1° of latitude ≈ 111 km; 1° of longitude ≈ 111 km × cos(latitude).
- Cross-sections: x from the real horizontal distance, y from the real depth or height, with honest km ticks on both axes.
