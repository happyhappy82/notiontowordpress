import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

interface WpConfig {
  url: string;
  username: string;
  appPassword: string;
}

let config: WpConfig | null = null;

function getConfig(): WpConfig {
  if (!config) {
    const url = process.env.WP_URL;
    const username = process.env.WP_USERNAME;
    const appPassword = process.env.WP_APP_PASSWORD;

    if (!url || !username || !appPassword) {
      throw new Error("WP_URL, WP_USERNAME, and WP_APP_PASSWORD are required");
    }

    config = {
      url: url.replace(/\/$/, ""),
      username,
      appPassword,
    };
  }
  return config;
}

function getAuthHeader(): string {
  const { username, appPassword } = getConfig();
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

export async function wpFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { url } = getConfig();
  const fullUrl = `${url}/wp-json/wp/v2${endpoint}`;

  return withRetry(
    async () => {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          Authorization: getAuthHeader(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`WP API error ${response.status}: ${body}`);
      }

      return response.json() as Promise<T>;
    },
    { label: `WP ${options.method || "GET"} ${endpoint}` }
  );
}

export async function wpUpload(
  endpoint: string,
  body: Blob,
  filename: string,
  contentType: string
): Promise<Record<string, unknown>> {
  const { url } = getConfig();
  const fullUrl = `${url}/wp-json/wp/v2${endpoint}`;

  return withRetry(
    async () => {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Type": contentType,
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`WP upload error ${response.status}: ${text}`);
      }

      return response.json() as Promise<Record<string, unknown>>;
    },
    { label: `WP upload ${filename}` }
  );
}
