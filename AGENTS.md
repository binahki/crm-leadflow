# Instructions for AI Coding Agents

## Commands

- **Build/Dev**: `npm run dev`
- **Lint**: `npm run lint`
- **Type check**: `npx tsc --noEmit`
- **Build**: `npm run build`
- **Test**: `npm test`
- **Test single file**: `npm test -- --testPathPattern=<filename>`

## Code Style Guidelines

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript (paths: `@/*` → `./src/*`)
- **Routing**: react-router-dom v6
- **Styling**: Tailwind CSS — use exclusively, no other CSS-in-JS or CSS modules
- **State Management**: Zustand for global state; React hooks (useState, useReducer) for local state; TanStack React Query for server state
- **Component Conventions**: Functional components only; co-locate types in a separate `types.ts` file when shared
- **File Structure**: Feature-based — group components, hooks, and utils by feature folder
- **Naming**:
  - Components: PascalCase
  - Hooks: camelCase with `use` prefix
  - Functions/Variables: camelCase
  - Types/Interfaces: PascalCase
  - Files: kebab-case for pages, PascalCase for components
- **Imports**: Use absolute imports (`@/`) for all application code; group external imports first, then internal
- **Error Handling**: Use try/catch for async operations; prefer early returns for validation
- **Accessibility**: Use semantic HTML, ARIA labels, and keyboard navigation support
- **Performance**: Use React.memo sparingly and only after profiling; prefer `useMemo`/`useCallback` for expensive computations
- **Data Fetching**: TanStack React Query for server state; Supabase client for real-time subscriptions
- **Environment Variables**: Use `VITE_` prefix for client-side vars; validate with Zod at runtime
- **Commit Messages**: Conventional commits (e.g., `feat:`, `fix:`, `chore:`)
- **No Comments**: Do not add comments to code unless explicitly asked
