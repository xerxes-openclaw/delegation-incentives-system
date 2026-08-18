import { z } from "zod";

const PortSchema = z.coerce.number().int().min(1).max(65_535);

const BackendEnvSchema = z.object({
  // Gasless delegation is opt-in. Leave both unset to run without a relayer;
  // the frontend then uses a direct on-chain delegate(address) call.
  BLOCKFUL_API_TOKEN: z.string().trim().min(1).optional(),
  GATEFUL_UPSTREAM_URL: z
    .string()
    .trim()
    .min(1)
    .url("GATEFUL_UPSTREAM_URL must be an absolute URL")
    .optional(),

  DATABASE_URL: z.string().trim().min(1).optional(),
  DATABASE_SCHEMA: z.string().trim().min(1).optional(),
  ALLOWED_ORIGINS: z.string().trim().optional(),
  ROUND_MONTHS: z.string().trim().optional(),
  GATEFUL_UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  BACKEND_PORT: PortSchema.optional(),
  PORT: PortSchema.optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  VITEST: z.string().optional(),
}).superRefine((env, ctx) => {
  // Half-configured relayer: the proxy would mount without a token, or hold a
  // token with nowhere to send it. Always a mistake, so fail the boot.
  const token = env.BLOCKFUL_API_TOKEN;
  const url = env.GATEFUL_UPSTREAM_URL;
  if (Boolean(token) === Boolean(url)) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [token ? "GATEFUL_UPSTREAM_URL" : "BLOCKFUL_API_TOKEN"],
    message:
      "Set both BLOCKFUL_API_TOKEN and GATEFUL_UPSTREAM_URL to enable gasless delegation, or neither to disable it",
  });
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
}

function parseBackendEnv(raw: NodeJS.ProcessEnv): BackendEnv {
  const result = BackendEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Backend environment validation failed:\n${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

export const env: BackendEnv = parseBackendEnv(process.env);
