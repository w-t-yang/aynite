# The Aynite Logo: A Mathematical Puzzle

> A 1000 × 1000 canvas. Two strokes. One dot. Seven constants.
> Every value is the inevitable consequence of the rule before it.

---

## The Decision Chain

---

### Step 0: The Canvas

A 1000 × 1000 square.

### Step 1: The Apex | φ

The apex divides the canvas height in the golden ratio:

$$y_{\text{apex}} = \frac{1000}{\varphi^2} = \frac{1000}{2.618} \approx 382$$

**Apex: (500, 382)**

### Step 2: The Triangle | 3-4-5

The base sits at the golden ratio complement of the apex:

$$y_{\text{base}} = y_{\text{apex}} \times \varphi \approx 618$$

**Height = 618 - 382 = 236**

In a 3-4-5 triangle, height : half-base = 4 : 3:

$$\text{Half-base} = 236 \times \frac{3}{4} = 177$$

**Stroke length** = $\sqrt{177^2 + 236^2} = 295$

Check: $295 : 236 : 177 = 5 : 4 : 3$ ✓

**Endpoints: (323, 618) and (677, 618)**

**Apex angle:** $\theta = 2 \times \arctan(3/4) \approx 73.74^\circ$

### Step 3: Clean Geometry — Clipped Apex and Base

The strokes use **square caps** clipped by a triangle.

**Apex clipping:** The two strokes extend beyond the apex and are clipped by a triangle that matches the logo's outline. This guarantees a sharp, clean point at the top with no overlap.

**Base clipping:** The strokes extend below the horizontal base line and are clipped at y=764. The base is perfectly flat.

The clipping triangle: `polygon(500,382 236,734 764,734)`

### Step 3b: The Equation

The strokes have **square caps** (no rounding). This creates a clean, precise termination.

The cap is cut at an angle: each stroke ends with a line perpendicular to its direction.

For a 3-4-5 triangle, the stroke angle from vertical is:

$$\alpha = \arctan(3/4) \approx 36.87^\circ$$

The cap is perpendicular to this: $90^\circ - 36.87^\circ = 53.13^\circ$ from horizontal.

### Step 4: The Dot Size | π + φ

The dot diameter relates to the triangle height through π:

$$\pi D = 236$$

$$D = \frac{236}{\pi} \approx 75.1 \rightarrow 75$$

But the dot is too small in the 1000×1000 canvas. Let's scale.

Actually, let me scale the whole logo to fill the canvas better. The current triangle spans y=382 to y=618 (height=236), which is only 23.6% of the canvas. Let me multiply everything by a scaling factor.

**Scale factor:** Let me make the triangle fill more of the canvas.

If I set apex at a different position and let the triangle expand to near the bottom:

Let me use a different approach. Instead of the golden ratio for the apex, let me think about what makes the logo fill the canvas better while still encoding math.

**New approach — the apex is at y = 1000/φ = 618:**

Wait, that puts the apex in the bottom half. That doesn't work.

**Let me try: apex_y = 1000 - 1000/φ² = 1000 - 382 = 618.** That's the bottom.

Or: **apex_y = 1000/φ³ = 1000/4.236 = 236.**

Then base_y = apex_y × φ = 236 × 1.618 = 382.
Height = 382 - 236 = 146.
Half-base = 146 × 3/4 = 109.5.
Stroke = √(109.5² + 146²) = √(33314) ≈ 182.5.

That's even smaller. The issue is that φ-based positioning always leaves room below.

**Let me just use the full canvas.** Apex at y = 100. Base at y = 800. Height = 700.

But then I lose the φ-based positioning for the apex.

**Alternative: Use the canvas diagonal to set the scale.**

The canvas diagonal = 1000√2 ≈ 1414. Let the stroke length = canvas diagonal / 5 = 1414/5 ≈ 283. If the stroke is 5 units (3-4-5), then 1 unit = 283/5 = 56.6.

Height = 4 × 56.6 = 226.4. Half-base = 3 × 56.6 = 169.8.

