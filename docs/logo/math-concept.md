# The Aynite Logo: A Mathematical Puzzle

> A 1000 × 1000 canvas. Two strokes. One dot. Seven constants.
> Every value is the inevitable consequence of the rule before it.

---

## The Decision Chain

---

### Step 1: The Apex | φ³

$$y_{\text{apex}} = \frac{1000}{\varphi^3} = \frac{1000}{4.236} \approx 236$$

**Apex: (500, 236)** — the top third of the canvas.

---

### Step 2: The Triangle | φ⁴ + 3-4-5

The base endpoints are at φ⁴ from each edge:

$$x_{\text{left}} = \frac{1000}{\varphi^4} \approx 146 \quad\quad x_{\text{right}} = 1000 - 146 = 854$$

The base y-position divides the space below the apex by φ:

$$y_{\text{base}} = 236 + \frac{1000 - 236}{\varphi} \approx 708$$

Height = 472, Half-base = 354. From 3-4-5: $354 \times 4/3 = 472$.

$$590 : 472 : 354 = 5 : 4 : 3 \quad\checkmark$$

**Left: (146, 708), Right: (854, 708)**

---

### Step 3: The Stroke and Dot | W = D

The stroke width equals the dot diameter: $W = D = 50$.

This creates a clean, minimal relationship — the stroke and dot share the same thickness.

**Gap:** $G = D/\pi^2 = 50/9.87 \approx 5$

**Dot center: (500, 708 + 5) = (500, 713)**

---

### Step 4: The Gradients | √2 Cross-fade

**Left leg** — midpoint at $1/\sqrt{2} \approx 70.7\%$ from apex (stays bright longer)
**Right leg** — midpoint at $1 - 1/\sqrt{2} \approx 29.3\%$ (transitions early)

The two gradients form a **cross-fade**: as you descend the A, the light rotates from the left leg to the right leg. This represents **i** (the imaginary unit) from Euler's identity.

The gradients use 4 carefully chosen stops for a smooth, natural falloff — avoiding banding while maintaining mathematical precision.

---

### Step 5: The Dot | 3D Sphere

The dot uses an **offset radial gradient** (cx=0.35, cy=0.3) to create a 3D sphere effect. The highlight is at the top-left, shadow at the bottom-right — consistent with the light source implied by the stroke gradients.

This gives the dot visual weight and presence — it feels like a physical object rather than a flat circle.

---

### Step 6: Background | φ Contrast

The background follows the shapedirection (↘). Its luminance is:

$$\text{Bg luminance} = \frac{1 - \text{shape luminance}}{\varphi}$$

Maximum brightness: $1/\varphi \approx 0.618 \rightarrow$ #9e9e9e.

Where the shape is white, the background is black. Where the shape is dark, the background approaches 61.8% grey.

---

## Summary

| Step | Constant | Element | Value |
|---|---|---|---|
| 1 | φ³ | Apex y | 236 |
| 2 | φ⁴, 3-4-5 | Base vertices | (146,708), (854,708) |
| 3 | — | W = D | 50 |
| 4 | π² | Gap | 5 |
| 5 | √2 | Gradient cross-fade | 70.7% / 29.3% |
| 6 | — | 3D sphere dot | Offset radial |
| 7 | φ | Background contrast | 1/φ |

---

*The logo does not decorate with math. It is structured by it.*
