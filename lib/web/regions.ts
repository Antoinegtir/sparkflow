/**
 * Sparkflow in the cloud, by region (Cloud Run): the Americas use the US one, everyone else Europe.
 * As a sharing host, each region is named like a Mac's server uid: cloud-eu, cloud-us.
 */
export const REGIONS = {
  us: (process.env.NEXT_PUBLIC_SPARKFLOW_CLOUD_URL_US ?? "https://sparkflow-705836289781.us-central1.run.app").replace(/\/+$/, ""),
  eu: (process.env.NEXT_PUBLIC_SPARKFLOW_CLOUD_URL ?? "https://sparkflow-705836289781.europe-west1.run.app").replace(/\/+$/, ""),
};

/** The cloud server behind a sharing host name, or null for a Mac's server uid. */
export const cloudHostUrl = (serverUid: string) => (serverUid === "cloud-eu" ? REGIONS.eu : serverUid === "cloud-us" ? REGIONS.us : null);
