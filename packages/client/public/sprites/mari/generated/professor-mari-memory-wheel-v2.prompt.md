# Professor Mari memory wheel — alternating stride

Generated with the built-in image generation tool on 2026-09-15. Reference: the existing `professor-mari-memory-wheel.png`, originally based on `professor-mari-assistant-idle.png`. The selected PNG is preserved unchanged from the image-generation output.

This revision makes the dark near leg move through four phases: forward extension, vertical support, backward extension, raised knee. The lighter far leg takes the opposite phase. Both stride frames show a straight trailing leg, and wheel spokes shift between cels. Mari retains her blonde hair, glasses, blue eyes, navy hoodie and gray trousers.

The technical contract remains a 1536×1024 RGBA PNG containing four 384px-wide horizontal cels. The UI displays the central 384×448 crop per cel and runs the existing 640ms steps(4) animation. Reduced-motion users see the first frame. Empty areas are genuinely alpha-transparent; no raster postprocessing was performed.

## Final pose-edit prompt

Edit this transparent FOUR-FRAME sprite sheet into a TRUE four-phase RUN ANIMATION. This is not four illustrations of the same pose. Keep the exact Professor Mari character, head, hair, glasses, clothing, wheel, stand, sprite style and scale. Draw the LEGS AND ARMS ANEW in frames 3 AND 4: these frames MUST be visibly different from frames 1 and 2. The anatomical legs must trade foreground/back positions.

IMPORTANT leg identity: near anatomical leg ALWAYS DARK charcoal gray, far anatomical leg ALWAYS LIGHT medium gray. Keep the two shades strongly distinguishable. In each stride, the overlapping DARK thigh is in front of the LIGHT thigh.
CELL1: DARK leg extended toward viewer's RIGHT; LIGHT leg extended toward viewer's LEFT, straight trailing knee.
CELL2: DARK leg planted straight vertically beneath hip; LIGHT knee bent high in front toward viewer's RIGHT; light foot raised clear of ground.
CELL3: REVERSE CELL1: DARK leg now stretches diagonally BACK to viewer's LEFT, with dark shoe clearly at leftmost foot position; LIGHT leg stretches forward toward viewer's RIGHT, with light shin and shoe forward. DARK thigh crosses IN FRONT of LIGHT thigh. Reverse arm swing here: near arm bent forward to RIGHT, other arm back to LEFT. Do NOT reproduce cell1 dark-forward leg.
CELL4: REVERSE CELL2: LIGHT leg planted vertically below hip; DARK knee raised and bent in front toward viewer's RIGHT, DARK shin/foot floating in front of the LIGHT support leg. Do NOT reproduce cell2 dark straight support leg. Near arm remains opposite cell2.

This dark-leg movement through the four cells is the primary required edit: RIGHT extended → DOWN planted → LEFT extended → RIGHT raised bent. The far LIGHT leg does the opposite phase. A two-pose repeat is a failed result. Maintain stable hips and head (no hopping). Rotate only internal wheel spokes slightly in each consecutive cell so the running wheel also advances.

TECHNICAL OUTPUT: exactly 1536×1024 PNG with an ACTUAL ALPHA CHANNEL and transparent background mode, FOUR384px-wide cells in one horizontal row. Wheel centers x192,576,960,1344; all characters/wheels/stands within y288..736. Preserve registered rims and stands; no extra cells, labels or borders. Empty space around AND INSIDE wheels must be alpha=0. Absolutely no painted checkerboard, solid background, glow or texture. Preserve original pixels outside the minimal arm/leg/spoke edits as closely as possible.

## Final alpha-only correction prompt

Use case: background-extraction. Perform ONLY a transparency repair on this four-frame spritesheet. Preserve the exact current pixels/poses, including the crucial DARK/LIGHT alternating legs: frame1 light-left/dark-right, frame2 dark straight support/light raised knee, frame3 dark-left/light-right, frame4 light straight support/dark raised knee. Do not redraw or exchange legs, arms, spokes, hair, face, clothing, wheel, stand, or change positions.

Remove ALL gray checkerboard and gray artifacts from around the art AND inside the empty parts of the wheel, between spokes, limbs and stands. Return a PNG with REAL RGBA ALPHA TRANSPARENCY. Activate transparent background output; empty space must have alpha=0, NOT a depiction of checkerboard. Do not add any solid black/white/gray background, checkerboard, glow, shadows, texture or blur. Keep crisp pixel edges. Exact 1536x1024 dimensions, four 384px cells, unchanged alignment. This is a UI asset, not a screenshot or mockup of one. Transparency correction only; current four-phase leg color/overlap is already the desired animation.

## Provenance and inspection

Selected output: `exec-f52f5c12-c453-4e53-8e59-397439f331b3.png`, after a pose edit and an alpha-only correction with the built-in tool. PNG SHA-256: `c76f3e4bdf642e402a418c31a92d6fb893f2799f4d187d45e15f013a6ff78e3e`.

Verified four transparent cels; solid art stays within y296–697, inside the existing y288–736 crop. Reviewed all four poses at the displayed 144px width on dark and light backgrounds. The release clip in `public/releases/2.4.6/mari-memory-wheel.mp4` is a 3.8-second Chromium recording of this sprite with the existing CSS, converted to H.264 at 540×224. No frame painting or compositing.

This remains a compact four-frame pixel-art cycle: leg shading and overlap distinguish the alternating open strides.
