export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmDb } = await import("@/lib/db");
    warmDb();
  }
}
