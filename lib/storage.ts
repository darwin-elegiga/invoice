import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

export const KV_KEYS = {
  bankInfo: "bank-info:colombia",
  invoices: "invoices:index",
} as const
