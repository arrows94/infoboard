## 2026-03-02 - [Enforce critical environment variables for backend security]
**Vulnerability:** The application was allowing insecure default values for `DATA_DIR` and `ADMIN_PASSWORD` (defaulting to "change-me"), leading to potentially exposed data and unauthorized admin access.
**Learning:** Even if default values are provided for convenience, critical variables related to authentication and data storage should never default to insecure or easily guessable values.
**Prevention:** Strictly enforce that secure environment variables must be explicitly set and are not easily guessable defaults before starting the server. Fail fast by throwing a RuntimeError on application boot.