Still small. The problem is the 3-4-5 triangle is always wider at the base than tall.

**Let me use a different constraint: the base spans 80% of the canvas width.**

Base = 800. Half-base = 400. Height = 400 × 4/3 = 533.3. Stroke = 400 × 5/3 = 666.7.

Apex at y such that bottom + height fits in canvas. If base at y=850, apex at y = 850 - 533 = 317.

That's a big triangle! Let me check: base from x=100 to x=900, apex at (500, 317).

This doesn't use φ for the apex position. But I can use φ elsewhere.

Actually, let me combine both: use φ AND scale to fill the canvas.

**New combined approach:**

The apex divides the canvas in golden ratio: y = 382. ✓ (keeps φ)

The **stroke length** is scaled to fill the canvas. Instead of deriving height from the φ-based base, I derive the stroke length from the distance from apex to canvas bottom.

Distance from apex (y=382) to bottom (y=1000) = 618.

The stroke endpoint should be somewhere between canvas bottom and the apex. Let me say: the stroke endpoint y = 382 + 618/φ = 382 + 382 = 764.

So endpoint at y = 764. Height = 764 - 382 = 382.

Half-base = 382 × 3/4 = 286.5. Stroke = √(286.5² + 382²) = √(228042) ≈ 477.5.

Check: 477.5 : 382 : 286.5 = 5 : 4 : 3? 477.5/5 = 95.5, 382/4 = 95.5, 286.5/3 = 95.5. ✓

And the dot: D = 382/π = 121.6 ≈ 122.

W = D/φ = 122/1.618 = 75.4 ≈ 75.

Gap = D/e = 122/2.718 = 44.9 ≈ 45.

Dot center at y = 764 + 45 = 809.

Let me check if this fits nicely:
- Apex: (500, 382)
- Endpoints: (500 - 286.5, 764) = (213.5, 764) and (786.5, 764)
- Dot center: (500, 809)
- Dot bottom: 809 + 61 = 870

That fits well in the 1000×1000 canvas. The triangle fills from y=382 to y=764 (38.2% to 76.4% of canvas), and the dot extends to y=870 (87% of canvas).

Wait, but 382 is 1000/φ² = 382. And the base is at y=764 which is... 382 + 382 = 764. 764/1000 = 0.764. Hmm, 0.764 is not a clean constant.

But y_base = apex_y + (1000 - apex_y)/φ = 382 + 618/1.618 = 382 + 382 = 764. Yes, that's a clean relationship: the space below the apex is divided by φ.

So y_base = apex_y + (1000 - apex_y)/φ = 382 + 382 = 764.

This is beautiful: the apex at φ² from the top, the base at φ from the apex. The golden ratio appears twice — the apex divides the canvas, then the base divides the remaining space below the apex.

Let me recalculate everything with this new geometry:

**Canvas: 1000 × 1000**

**Step 1 — Apex (φ):**
y_apex = 1000/φ² = 382
Apex: (500, 382)

**Step 2 — Base (3-4-5):**
Space below apex = 1000 - 382 = 618
y_base = 382 + 618/φ = 382 + 382 = 764
Height = 764 - 382 = 382

Half-base = 382 × 3/4 = 286.5
Left endpoint: (500 - 286.5, 764) = (213.5, 764)
Right endpoint: (500 + 286.5, 764) = (786.5, 764)

Stroke length = √(286.5² + 382²) = 477.5

**Check:** 477.5 : 382 : 286.5 = 5 : 4 : 3. 477.5/5 = 95.5, 382/4 = 95.5, 286.5/3 = 95.5. ✓

**Step 3 — Dot size (π):**
πD = height = 382
D = 382/π = 121.6 ≈ 122

**Step 4 — Stroke width (φ):**
D/W = φ
W = 122/1.618 = 75.4 ≈ 75

**Step 5 — Dot position (e):**
Gap = D/e = 122/2.718 = 44.9 ≈ 45
Dot center: (500, 764 + 45) = (500, 809)

