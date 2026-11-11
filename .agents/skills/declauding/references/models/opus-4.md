# Opus 4.6 and Opus 4.8

## Editing a draft Opus 4.8 wrote

1. Run the linter and act on its em-dash, triad and flat-certainty flags. They
   hit on Opus 4.8 prose, unlike Opus 5's.
2. Read the last sentence of every paragraph. Opus 4.8 ends most of them on a
   maxim (entry 12): *We optimized the case that was already fine and taxed the
   case we cared about.* Delete it unless it states a new fact.
3. Find the running metaphor. Opus 4.8 introduces one image and reuses it across
   paragraphs (entries 37 and 27): *a fixed tax on every request*, then *Redis
   tax* three paragraphs later. Replace it with the mechanism it names.
4. Strip bolded labels that restate their list item (entry 29): **Misses pay for
   the lookup twice.**

## Editing a draft Opus 4.6 wrote

Run the general pass; it stages less than later Opus models. Check for Title
Case headers (entry 30) and the em-dash reversal *the cache isn't a cache—it's a
new dependency* (entries 2 and 16).

## Running the pass as Opus 4.x

Not observed separately. Apply the editor rules in `opus-5.md`.

Evidence: `oaustegard/experiments` `model-register-drift/` (one Opus 4.6 and two
Opus 4.8 samples, one prompt).
