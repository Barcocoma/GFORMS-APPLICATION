type ViteEnv = {
  VITE_API_URL?: string;
};

const env = (import.meta as unknown as { env: ViteEnv }).env;

export const apiBase = env.VITE_API_URL?.replace(/\/+$/, "") ?? "";

export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return `${apiBase}${path}`;
}
