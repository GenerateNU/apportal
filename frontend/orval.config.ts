import { defineConfig } from 'orval'

// Generates a typed TanStack Query client from the backend's OpenAPI spec.
// Refresh the spec first with `make openapi` in ../backend, then run
// `npm run generate:api` here. Output lands in src/generated — it is committed
// but machine-generated, so edit the backend types and regenerate rather than
// editing it by hand (lint/format skip it; see eslint.config.mjs and
// .prettierignore).
export default defineConfig({
  apportal: {
    input: {
      target: '../backend/api/openapi.yaml',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated',
      schemas: './src/generated/model',
      client: 'react-query',
      mock: false,
      clean: true,
      prettier: true,
      indexFiles: true,
      override: {
        mutator: {
          path: './src/lib/api/orval-mutator.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: false,
          signal: true,
          version: 5,
        },
        operations: {
          'list-users': {
            query: {
              useInfinite: true,
              useInfiniteQueryParam: 'offset',
            },
          },
        },
      },
    },
  },
})
