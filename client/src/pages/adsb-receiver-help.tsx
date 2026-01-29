import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const receivers = [
  {
    name: "Stratux",
    steps: [
      "Power on the Stratux and wait for the Wi-Fi network to appear.",
      "Connect your device to the Stratux Wi-Fi.",
      "Use port 4000 (or 49002 if configured).",
      "Enable Live Traffic in the Flight Planner.",
    ],
  },
  {
    name: "Sentry / Stratus",
    steps: [
      "Connect to the device Wi-Fi.",
      "Confirm GDL-90 output is enabled (default for most).",
      "Use port 4000 if unsure.",
    ],
  },
  {
    name: "Garmin GDL",
    steps: [
      "Connect to the Garmin GDL Wi-Fi network.",
      "Confirm GDL-90 traffic is enabled.",
      "Use port 4000 or 49002 depending on configuration.",
    ],
  },
  {
    name: "uAvionix SkyEcho",
    steps: [
      "Connect to the SkyEcho Wi-Fi.",
      "Confirm traffic output is enabled.",
      "Use port 4000 unless configured otherwise.",
    ],
  },
];

export default function AdsbReceiverHelp() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ADS-B Receiver Setup</h1>
        <p className="text-muted-foreground">Connect your portable ADS-B receiver to view live traffic.</p>
      </div>

      <Alert>
        <AlertDescription>
          Live traffic is for situational awareness only. Always use official avionics and ATC guidance.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {receivers.map((receiver) => (
          <Card key={receiver.name}>
            <CardHeader>
              <CardTitle>{receiver.name}</CardTitle>
              <CardDescription>Quick setup steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {receiver.steps.map((step) => (
                <div key={step}>- {step}</div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
          <CardDescription>Common fixes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>- Confirm your device is connected to the receiver's Wi-Fi.</div>
          <div>- Try port 4000 or 49002.</div>
          <div>- Ensure GPS lock and ADS-B reception on the receiver.</div>
        </CardContent>
      </Card>
    </div>
  );
}
