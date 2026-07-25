/** Host keys matching openapi/beli.yaml servers. */
export const HOSTS = {
  ONBOARD: "https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app",
  API: "https://backoffice-service-t57o3dxfca-nn.a.run.app",
  RECS: "https://backoffice-service-recs-t57o3dxfca-nn.a.run.app",
} as const;

export type HostKey = keyof typeof HOSTS;

export const META = {
  requiredHeaders: {
    Origin: "https://localhost",
    Referer: "https://localhost/",
  },
  userAgent:
    "Mozilla/5.0 (Linux; Android 16; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.91 Mobile Safari/537.36",
  minIntervalMs: 350,
  accessSkewMs: 60_000,
} as const;
