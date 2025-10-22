import { CheckCircle2, Shield, CreditCard, Plane, Wrench, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { User, AircraftListing } from "@shared/schema";

interface VerificationBadgesProps {
  user?: User;
  aircraft?: AircraftListing;
  type: "renter" | "owner";
  size?: "sm" | "md" | "lg";
}

export function VerificationBadges({ user, aircraft, type, size = "md" }: VerificationBadgesProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const badgeSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  if (type === "renter" && user) {
    return (
      <div className="flex flex-wrap gap-2">
        {/* Identity Verified */}
        {user.identityVerified && (
          <Tooltip>
            <TooltipTrigger asChild data-testid="tooltip-identity-verified">
              <Badge variant="secondary" className={badgeSize} data-testid="badge-identity-verified">
                <Shield className={`${iconSize} mr-1`} />
                Identity Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Government ID and identity confirmed</p>
              {user.identityVerifiedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Verified {new Date(user.identityVerifiedAt).toLocaleDateString()}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Payment Verified */}
        {user.paymentVerified && (
          <Tooltip>
            <TooltipTrigger asChild data-testid="tooltip-payment-verified">
              <Badge variant="secondary" className={badgeSize} data-testid="badge-payment-verified">
                <CreditCard className={`${iconSize} mr-1`} />
                Payment Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Valid payment method on file</p>
              {user.paymentVerifiedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Verified {new Date(user.paymentVerifiedAt).toLocaleDateString()}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )}

        {/* FAA Pilot Verified */}
        {user.faaVerified && user.faaVerifiedMonth && (
          <Tooltip>
            <TooltipTrigger asChild data-testid="tooltip-faa-verified">
              <Badge variant="default" className={badgeSize} data-testid="badge-faa-verified">
                <CheckCircle2 className={`${iconSize} mr-1`} />
                FAA Verified ({user.faaVerifiedMonth})
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>FAA pilot certificate verified</p>
              {user.faaCertificateNumber && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cert #{user.faaCertificateNumber}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  if (type === "owner" && aircraft) {
    const isAnnualCurrent = aircraft.annualDueDate 
      ? new Date(aircraft.annualDueDate) > new Date()
      : false;
    const isAnnualOverdue = aircraft.annualDueDate
      ? new Date(aircraft.annualDueDate) < new Date()
      : false;

    return (
      <div className="flex flex-wrap gap-2">
        {/* Ownership Verified */}
        {aircraft.ownershipVerified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="default" className={badgeSize} data-testid="badge-ownership-verified">
                <Shield className={`${iconSize} mr-1`} />
                Ownership Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>FAA aircraft registration confirmed</p>
              <p className="text-xs text-muted-foreground mt-1">
                N-Number: {aircraft.registration}
              </p>
              {aircraft.ownerNameMatch && (
                <p className="text-xs text-green-500 mt-1">✓ Owner name matches registry</p>
              )}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Annual Inspection Status */}
        {aircraft.annualDueDate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={isAnnualCurrent ? "default" : "destructive"} 
                className={badgeSize}
                data-testid={isAnnualCurrent ? "badge-annual-current" : "badge-annual-overdue"}
              >
                <Wrench className={`${iconSize} mr-1`} />
                {isAnnualCurrent ? "Annual: Current" : "Annual: Overdue"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {isAnnualCurrent ? (
                <>
                  <p>Annual inspection current</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {new Date(aircraft.annualDueDate).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-destructive">Annual inspection overdue!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Was due: {new Date(aircraft.annualDueDate).toLocaleDateString()}
                  </p>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        )}

        {/* 100-Hour Status */}
        {aircraft.requires100Hour && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={
                  aircraft.hour100Remaining && aircraft.hour100Remaining > 0 
                    ? "secondary" 
                    : "destructive"
                } 
                className={badgeSize}
                data-testid="badge-100-hour"
              >
                <Plane className={`${iconSize} mr-1`} />
                {aircraft.hour100Remaining !== null && aircraft.hour100Remaining !== undefined
                  ? `100-Hr: ${aircraft.hour100Remaining} hrs left`
                  : "100-Hr: Update needed"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {aircraft.hour100Remaining && aircraft.hour100Remaining > 0 ? (
                <>
                  <p>100-hour inspection upcoming</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {aircraft.hour100Remaining} hours remaining
                  </p>
                </>
              ) : (
                <>
                  <p className="text-destructive">100-hour inspection may be due!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please update current tach time
                  </p>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        )}

        {!aircraft.requires100Hour && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={badgeSize} data-testid="badge-100-hour-na">
                <Plane className={`${iconSize} mr-1`} />
                100-Hr: N/A
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>100-hour inspection not required</p>
              <p className="text-xs text-muted-foreground mt-1">
                Aircraft not used for hire or instruction
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Maintenance Tracking (optional) */}
        {aircraft.hasMaintenanceTracking && aircraft.maintenanceTrackingProvider && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className={badgeSize} data-testid="badge-maintenance-tracking">
                <CheckCircle2 className={`${iconSize} mr-1`} />
                {aircraft.maintenanceTrackingProvider}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Professional maintenance tracking on file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Provider: {aircraft.maintenanceTrackingProvider}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Verification Warning if not verified */}
        {!aircraft.ownershipVerified && !aircraft.maintenanceVerified && (
          <Badge variant="outline" className={`${badgeSize} border-yellow-500 text-yellow-700 dark:text-yellow-400`} data-testid="badge-verification-pending">
            <AlertCircle className={`${iconSize} mr-1`} />
            Verification Pending
          </Badge>
        )}
      </div>
    );
  }

  return null;
}
