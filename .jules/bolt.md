## 2023-10-24 - Layout Thrashing in requestAnimationFrame
**Learning:** Reading layout properties like `scrollWidth` and `clientWidth` inside a `requestAnimationFrame` loop forces the browser to evaluate layout 60 times per second, even if `transform` is the only property being mutated.
**Action:** Always cache DOM layout measurements (like widths/heights) outside of high-frequency animation loops and recalculate them only when necessary (e.g., on loop wrap or resize event) to avoid unnecessary DOM reads.

## 2024-03-24 - Live Ticker Optimization
**Learning:** Moving the continuous JavaScript-based `requestAnimationFrame` ticker animation to pure CSS `@keyframes` on the compositor thread significantly reduces CPU usage and provides a noticeably smoother scrolling experience without layout thrashing.
**Action:** Always prefer CSS animations for simple, continuous translation (`transform: translateX(...)`) effects instead of manual JS frame loops. We replaced the manual loop with a cloned duplicate node mechanism inside a wrapper that animates cleanly to `-50%`.

## 2025-03-02 - Image upload duplicate processing bottleneck
**Learning:** The backend processes large uploaded images twice (once for main display `_resize_and_store`, once for thumbnail `_make_thumb`) directly from the massive original file. This is a severe codebase-specific bottleneck that duplicates heavy I/O and CPU work, especially since the thumbnail could simply be derived from the already-resized main image in memory.
**Action:** When creating multiple derivative sizes of an image (like main and thumb), process the largest required size first, then generate smaller sizes from that in-memory result rather than reopening the original file.

## 2025-03-05 - Batch File-Based I/O Modifying Operations
**Learning:** In a single-file JSON backend (like `index.json`), state-modifying array operations using `Promise.all()` (e.g., deleting multiple images concurrently) trigger race conditions leading to data loss, I/O bottlenecks, and WebSocket broadcast storms.
**Action:** Always implement a single atomic bulk/batch operation endpoint for modifying array structures or deleting multiple resources in file-backed architectures.

## 2025-03-05 - Event Date Parsing in Render Loop
**Learning:** Recompiling a regular expression and allocating temporary objects inside a render loop (like `buildEventBox` iterating over many event strings) adds unnecessary CPU overhead and memory churn.
**Action:** When parsing data in a loop, extract the Regex out of the loop and extract the needed data directly into primitive variables instead of creating throwaway intermediate objects.

## 2025-03-09 - Batch DOM Insertions with DocumentFragment
**Learning:** When dynamically building UI components (like folder cards or carousel items) in vanilla JavaScript by iterating over state arrays and repeatedly appending to the live DOM using `appendChild()`, the browser triggers expensive layout recalculations (reflows) on every single iteration.
**Action:** Always utilize a `DocumentFragment` (`document.createDocumentFragment()`) when inserting multiple elements into the DOM inside a loop. Append children to the memory-bound fragment first, and append the fragment to the live DOM once, drastically reducing reflow overhead.
## $(date +%Y-%m-%d) - Offload Blocking File Operations to Asyncio Threads
**Learning:** In asynchronous Python applications like FastAPI, standard library file operations (such as `shutil.rmtree`, `shutil.move`, and `Path.unlink`) are inherently synchronous and can block the main event loop. For directories with thousands of files, `shutil.rmtree` can block the loop for over 100ms, stalling all incoming requests and WebSocket frames.
**Action:** When performing heavy or bulk file I/O in async endpoints, wrap the operations in `loop.run_in_executor` (or `asyncio.to_thread` for Python 3.9+) to dispatch them to a background thread and preserve event loop responsiveness.
