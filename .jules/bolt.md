## 2023-10-24 - Layout Thrashing in requestAnimationFrame
**Learning:** Reading layout properties like `scrollWidth` and `clientWidth` inside a `requestAnimationFrame` loop forces the browser to evaluate layout 60 times per second, even if `transform` is the only property being mutated.
**Action:** Always cache DOM layout measurements (like widths/heights) outside of high-frequency animation loops and recalculate them only when necessary (e.g., on loop wrap or resize event) to avoid unnecessary DOM reads.

## 2024-03-24 - Live Ticker Optimization
**Learning:** Moving the continuous JavaScript-based `requestAnimationFrame` ticker animation to pure CSS `@keyframes` on the compositor thread significantly reduces CPU usage and provides a noticeably smoother scrolling experience without layout thrashing.
**Action:** Always prefer CSS animations for simple, continuous translation (`transform: translateX(...)`) effects instead of manual JS frame loops. We replaced the manual loop with a cloned duplicate node mechanism inside a wrapper that animates cleanly to `-50%`.
## 2025-03-02 - Image upload duplicate processing bottleneck
**Learning:** The backend processes large uploaded images twice (once for main display `_resize_and_store`, once for thumbnail `_make_thumb`) directly from the massive original file. This is a severe codebase-specific bottleneck that duplicates heavy I/O and CPU work, especially since the thumbnail could simply be derived from the already-resized main image in memory.
**Action:** When creating multiple derivative sizes of an image (like main and thumb), process the largest required size first, then generate smaller sizes from that in-memory result rather than reopening the original file.
## 2024-05-24 - Concurrent API requests cause JSON data loss
**Learning:** The backend uses a simple read-modify-write pattern on a single `index.json` file. Firing concurrent state-modifying API requests (like deleting multiple images via `Promise.all()`) causes race conditions where concurrent writes overwrite each other, leading to data loss and performance issues due to multiple disk writes and WebSocket broadcast storms.
**Action:** Always batch state-modifying operations into a single bulk API request when dealing with JSON-file-backed storage to ensure atomic writes and avoid I/O bottlenecks and broadcast storms.
