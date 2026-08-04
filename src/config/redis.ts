import Redis from "ioredis";

const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

export default redisConnection;
