# Contributing to PhoFilledHackersProject

## Naming Conventions

This project enforces consistent naming conventions via ESLint with @typescript-eslint/naming-convention rules. The configuration is located in `apps/student-onboarding/eslint.config.mjs`.

### TypeScript Naming Rules

| Element                           | Convention                           | Examples                                   |
| --------------------------------- | ------------------------------------ | ------------------------------------------ |
| Types, Interfaces, Classes, Enums | PascalCase                           | `StudentProfile`, `IntakeFieldPath`        |
| Variables, Functions, Parameters  | camelCase                            | `createEmptyProfile()`, `apiKey`           |
| Constants                         | UPPER_CASE or camelCase              | `MAX_RETRIES`, `curriculumStrengthOptions` |
| Properties                        | camelCase, PascalCase, or UPPER_CASE | `firstName`, `userId`, `CONTENT_TYPE`      |
| Enum Members                      | PascalCase or UPPER_CASE             | `GradeLevel.Nine`, `HTTP_STATUS.OK`        |

### Specific Conventions

- **Type-like elements** (types, interfaces, classes, enums, type parameters): Must use PascalCase
- **Variables and functions**: Use camelCase or PascalCase; leading underscores are allowed
- **Parameters**: Use camelCase or PascalCase; leading underscores are allowed
- **Properties**: Can use camelCase, PascalCase, or UPPER_CASE; leading underscores are allowed
- **Enum members**: Use PascalCase or UPPER_CASE
- **String-keyed properties** in `Record<string, ...>` types: Allowed any format (display labels, path strings, etc.)

### Module Organization

- **Apps**: `apps/*` - Deployable applications (e.g., `student-onboarding`, `ingest`)
- **Packages**: `packages/*` - Shared libraries (e.g., `@etest/auth`, `@etest/db`)

### File Naming

- TypeScript files: Match the primary exported class or function name (e.g., `student-profile.ts` exports `StudentProfile`)
- Component files: PascalCase matching component name (e.g., `StudentOnboardingApp.tsx`)
- Test files: Same name as the file being tested with `.test` suffix (e.g., `location-preferences.test.ts`)

## Development

### Linting

Run linting for the student-onboarding app:

```bash
cd apps/student-onboarding && npm run lint
```

### Building

Build all apps and packages:

```bash
npm run build
```

### Testing

Run tests:

```bash
# Run all tests
npm test

# Run tests in a specific app
cd apps/student-onboarding && npm test
```
