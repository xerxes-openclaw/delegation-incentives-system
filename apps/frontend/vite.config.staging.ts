// Staging wrapper: same config, but accept requests from tunnel hosts
// (trycloudflare / tailscale) that Vite's host check would otherwise 403.
import baseConfig from './vite.config'
import { defineConfig, mergeConfig, type ConfigEnv, type UserConfig } from 'vite'

export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
  const base =
    typeof baseConfig === 'function' ? await baseConfig(env) : await baseConfig
  return mergeConfig(base, { server: { allowedHosts: true } })
})
