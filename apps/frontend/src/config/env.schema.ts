import { z } from 'zod'

const BooleanEnvSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['true', 'false']),
).transform((value) => value === 'true')

// Unset means "off". Used for optional feature flags so that adding one does
// not break existing .env files that predate it.
const OptionalBooleanEnvSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return 'false'
    return typeof value === 'string' ? value.trim().toLowerCase() : value
  },
  z.enum(['true', 'false']),
).transform((value) => value === 'true')

const PortEnvSchema = z.coerce.number().int().min(1).max(65_535)

const AbsoluteUrlSchema = z
  .string()
  .trim()
  .min(1)
  .url()
  .transform((value) => value.replace(/\/+$/, ''))

const ApiBaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      if (value.startsWith('/')) return true
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    { message: 'Expected an absolute URL or an absolute path such as /api' },
  )
  .transform((value) => {
    if (value === '/') return value
    return value.replace(/\/+$/, '')
  })

const PublicFrontendEnvSchema = z.object({
  VITE_API_BASE_URL: ApiBaseUrlSchema,
  VITE_USE_MOCK_API: BooleanEnvSchema,
  VITE_REOWN_PROJECT_ID: z.string().trim().min(1),
  // Gasless delegation via the Gateful relayer. Off unless explicitly enabled,
  // mirroring the backend, which only mounts the relayer proxy when both
  // BLOCKFUL_API_TOKEN and GATEFUL_UPSTREAM_URL are set.
  VITE_ENABLE_GASLESS: OptionalBooleanEnvSchema,
})

const FrontendDevServerEnvSchema = z.object({
  FRONTEND_PORT: PortEnvSchema.optional(),
  VITE_DEV_API_PROXY_TARGET: AbsoluteUrlSchema.optional(),
})

type PublicFrontendEnvRaw = z.infer<typeof PublicFrontendEnvSchema>
type FrontendDevServerEnvRaw = z.infer<typeof FrontendDevServerEnvSchema>

function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join('.') || 'environment'
      return `- ${key}: ${issue.message}`
    })
    .join('\n')
}

function parseWithSchema<T>(schema: z.ZodType<T>, rawEnv: Record<string, unknown>, label: string): T {
  const result = schema.safeParse(rawEnv)

  if (!result.success) {
    throw new Error(
      `${label} environment validation failed:\n${formatEnvError(result.error)}`,
    )
  }

  return result.data
}

export interface PublicFrontendEnv {
  apiBaseUrl: string
  useMockApi: boolean
  reownProjectId: string
  enableGasless: boolean
}

export interface FrontendDevServerEnv {
  frontendPort?: number
  devApiProxyTarget?: string
}

export function parsePublicFrontendEnv(rawEnv: Record<string, unknown>): PublicFrontendEnv {
  const env = parseWithSchema<PublicFrontendEnvRaw>(
    PublicFrontendEnvSchema,
    rawEnv,
    'Frontend public',
  )

  return {
    apiBaseUrl: env.VITE_API_BASE_URL,
    useMockApi: env.VITE_USE_MOCK_API,
    reownProjectId: env.VITE_REOWN_PROJECT_ID,
    enableGasless: env.VITE_ENABLE_GASLESS,
  }
}

export function parseFrontendBuildEnv(rawEnv: Record<string, unknown>): PublicFrontendEnv {
  return parsePublicFrontendEnv(rawEnv)
}

export function parseFrontendDevServerEnv(rawEnv: Record<string, unknown>): FrontendDevServerEnv {
  const env = parseWithSchema<FrontendDevServerEnvRaw>(
    FrontendDevServerEnvSchema,
    rawEnv,
    'Frontend dev server',
  )

  return {
    frontendPort: env.FRONTEND_PORT,
    devApiProxyTarget: env.VITE_DEV_API_PROXY_TARGET,
  }
}
