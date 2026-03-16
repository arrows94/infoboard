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
## 2025-03-06 - Custom Toggle Checkbox Keyboard Accessibility
**Learning:** Using `display: none` on native inputs for custom toggles (like CSS-only toggle switches) completely removes them from the tab order and screen reader flow, making them completely inaccessible to keyboard users and assistive technologies.
**Action:** Always visually hide the native input using `opacity: 0; position: absolute; width: 100%; height: 100%; cursor: pointer; margin: 0; z-index: 1;` instead of `display: none`. This keeps the element focusable, interactive via keyboard, and allows the adjacent custom UI element to receive `:focus-visible` styles through adjacent sibling combinators (e.g. `input:focus-visible + span`).
## 2025-02-13 - Implicit Submission on Standalone Inputs
**Learning:** Standalone `<input>` elements (not wrapped in `<form>`) break the browser's implicit submission behavior (pressing the `Enter` key). This creates a severe barrier for keyboard users who expect to submit simple single-input fields intuitively.
**Action:** Always wrap inputs in a `<form>` element, or manually implement `keydown` listeners on the `Enter` key if native forms cannot be used for architectural reasons.

## 2025-02-13 - Decorative Image Noise
**Learning:** In dynamically generated UIs (like vanilla JS apps), dynamically created `<img>` tags without an `alt` attribute will cause screen readers to announce the raw source URL or filename (e.g., "1234abcd.webp"), creating severe cognitive noise for users.
**Action:** Always default `alt=""` on dynamically created, decorative `<img>` tags (like thumbnails or background-style carousel images) unless explicit descriptive text is available and needed.

## 2026-03-10 - Adding accessibility to custom interactive containers
**Learning:** In vanilla JavaScript without native form or UI elements (like `<button>`), developers often attach click handlers directly to parent `<div>` containers. This completely breaks keyboard accessibility and screen readers, as the elements cannot receive focus or declare their interactive nature. Additionally, if the parent element responds to key events (like `Enter`), it can incorrectly trigger actions when a child interactive element (like a text input) actually caused the event.
**Action:** Always wrap interactive actions in an explicit `role="button"`, assign `tabindex="0"`, provide an informative `aria-label`, and attach a `keydown` handler explicitly checking for `Enter` and `Space`. Critically, within the `keydown` and `click` handlers, check the event target (`e.target.tagName`) to prevent triggering parent actions from bubbling child events. Apply `:focus-visible` styling to clearly indicate focus without impacting mouse users.
## $(date +%Y-%m-%d) - Accessible Toast Notifications
**Learning:** Custom toast notifications created dynamically via JavaScript (like `showToast`) must include `role="status"` and `aria-live="polite"` to be automatically announced by screen readers without stealing focus from the user's current task.
**Action:** Always ensure transient notification elements (e.g. toasts, snackbars) have these accessibility attributes applied upon creation.
## 2024-05-18 - Async Action Button Feedback
**Learning:** Async buttons (e.g. Save, Delete, Create) without immediate visual feedback can lead to user confusion and double-submissions, especially when API responses are slightly delayed.
**Action:** Always disable async buttons and update their text (e.g. "Saving...") immediately upon click, and ensure they are reliably re-enabled using a `try...finally` block.
