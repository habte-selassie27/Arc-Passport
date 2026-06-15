import { QRCodeSVG } from "qrcode.react";
import { AddressDisplay } from "../shared/AddressDisplay";
import { ClaimBadge } from "./ClaimBadge";
import { ReputationMeter } from "./ReputationMeter";
import { ServiceBadge } from "./ServiceBadge";
import { SERVICE_LABELS, type PassportDocument, type ServiceKey, type ActiveClaim } from "../../types/passport";

interface PassportCardProps {
  passport: PassportDocument;
}

export function PassportCard({ passport }: PassportCardProps) {
  const qrValue = `${window.location.origin}/passport/${passport.address}`;

  const servicesList = Object.values(passport.services ?? {});
  const verifiedServices = servicesList.filter((s) => s.verified);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md mx-auto transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Digital Passport</h2>
        <div className="rounded-lg overflow-hidden shadow-sm">
          <QRCodeSVG value={qrValue} size={64} />
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
        <AddressDisplay address={passport.address} className="text-lg" />
      </div>

      {passport.identityId > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Identity Token</p>
          <p className="font-mono text-sm text-gray-900 dark:text-gray-100">#{passport.identityId}</p>
        </div>
      )}

      {passport.metadata && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {passport.metadata.name ?? "Unknown"}
          </p>
        </div>
      )}

      {servicesList.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Services ({verifiedServices.length} verified of {servicesList.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(passport.services) as ServiceKey[]).map((key) => {
              const svc = passport.services[key];
              return (
                <ServiceBadge
                  key={key}
                  name={key}
                  verified={svc.verified}
                  claimCount={svc.claimCount}
                />
              );
            })}
          </div>
        </div>
      )}

      {verifiedServices.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Active Credentials</p>
          <div className="space-y-2">
            {verifiedServices.map((svc) => (
              <div
                key={svc.service}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-2"
              >
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {SERVICE_LABELS[svc.service]}
                </p>
                <div className="flex flex-wrap gap-1">
                  {svc.claims.length > 0 ? (
                    svc.claims.map((c: ActiveClaim) => (
                      <ClaimBadge
                        key={c.claimId}
                        claim={c}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                      {svc.claimCount} on-chain
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Reputation</p>
        <ReputationMeter count={passport.reputation.length} />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Generated: {new Date(passport.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
