"use client"

import { useEffect, useState } from "react"
import { DEFAULT_PROFILE, withProfileDefaults, type Profile } from "@/lib/profile"

/** Invoice template data from /api/profile; defaults until it loads. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProfile(withProfileDefaults(data)))
      .catch(() => {})
  }, [])
  return profile
}
