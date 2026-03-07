## 2024-03-03 - Backend Secrets Exposure
**Vulnerability:** The backend allowed using a default "change-me" string or an empty value for the `ADMIN_PASSWORD` environment variable, leading to exposed critical endpoints if not securely configured. Additionally, timing attacks were possible during password comparison.
**Learning:** Hardcoded, default secrets allow attackers to bypass authentication. Using simple string comparison for passwords leads to timing attacks.
**Prevention:** Always raise an error on startup if critical secrets are using weak default values or empty strings. Use `secrets.compare_digest` for secure, constant-time string comparisons.
## 2026-03-04 - Memory Exhaustion DoS via File Upload
**Vulnerability:** The backend loaded entire uploaded files into memory (`contents = await up.read()`) during processing before checking if they exceeded the 25MB size limit (`MAX_UPLOAD_MB_PER_FILE`). This allowed an attacker to send arbitrarily large payloads (e.g., multi-gigabyte files) that could exhaust server memory and cause a Denial of Service (DoS) crash before the size guard ever triggered.
**Learning:** Checking size after reading an entire file into memory defeats the purpose of the size limit. `Content-Length` headers can be spoofed or missing, so the application must protect itself during the reading phase.
**Prevention:** Stream uploaded files to disk in smaller chunks (e.g., 1MB chunks) and enforce size limits during the stream. Abort the process and cleanup partial files if the threshold is exceeded.
## 2025-02-28 - Stored XSS via innerHTML in admin panel
**Vulnerability:** User-controlled folder names were being directly interpolated into an HTML string and rendered using `innerHTML` in `admin.js`. If an attacker or a malicious admin created a folder with a name containing `<script>` or other HTML tags, it would be executed when rendering the folder list.
**Learning:** Using template literals with `innerHTML` is dangerous when dealing with user input, even in admin panels where users are theoretically trusted. It leads to Stored XSS.
**Prevention:** Always use safe DOM element creation methods like `document.createElement`, `textContent`, and `appendChild` instead of `innerHTML` when rendering user-controlled data. Alternatively, use existing helper functions like `el` and set the `textContent` property.
