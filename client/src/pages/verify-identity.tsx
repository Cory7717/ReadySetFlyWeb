import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Upload, CreditCard, Plane, CheckCircle2, AlertCircle } from "lucide-react";

type VerificationStep = "identity" | "documents" | "credentials" | "payment" | "pilot";

interface VerificationFormData {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  governmentIdFront: File | null;
  governmentIdBack: File | null;
  medicalCertificateFile: File | null;
  pilotLicenseFile: File | null;
  medicalCertExpiresAt: string;
  pilotLicenseIssuedAt: string;
  renterInsuranceConfirmed: boolean;
  renterTermsAccepted: boolean;
  faaCertificateNumber?: string;
  pilotCertificateName?: string;
  pilotCertificatePhoto?: File | null;
}

export default function VerifyIdentity() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<VerificationStep>("identity");
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [formData, setFormData] = useState<VerificationFormData>({
    legalFirstName: "",
    legalLastName: "",
    dateOfBirth: "",
    governmentIdFront: null,
    governmentIdBack: null,
    medicalCertificateFile: null,
    pilotLicenseFile: null,
    medicalCertExpiresAt: "",
    pilotLicenseIssuedAt: "",
    renterInsuranceConfirmed: false,
    renterTermsAccepted: false,
    faaCertificateNumber: "",
    pilotCertificateName: "",
    pilotCertificatePhoto: null,
  });

  const [previews, setPreviews] = useState<{
    idFront?: string;
    idBack?: string;
    pilot?: string;
  }>({});

  // Analytics
  const startedRef = useRef(false);
  useEffect(() => {
    trackEvent("verification_page_viewed", { userId: user?.id });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const steps: { id: VerificationStep; title: string; icon: any }[] = [
    { id: "identity", title: "Identity", icon: Shield },
    { id: "documents", title: "Documents", icon: Upload },
    { id: "credentials", title: "Pilot Credentials", icon: Plane },
    { id: "payment", title: "Payment", icon: CreditCard },
    { id: "pilot", title: "FAA Pilot (Optional)", icon: Plane },
  ];

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/verification-submissions", {
        method: "POST",
        body: data,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Submission failed");
      }
      return response.json();
    },
    onSuccess: (_, formData) => {
      trackEvent("verification_submitted", { userId: user?.id });
      if (import.meta.env.DEV) console.log("[verification] submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Verification Submitted",
        description: "Your verification is under review. We'll notify you once it's approved.",
      });
      setLocation("/profile");
    },
    onError: (error: any) => {
      trackEvent("verification_submit_failed", { userId: user?.id, error: error.message });
      if (import.meta.env.DEV) console.log("[verification] submission failed:", error.message);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit verification",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (field: keyof VerificationFormData, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));

    if (!file) return;

    // Track each document selection as an upload event (upload to server happens on final submit)
    trackEvent("verification_document_uploaded", { userId: user?.id, documentType: field });
    if (import.meta.env.DEV) console.log(`[verification] document selected: ${field}`);

    if (field !== "governmentIdFront" && field !== "governmentIdBack" && field !== "pilotCertificatePhoto") return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const previewKey = field === "governmentIdFront" ? "idFront" : field === "governmentIdBack" ? "idBack" : "pilot";
      setPreviews((prev) => ({ ...prev, [previewKey]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (currentStep === "identity") {
      if (!formData.legalFirstName || !formData.legalLastName || !formData.dateOfBirth) {
        toast({
          title: "Missing Information",
          description: "Please fill out all required fields.",
          variant: "destructive",
        });
        return;
      }
      // Fire once — when the user commits to beginning the verification flow
      if (!startedRef.current) {
        startedRef.current = true;
        trackEvent("verification_started", { userId: user?.id });
        if (import.meta.env.DEV) console.log("[verification] started");
      }
      setCurrentStep("documents");
      return;
    }

    if (currentStep === "documents") {
      if (!formData.governmentIdFront || !formData.governmentIdBack) {
        toast({
          title: "Missing Documents",
          description: "Please upload both front and back government ID files.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("credentials");
      return;
    }

    if (currentStep === "credentials") {
      if (!formData.medicalCertificateFile || !formData.pilotLicenseFile) {
        toast({
          title: "Missing Credentials",
          description: "Please upload both FAA medical certificate and pilot license/certificate.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.medicalCertExpiresAt || !formData.pilotLicenseIssuedAt) {
        toast({
          title: "Missing Dates",
          description: "Please add medical certificate expiration and pilot license issue date.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.renterInsuranceConfirmed || !formData.renterTermsAccepted) {
        setCredentialsError("You must confirm renter insurance and renter terms before continuing.");
        toast({
          title: "Acknowledgement Required",
          description: "Please confirm renter insurance and renter terms.",
          variant: "destructive",
        });
        return;
      }
      setCredentialsError(null);
      setCurrentStep("payment");
      return;
    }

    if (currentStep === "payment") {
      setCurrentStep("pilot");
    }
  };

  const handleSubmit = () => {
    const submitFormData = new FormData();
    submitFormData.append("type", "renter_identity");
    submitFormData.append(
      "submissionData",
      JSON.stringify({
        legalFirstName: formData.legalFirstName,
        legalLastName: formData.legalLastName,
        dateOfBirth: formData.dateOfBirth,
        medicalCertExpiresAt: formData.medicalCertExpiresAt,
        pilotLicenseIssuedAt: formData.pilotLicenseIssuedAt,
        renterInsuranceConfirmed: formData.renterInsuranceConfirmed,
        renterTermsAccepted: formData.renterTermsAccepted,
        faaCertificateNumber: formData.faaCertificateNumber,
        pilotCertificateName: formData.pilotCertificateName,
      }),
    );

    if (formData.governmentIdFront) submitFormData.append("governmentIdFront", formData.governmentIdFront);
    if (formData.governmentIdBack) submitFormData.append("governmentIdBack", formData.governmentIdBack);
    if (formData.medicalCertificateFile) submitFormData.append("medicalCertificateFile", formData.medicalCertificateFile);
    if (formData.pilotLicenseFile) submitFormData.append("pilotLicenseFile", formData.pilotLicenseFile);
    if (formData.pilotCertificatePhoto) submitFormData.append("pilotCertificatePhoto", formData.pilotCertificatePhoto);

    submitFormData.append("medicalCertExpiresAt", formData.medicalCertExpiresAt);
    submitFormData.append("pilotLicenseIssuedAt", formData.pilotLicenseIssuedAt);

    submitMutation.mutate(submitFormData);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to verify your identity</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2" data-testid="text-verification-title">
            Identity Verification
          </h1>
          <p className="text-muted-foreground">Complete verification to list aircraft and book rentals</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStepIndex;
              const isComplete = index < currentStepIndex;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${
                      isComplete
                        ? "bg-primary border-primary text-primary-foreground"
                        : isActive
                          ? "border-primary text-primary"
                          : "border-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                  >
                    {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`hidden md:inline text-sm ${isActive ? "font-medium" : ""}`}>{step.title}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === "identity" && "Personal Information"}
              {currentStep === "documents" && "Upload Documents"}
              {currentStep === "credentials" && "Pilot Credentials"}
              {currentStep === "payment" && "Payment Method"}
              {currentStep === "pilot" && "FAA Pilot Certificate (Optional)"}
            </CardTitle>
            <CardDescription>
              {currentStep === "identity" && "Enter your legal name and date of birth"}
              {currentStep === "documents" && "Upload clear photos of your government ID (front and back)"}
              {currentStep === "credentials" && "Upload credentials and confirm renter insurance and renter terms"}
              {currentStep === "payment" && "Add a payment method for booking rentals"}
              {currentStep === "pilot" && "Upload your FAA pilot certificate for additional verification"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === "identity" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalFirstName">Legal First Name *</Label>
                    <Input
                      id="legalFirstName"
                      value={formData.legalFirstName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, legalFirstName: e.target.value }))}
                      placeholder="John"
                      data-testid="input-legal-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalLastName">Legal Last Name *</Label>
                    <Input
                      id="legalLastName"
                      value={formData.legalLastName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, legalLastName: e.target.value }))}
                      placeholder="Smith"
                      data-testid="input-legal-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    data-testid="input-date-of-birth"
                  />
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Your information must match your government-issued ID exactly.</AlertDescription>
                </Alert>
              </>
            )}

            {currentStep === "documents" && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="idFront">Government ID - Front *</Label>
                    <Input
                      id="idFront"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange("governmentIdFront", e.target.files?.[0] || null)}
                      data-testid="input-id-front"
                    />
                    {previews.idFront && <img src={previews.idFront} alt="ID Front" className="mt-2 max-w-xs rounded-md border" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idBack">Government ID - Back *</Label>
                    <Input
                      id="idBack"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange("governmentIdBack", e.target.files?.[0] || null)}
                      data-testid="input-id-back"
                    />
                    {previews.idBack && <img src={previews.idBack} alt="ID Back" className="mt-2 max-w-xs rounded-md border" />}
                  </div>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Ensure all documents are clear and readable.</AlertDescription>
                </Alert>
              </>
            )}

            {currentStep === "credentials" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medicalCertificateFile">FAA Medical Certificate *</Label>
                    <Input
                      id="medicalCertificateFile"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange("medicalCertificateFile", e.target.files?.[0] || null)}
                      data-testid="input-medical-certificate"
                    />
                    {formData.medicalCertificateFile && (
                      <p className="text-xs text-muted-foreground">Selected: {formData.medicalCertificateFile.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilotLicenseFile">Pilot License / Certificate *</Label>
                    <Input
                      id="pilotLicenseFile"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange("pilotLicenseFile", e.target.files?.[0] || null)}
                      data-testid="input-pilot-license"
                    />
                    {formData.pilotLicenseFile && (
                      <p className="text-xs text-muted-foreground">Selected: {formData.pilotLicenseFile.name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medicalCertExpiresAt">Medical Certificate Expiration Date *</Label>
                    <Input
                      id="medicalCertExpiresAt"
                      type="date"
                      value={formData.medicalCertExpiresAt}
                      onChange={(e) => setFormData((prev) => ({ ...prev, medicalCertExpiresAt: e.target.value }))}
                      data-testid="input-medical-expiration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilotLicenseIssuedAt">Pilot License Issue Date *</Label>
                    <Input
                      id="pilotLicenseIssuedAt"
                      type="date"
                      value={formData.pilotLicenseIssuedAt}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pilotLicenseIssuedAt: e.target.value }))}
                      data-testid="input-pilot-license-issued"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-start gap-2">
                    <input
                      id="checkbox-renter-insurance"
                      type="checkbox"
                      className="mt-1"
                      aria-label="Confirm renter insurance"
                      title="Confirm renter insurance"
                      checked={formData.renterInsuranceConfirmed}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, renterInsuranceConfirmed: e.target.checked }))
                      }
                      data-testid="checkbox-renter-insurance"
                    />
                    <Label htmlFor="checkbox-renter-insurance" className="font-normal leading-relaxed">
                      I confirm that I carry or will obtain non-owned aircraft renter&apos;s insurance prior to any
                      flight.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      id="checkbox-renter-terms"
                      type="checkbox"
                      className="mt-1"
                      aria-label="Accept renter terms"
                      title="Accept renter terms"
                      checked={formData.renterTermsAccepted}
                      onChange={(e) => setFormData((prev) => ({ ...prev, renterTermsAccepted: e.target.checked }))}
                      data-testid="checkbox-renter-terms"
                    />
                    <Label htmlFor="checkbox-renter-terms" className="font-normal leading-relaxed">
                      I agree to the ReadySetFly Renter Terms of Service and understand I am responsible for the
                      aircraft during the rental period.
                    </Label>
                  </div>
                </div>

                {credentialsError && (
                  <p className="text-sm text-destructive" data-testid="text-credentials-error">
                    {credentialsError}
                  </p>
                )}
              </>
            )}

            {currentStep === "payment" && (
              <>
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    Payment processing is handled securely through PayPal Business/Commerce, a trusted global payments
                    platform, when you complete your first rental or listing transaction.
                  </AlertDescription>
                </Alert>
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Payment Method</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your payment method will be securely added via PayPal Business/Commerce, a trusted global payments
                    platform, when you make your first rental or listing payment.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Ready Set Fly uses PayPal Business/Commerce for secure payment processing.
                  </p>
                </div>
              </>
            )}

            {currentStep === "pilot" && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="faaCertNumber">FAA Certificate Number (Optional)</Label>
                    <Input
                      id="faaCertNumber"
                      value={formData.faaCertificateNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, faaCertificateNumber: e.target.value }))}
                      placeholder="1234567"
                      data-testid="input-faa-cert-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilotName">Name on Certificate (Optional)</Label>
                    <Input
                      id="pilotName"
                      value={formData.pilotCertificateName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pilotCertificateName: e.target.value }))}
                      placeholder="John Smith"
                      data-testid="input-pilot-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilotPhoto">Pilot Certificate Photo (Optional)</Label>
                    <Input
                      id="pilotPhoto"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange("pilotCertificatePhoto", e.target.files?.[0] || null)}
                      data-testid="input-pilot-photo"
                    />
                    {previews.pilot && (
                      <img src={previews.pilot} alt="Pilot Certificate" className="mt-2 max-w-xs rounded-md border" />
                    )}
                  </div>
                </div>
                <Alert>
                  <Plane className="h-4 w-4" />
                  <AlertDescription>
                    Adding your FAA pilot certificate is optional but helps verify your credentials for aircraft
                    rentals.
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  const prevIndex = currentStepIndex - 1;
                  if (prevIndex >= 0) {
                    setCurrentStep(steps[prevIndex].id);
                  } else {
                    setLocation("/profile");
                  }
                }}
                data-testid="button-back"
              >
                {currentStepIndex === 0 ? "Cancel" : "Back"}
              </Button>

              {currentStep !== "pilot" ? (
                <Button
                  onClick={handleNext}
                  data-testid="button-next"
                  disabled={
                    currentStep === "credentials" &&
                    (!formData.renterInsuranceConfirmed || !formData.renterTermsAccepted)
                  }
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-verification"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
