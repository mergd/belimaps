import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    developmentIndicator: "grayscale",
  },
  manifest: {
    name: "Beli Maps",
    description: "See friends' Beli scores on Google Maps place pages",
    version: "0.1.2",
    permissions: ["storage", "tabs"],
    host_permissions: [
      "https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app/*",
      "https://backoffice-service-t57o3dxfca-nn.a.run.app/*",
      "https://backoffice-service-recs-t57o3dxfca-nn.a.run.app/*",
      "https://www.google.com/maps/*",
      "https://maps.google.com/*",
      "https://fonts.googleapis.com/*",
      "https://fonts.gstatic.com/*",
    ],
    action: {
      default_title: "Beli Maps — Sign in",
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:;",
    },
  },
});
