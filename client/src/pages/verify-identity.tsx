import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Upload, CreditCard, Plane, CheckCircle2, AlertCircle } from "lucide-react";

type VerificationStep = "identity" | "documents" | "payment" | "pilot";

interface VerificationFormData {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  governmentIdFront: File | null;
  governmentIdBack: File | null;
  faaCertificateNumber?: string;
  pilotCertificateName?: string;
  pilotCertificatePhoto?: File | null;
}

export default function VerifyIdentity() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<VerificationStep>("identity");
  const [formData, setFormData] = useState<VerificationFormData>({
    legalFirstName: "",
    legalLastName: "",
    dateOfBirth: "",
    governmentIdFront: null,
    governmentIdBack: null,
    faaCertificateNumber: "",
    pilotCertificateName: "",
    pilotCertificatePhoto: null,
  });

  const [previews, setPreviews] = useState<{
    idFront?: string;
    idBack?: string;
    pilot?: string;
  }>({});

  const steps: { id: VerificationStep; title: string; icon: any }[] = [
    { id: "identity", title: "Identity", icon: Shield },
    { id: "documents", title: "Documents", icon: Upload },
    { id: "payment", title: "Payment", icon: CreditCard },
    { id: "pilot", title: "FAA Pilot (Optional)", icon: Plane },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Use fetch directly for FormData (apiRequest doesn't support multipart/form-data)
      const response = await fetch("/api/verification-submissions", {
        method: "POST",
        body: data,
        credentials: "include", // Include session cookie
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Submission failed");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Verification Submitted",
        description: "Your verification is under review. We'll notify you once it's approved.",
      });
      setLocation("/profile");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit verification",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (field: keyof VerificationFormData, file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
    
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const previewKey = field === "governmentIdFront" ? "idFront"
          : field === "governmentIdBack" ? "idBack"
          : "pilot";
        setPreviews(prev => ({ ...prev, [previewKey]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (currentStep === "identity") {
      if (!formData.legalFirstName || !formData.legalLastName || !formData.dateOfBirth) {
        toast({
          title: "Missing Information",
          description: "Please fill out all required fields",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("documents");
    } else if (currentStep === "documents") {
      if (!formData.governmentIdFront || !formData.governmentIdBack) {
        toast({
          title: "Missing Documents",
          description: "Please upload all required documents",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("payment");
    } else if (currentStep === "payment") {
      setCurrentStep("pilot");
    }
  };

  const handleSubmit = async () => {
    const submitFormData = new FormData();
    
    submitFormData.append("type", "renter_identity");
    submitFormData.append("submissionData", JSON.stringify({
      legalFirstName: formData.legalFirstName,
      legalLastName: formData.legalLastName,
      dateOfBirth: formData.dateOfBirth,
      faaCertificateNumber: formData.faaCertificateNumber,
      pilotCertificateName: formData.pilotCertificateName,
    }));
    
    if (formData.governmentIdFront) {
      submitFormData.append("governmentIdFront", formData.governmentIdFront);
    }
    if (formData.governmentIdBack) {
      submitFormData.append("governmentIdBack", formData.governmentIdBack);
    }
    if (formData.pilotCertificatePhoto) {
      submitFormData.append("pilotCertificatePhoto", formData.pilotCertificatePhoto);
    }
    
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
          <p className="text-muted-foreground">
            Complete verification to list aircraft and book rentals
          </p>
        </div>

        {/* Progress Bar */}
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
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`hidden md:inline text-sm ${isActive ? "font-medium" : ""}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === "identity" && "Personal Information"}
              {currentStep === "documents" && "Upload Documents"}
              {currentStep === "payment" && "Payment Method"}
              {currentStep === "pilot" && "FAA Pilot Certificate (Optional)"}
            </CardTitle>
            <CardDescription>
              {currentStep === "identity" && "Enter your legal name and date of birth"}
              {currentStep === "documents" && "Upload clear photos of your government ID (front and back)"}
              {currentStep === "payment" && "Add a payment method for booking rentals"}
              {currentStep === "pilot" && "Upload your FAA pilot certificate for additional verification"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Identity */}
            {currentStep === "identity" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalFirstName">Legal First Name *</Label>
                    <Input
                      id="legalFirstName"
                      value={formData.legalFirstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, legalFirstName: e.target.value }))}
                      placeholder="John"
                      data-testid="input-legal-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalLastName">Legal Last Name *</Label>
                    <Input
                      id="legalLastName"
                      value={formData.legalLastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, legalLastName: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    data-testid="input-date-of-birth"
                  />
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your information must match your government-issued ID exactly.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Step 2: Documents */}
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
                    {previews.idFront && (
                      <img src={previews.idFront} alt="ID Front" className="mt-2 max-w-xs rounded-md border" />
                    )}
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
                    {previews.idBack && (
                      <img src={previews.idBack} alt="ID Back" className="mt-2 max-w-xs rounded-md border" />
                    )}
                  </div>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ensure all documents are clear and readable.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Step 3: Payment */}
            {currentStep === "payment" && (
              <>
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    Payment processing is handled securely through PayPal Business when you complete your first rental or listing transaction.
                  </AlertDescription>
                </Alert>
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Payment Method</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your payment method will be securely added via PayPal Business when you make your first rental or listing payment. All transactions are processed through our trusted payment partner.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Ready Set Fly uses PayPal Business for secure payment processing
                  </p>
                </div>
              </>
            )}

            {/* Step 4: FAA Pilot (Optional) */}
            {currentStep === "pilot" && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="faaCertNumber">FAA Certificate Number (Optional)</Label>
                    <Input
                      id="faaCertNumber"
                      value={formData.faaCertificateNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, faaCertificateNumber: e.target.value }))}
                      placeholder="1234567"
                      data-testid="input-faa-cert-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilotName">Name on Certificate (Optional)</Label>
                    <Input
                      id="pilotName"
                      value={formData.pilotCertificateName}
                      onChange={(e) => setFormData(prev => ({ ...prev, pilotCertificateName: e.target.value }))}
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
                    Adding your FAA pilot certificate is optional but helps verify your credentials for aircraft rentals.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Navigation */}
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
                <Button onClick={handleNext} data-testid="button-next">
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
