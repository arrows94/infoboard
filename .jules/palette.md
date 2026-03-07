## 2023-10-24 - Layout Thrashing in requestAnimationFrame
**Learning:** Reading layout properties like `scrollWidth` and `clientWidth` inside a `requestAnimationFrame` loop forces the browser to evaluate layout 60 times per second, even if `transform` is the only property being mutated.
**Action:** Always cache DOM layout measurements (like widths/heights) outside of high-frequency animation loops and recalculate them only when necessary (e.g., on loop wrap or resize event) to avoid unnecessary DOM reads.

## 2024-03-24 - Live Ticker Optimization
**Learning:** Moving the continuous JavaScript-based `requestAnimationFrame` ticker animation to pure CSS `@keyframes` on the compositor thread significantly reduces CPU usage and provides a noticeably smoother scrolling experience without layout thrashing.
**Action:** Always prefer CSS animations for simple, continuous translation (`transform: translateX(...)`) effects instead of manual JS frame loops. We replaced the manual loop with a cloned duplicate node mechanism inside a wrapper that animates cleanly to `-50%`.

## 2025-03-02 - Image upload duplicate processing bottleneck
**Learning:** The backend processes large uploaded images twice (once for main display `_resize_and_store`, once for thumbnail `_make_thumb`) directly from the massive original file. This is a severe codebase-specific bottleneck that duplicates heavy I/O and CPU work, especially since the thumbnail could simply be derived from the already-resized main image in memory.
**Action:** When creating multiple derivative sizes of an image (like main and thumb), process the largest required size first, then generate smaller sizes from that in-memory result rather than reopening the original file.

## 2025-03-03 - Custom Toggle Checkbox 'for' Label Association
**Learning:** The custom toggle checkbox pattern (`<label class="toggle"><input type="checkbox" /><span></span></label>`) was missing `for` associations with its adjacent descriptive `<label class="label">` elements. Without the `for` attribute, screen readers fail to associate the label text with the checkbox, and clicking the descriptive label does not toggle the checkbox, severely reducing the effective click target area for mouse users.
**Action:** Always ensure descriptive labels use the `for` attribute pointing to the ID of the custom input element, especially for custom UI patterns like CSS-only toggles where the semantic input is hidden.
## 2025-02-13 - Implicit Submission on Standalone Inputs
**Learning:** Standalone `<input>` elements (not wrapped in `<form>`) break the browser's implicit submission behavior (pressing the `Enter` key). This creates a severe barrier for keyboard users who expect to submit simple single-input fields intuitively.
**Action:** Always wrap inputs in a `<form>` element, or manually implement `keydown` listeners on the `Enter` key if native forms cannot be used for architectural reasons.

## 2025-02-13 - Decorative Image Noise
**Learning:** In dynamically generated UIs (like vanilla JS apps), dynamically created `<img>` tags without an `alt` attribute will cause screen readers to announce the raw source URL or filename (e.g., "1234abcd.webp"), creating severe cognitive noise for users.
**Action:** Always default `alt=""` on dynamically created, decorative `<img>` tags (like thumbnails or background-style carousel images) unless explicit descriptive text is available and needed.
