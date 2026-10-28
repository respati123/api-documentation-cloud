# Code quality

Read this when you write or review server code. The goal is code that is short to read and easy to change.

## Size

- A function is about 40 lines at most. If it is longer, extract named steps.
- A file is about 300 lines at most. If it is longer, split it by concern.
- A route handler is a few lines: read the validated input, call one service, return the result.

## Parameters

- Up to three positional parameters. More than three becomes one typed object:

```ts
// avoid
createWorkspace(db, userId, name, tree, variables, now)

// prefer
createWorkspace({ userId, name, tree, variables })
```

- Do not pass the same value through several layers. Pass the context object once.
- Optional parameters go in the object with a clear default, never as a trailing `undefined`.

## Flow

- Return early. Guard the bad cases first and keep the happy path at the left margin.
- No nested ternaries. Use a function or a `switch` for more than one branch.
- No deep nesting. More than two levels of `if` or loops means extract.
- Avoid boolean parameters. Use an options object or two functions.

## Types

- No `any`. Use `unknown` and narrow it.
- No `as` casts to silence the compiler. Narrow with a guard, or fix the type.
- Exported functions have explicit return types.
- Error and result shapes are discriminated unions when a function can succeed or fail in several ways.

## Names

- English names only, for files, functions, variables, and identifiers.
- Names say what the thing is: `workspaceRepository.findMembership`, not `getM`.
- No abbreviations except `id`, `url`, `db`, and common loop indexes.
- Constants for magic values: limits, durations, role names, error codes.

## Comments

- Write a comment only when the reason is not obvious from the code: a constraint, a non-obvious rule, a workaround.
- No section banners, no restating the code, no filler such as "This function handles...".
- Keep comments short and in the same language as the nearby code.

## Duplication

- Two copies of the same logic are a bug waiting to happen. Extract on the second copy.
- Shared sync logic lives in `shared/` and is the only copy in this server. Keep it in step with the desktop app copy.

## Review checklist

Before you ask for review, check: the tests were written first, no function over 40 lines, no file over 300 lines, no more than three positional parameters, no `any`, no `as`, no `console.*`, no secret in a log or response, and every new route has auth, validation, a size limit, and tests for each role.
