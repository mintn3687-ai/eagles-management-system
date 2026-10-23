# Project architecture guardrails

These rules are the default standard for all code in this repository.

## 1. Ownership and layer boundaries

- App routes may call service functions.
- Services may call repositories.
- Repositories may call Prisma.
- Utilities should avoid database access unless they are truly shared, non-domain helpers.
- Components should not call Prisma directly and should not contain business logic.

This keeps responsibilities narrow and makes the system easier to reason about.

## 2. Module contract

Each feature module under `src/modules/<feature>/` should follow the same pattern:

- `repository.ts` for Prisma access and data shaping
- `service.ts` for business rules and orchestration
- a narrow public API that callers use instead of reaching into internals

Routes and components should talk to the module API, not to Prisma or to deep internal helpers.

## 3. Authorization and permissions

- Keep permission checks in one canonical layer.
- Avoid mixing route checks, component checks, and service checks in multiple places.
- Prefer centralized role and access helpers so authorization stays consistent and auditable.

This reduces role drift and makes security reviews easier.

## 4. Coupling rules

- Review imports between modules before adding new dependencies.
- Avoid cross-feature coupling unless the dependency is intentional and adjacent.
- Prefer thin route orchestration and domain logic inside the owning module.

## 5. Workflow checklist

Before merging feature work, confirm:

- No Prisma in components
- No business logic in pages or route files
- No route-level database access without a service layer
- Shared utilities stay generic and not domain-specific
- New feature work matches the `src/modules/<feature>/` structure
- Permission checks are centralized and consistent

## 6. Legacy migration policy

The project is gradually moving from older `src/lib/` patterns to module-based organization. Keep this migration intentional:

- `src/lib/` should hold cross-cutting utilities such as dates, validation, auth helpers, formatting, and generic permission primitives.
- Move remaining business logic from old shared files into the appropriate feature module.
- Do not create new direct DB logic in old shared files when a dedicated module already exists.
