## 2024-03-13 - Fix DOM-based XSS in frontend error handler
**Vulnerability:** The application unsafely interpolated error strings directly into the live DOM using `main.innerHTML = \`<p>\${String(err)}</p>\`` inside the global `init().catch(err => ...)` handler in `backend/frontend/kiosk.js`.
**Learning:** This is a classic DOM-based XSS vulnerability. If the error message contained unescaped HTML or user-controlled input (e.g., from a failed API request reflecting user data), it could execute malicious scripts in the context of the Kiosk application.
**Prevention:** When rendering dynamic error messages or data from exceptions in the frontend, never use `innerHTML` directly with the error string. Always create DOM elements explicitly and assign dynamic values using `textContent`.
