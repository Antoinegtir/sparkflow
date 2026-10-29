import { z } from "zod";
import { maskedCredentials, readCredentials, saveCredentials, storeReadiness } from "@/lib/web/release";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Store credentials for fastlane, kept on this computer: IDs and paths, passwords only as set or not. */
export const GET = handle(async () => Response.json({ ...maskedCredentials(await readCredentials()), readiness: await storeReadiness() }));

const field = z.string().max(4096).optional();
export const PUT = handle(async (req: Request) => {
  const body = z
    .object({
      apple: z.object({ keyId: field, issuerId: field, keyPath: field, teamId: field }).optional(),
      google: z.object({ jsonKeyPath: field, keystorePath: field, keyAlias: field, storePassword: field, keyPassword: field }).optional(),
    })
    .parse(await req.json());
  return Response.json({ ...(await saveCredentials(body)), readiness: await storeReadiness() });
});
