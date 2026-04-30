import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

export const KV_KEYS = {
  bankInfo: "bank-info",
  invoices: "invoices:index",
} as const