**Step 6 — Gradient relationship (√2):**
The two gradients are connected through √2. The left leg's transition midpoint is at 1/√2 from apex. The right leg's transition midpoint is at 1 - 1/√2 from apex.

This creates a **crossed gradient** — the bright region on the left leg aligns with the dark region on the right leg, and vice versa. The √2 relationship connects them through complementary positions.

Actually, let me think about this more deeply. What does it mean for the two gradients to be related?

The left leg goes from apex (white) to endpoint (black). The right leg goes from apex (white) to endpoint (black). Both start white at the top and end black at the bottom.

The difference is **when** the transition happens:
- Left: mid-grey at 1/√2 ≈ 70.7% from apex (transitions late)
- Right: mid-grey at 1 - 1/√2 ≈ 29.3% from apex (transitions early)

This means at any given height, the two strokes have different brightness levels. The difference between them traces a curve that encodes √2.

Let me visualize this:

At the apex (y=382): both white.
At 29.3% down (y≈494): right leg is mid-grey, left leg is still mostly white.
At 50% down (y≈573): right leg is dark, left leg is light.
At 70.7% down (y≈652): left leg is mid-grey, right leg is already dark.
At endpoint (y=764): both black.

The brightness **difference** between the two legs follows a curve that peaks at the midpoint (y≈573), where the contrast between the two legs is greatest. The position of this peak is determined by √2.

This is a **cross-fade** — the light shifts from left to right as you travel down the A.

**Step 7 — Dot's internal structure (π rings):**

The dot isn't a simple radial gradient. Inside, it has a **π-bullseye**: concentric rings whose widths correspond to the digits of π.

D = 122. Digits of π: 3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8...

Using 12 digits: 3+1+4+1+5+9+2+6+5+3+5+8 = 52
Scale: 61/52 = 1.173px per unit (radius = 61)

Ring radii:
1. 3 × 1.173 = 3.52
2. (3+1) × 1.173 = 4.69
3. (3+1+4) × 1.173 = 9.38
4. (3+1+4+1) × 1.173 = 10.56
5. (3+1+4+1+5) × 1.173 = 16.42
6. (3+1+4+1+5+9) × 1.173 = 26.98
7. (3+1+4+1+5+9+2) × 1.173 = 29.33
8. (3+1+4+1+5+9+2+6) × 1.173 = 36.36
9. (3+1+4+1+5+9+2+6+5) × 1.173 = 42.23
10. (3+1+4+1+5+9+2+6+5+3) × 1.173 = 45.75
11. (3+1+4+1+5+9+2+6+5+3+5) × 1.173 = 51.61
12. (3+1+4+1+5+9+2+6+5+3+5+8) × 1.173 = 61.00

These 12 concentric circles form a π-bullseye. Each ring alternates black/white fill.

**Step 8 — Euler's identity as the gradient relationship:**

The cross-fade between the two gradients represents **i** (the imaginary unit). Just as multiplying by i rotates 90° on the complex plane, the gradient shifts from one leg to the other as you descend the triangle. The rotation e^(iπ) = -1 is visible as the light "rotating" from the left leg to the right leg.

---

## Summary

| Step | Rule | Constant | Result |
|---|---|---|---|
| 1 | Apex y = 1000/φ² | φ | (500, 382) |
| 2 | Base y = apex + (1000-apex)/φ, 3-4-5 | φ, 3-4-5 | (213.5, 764), (786.5, 764) |
| 3 | πD = height | π | D = 122 |
| 4 | D/W = φ | φ | W = 75 |
| 5 | Gap = D/e | e | dot at (500, 809) |
| 6 | Gradient cross-fade at 1/√2 and 1-1/√2 | √2 | Transition asymmetry |
| 7 | π-bullseye inside the dot | π | 12 concentric rings |
| 8 | Euler's identity as gradient rotation | e, i, π, 1, 0 | Light rotates down the A |

---

*The logo does not decorate with math. It is structured by it.*
