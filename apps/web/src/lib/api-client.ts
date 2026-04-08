/**
 * Type-safe API client using openapi-fetch.
 *
 * This client provides full TypeScript inference for request params and
 * response shapes based on the OpenAPI spec. Use it for new code; existing
 * axios-based hooks can migrate incrementally.
 *
 * Usage:
 *   import { apiClient } from "@/lib/api-client"
 *
 *   const { data, error } = await apiClient.GET("/users/{user_id}/profile", {
 *     params: { path: { user_id: "user_123" } },
 *   })
 *   // data is typed as UserProfile — no casting needed
 */
import createClient from "openapi-fetch"
import type { paths } from "./api-types.generated"

export const apiClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
})

// Auth token injection — call this after Clerk provides a token
export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.use({
      onRequest({ request }) {
        request.headers.set("Authorization", `Bearer ${token}`)
        return request
      },
    })
  }
}
