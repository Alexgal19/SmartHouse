# Project Analysis Table

This document centralizes all critical findings, risks, and recommendations identified during the project audit.

## 1. Project Risks and Reliability

| Risk | Description | Probability | Impact | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Scalability** | Google Sheets limits as a primary database. | High | Critical | Migrate to Firebase Firestore or PostgreSQL. |
| **Maintainability** | `MainLayout` acts as a "god component". | High | High | Refactor logic into custom hooks and use Zustand. |
| **Integrity** | Client-side filtering of sensitive data. | Medium | High | Move filtering and auth to server-side. |
| **Error Handling** | Optimistic UI updates may cause desync. | Medium | Medium | Improve sync logic and error recovery. |

## 2. Strategic Priorities

| Priority | Task | Estimated Effort |
| :--- | :--- | :--- |
| **1 (Highest)** | Refactor `MainLayout` for better modularity. | 2-3 Weeks |
| **2** | Move filtering and auth logic to Server Actions. | 1-2 Weeks |
| **3** | Implement robust error handling patterns. | 1 Week |

## 3. UI/UX Design Audit

| Area | Issue | Priority | Status | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Accessibility** | Missing `aria-labels` on icon buttons. | Medium | Pending | Add labels to all standalone icons. |
| **RWD** | Complex tables are hard to read on mobile. | Medium | In Progress | Implement card-based views for small screens. |
| **Feedback** | Missing progress indicators for long imports. | Low | Pending | Add progress bars for Excel processing. |

## 4. Frontend Architecture

| Component | Logic Issue | Impact | Status | Fix |
| :--- | :--- | :--- | :--- | :--- |
| `MainLayout` | State management sprawl. | Maintenance | Pending | Use specialized contexts/hooks. |
| `DataFetching` | Bulk download of all sheets. | Performance | Pending | Implement pagination/server-side filtering. |
| `SyncLogic` | Lack of concurrency control. | Reliability | Pending | Implement versioned writes/conflict resolution. |

## 5. Backend and API Safety

| Endpoint | Security Gap | Risk | Fix |
| :--- | :--- | :--- | :--- |
| `/api/save` | Missing schema validation. | Injection | Add Zod validation to all inputs. |
| `Actions` | Implicit server-side auth. | Bypass | Standardize auth checks in a middleware. |
| `Sheets` | Direct manipulation of rows. | Data Loss | Use `getSafeSheet()` exclusively. |

## 6. QA and Testing Strategy

| Suite | Coverage | Status | Next Step |
| :--- | :--- | :--- | :--- |
| **Unit** | Good (Business logic) | Active | Maintain current coverage. |
| **Integration** | Moderate (API -> Sheets) | Inactive | Add more end-to-end integration tests. |
| **E2E** | Missing | Critical | Implement Playwright for critical paths. |

## 7. DevOps and Deployment

| Step | Gap | Priority | Recommendation |
| :--- | :--- | :--- | :--- |
| **CD** | Manual deployment triggers. | Medium | Automate deployment via GitHub Actions. |
| **Secrets** | `.env.local` used for production. | High | Use Google Secret Manager. |
| **Logs** | Reliance on `console.log`. | Medium | Integrate Sentry or Cloud Logging. |

## 8. Mobile Responsiveness Analysis

| Item | Critical Issue | Priority | Status |
| :--- | :--- | :--- | :--- |
| **Dialogs** | Width overflows on tablets. | Critical | Pending | Use `max-w-[95vw]` in UI components. |
| **Touch** | Target sizes < 44px. | Critical | Pending | Increase hit area for all buttons. |
| **Grid** | 3-column layout on mobile. | High | Pending | Switch to 1-column on small breakpoints. |
| **Forms** | Input height `h-8` is too small. | Medium | Pending | Increase to `h-10` for better touch usability. |

## 9. Executive Summary of Recommendations

| Category | Key Action | Urgency |
| :--- | :--- | :--- |
| **Database** | Migrate from Sheets to a real database. | CRITICAL |
| **Arch** | Split "God Components" into modular services. | HIGH |
| **Tests** | Implement End-to-End testing via Playwright. | HIGH |
| **Security** | Centralize auth and validate all inputs via Zod. | MEDIUM |

### Final Audit Note

The application has a strong foundation but requires immediate architectural refactoring and a migration plan for the data layer to ensure long-term scalability and security.
