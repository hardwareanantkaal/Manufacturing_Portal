import { requireClient, checkClaimEligibility } from "@/lib/tenant";
import { ConfirmClaimForm } from "./confirm-claim-form";
import { ShieldCheck, ShieldX } from "lucide-react";

const FAILURE_MESSAGES: Record<string, string> = {
  not_found: "This device could not be found. Double-check the QR code or link.",
  wrong_token: "This claim link is invalid. It may have been altered or copied incorrectly.",
  already_claimed: "This device has already been claimed. A claim link only works once.",
  wrong_client:
    "This device is not registered to your account. If you believe this is a mistake, contact Anantkaal support.",
};

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ mac: string; token: string }>;
}) {
  const { clientId } = await requireClient();
  const { mac, token } = await params;

  const result = await checkClaimEligibility(clientId, mac, token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-4 text-center">
        {result.ok ? (
          <>
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Claim This Device</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Confirm this device belongs to your fleet.
              </p>
            </div>
            <div className="w-full rounded-md bg-slate-50 border border-border p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Serial Number
              </p>
              <p className="font-mono text-lg font-semibold text-foreground">
                {result.device.serial}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-2">
                Product
              </p>
              <p className="text-sm font-medium text-foreground">{result.device.product.name}</p>
            </div>
            <ConfirmClaimForm mac={mac} token={token} />
          </>
        ) : (
          <>
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 text-rose-600">
              <ShieldX size={24} />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Can&apos;t Claim This Device</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {FAILURE_MESSAGES[result.reason]}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
