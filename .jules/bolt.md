## 2023-10-24 - Layout Thrashing in requestAnimationFrame
**Learning:** Reading layout properties like `scrollWidth` and `clientWidth` inside a `requestAnimationFrame` loop forces the browser to evaluate layout 60 times per second, even if `transform` is the only property being mutated.
**Action:** Always cache DOM layout measurements (like widths/heights) outside of high-frequency animation loops and recalculate them only when necessary (e.g., on loop wrap or resize event) to avoid unnecessary DOM reads.
