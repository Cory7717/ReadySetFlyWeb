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

const samplePayload = `{
  "source": "local-gdl90-bridge",
  "updatedAt": "2026-03-26T18:25:00Z",
  "ownship": {
    "lat": 30.1975,
    "lon": -97.6664,
    "altitudeFt": 4200,
    "speedKt": 138,
    "headingDeg": 087,
    "timestamp": 1774559100000
  },
  "traffic": [
    {
      "id": "A1B2C3",
      "callsign": "N123AB",
      "lat": 30.2411,
      "lon": -97.6102,
      "altitudeFt": 4700,
      "groundSpeedKt": 152,
      "headingDeg": 262,
      "verticalRateFpm": -300,
      "category": "GA",
      "onGround": false
    }
  ]
}`;

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

      <Card>
        <CardHeader>
          <CardTitle>Receiver Bridge Mode</CardTitle>
          <CardDescription>RSF can now poll a local JSON bridge when direct browser receiver ingest is not possible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>- Start the included bridge with `npm run receiver:bridge`.</div>
          <div>- In Live Flight Map, switch the source to `Receiver bridge`.</div>
          <div>- Point RSF to a local bridge URL such as `http://127.0.0.1:3005/rsf-live.json`.</div>
          <div>- The bridge should expose ownship and optional traffic in JSON form.</div>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs text-foreground">
            <code>{samplePayload}</code>
          </pre>
        </CardContent>
      </Card>

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
