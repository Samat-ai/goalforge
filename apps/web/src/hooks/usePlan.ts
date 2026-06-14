import { useProfile } from "./useProfile"
import { useUser } from "@clerk/react"

export function usePlan() {
  const { user } = useUser()
  const { data: profile, isLoading } = useProfile(user?.id)
  const plan = (profile as any)?.plan ?? "free"
  return {
    plan,
    isPro: plan === "pro",
    isFree: plan === "free",
    isLoading,
  }
}
