import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureDataUrl: string, signedByName: string) => void;
  isPending?: boolean;
  title?: string;
  description?: string;
};

export function SignatureDialog({
  open,
  onOpenChange,
  onSign,
  isPending = false,
  title = "Sign endorsement",
  description = "Draw on mobile/tablet or type a signature from desktop.",
}: SignatureDialogProps) {
  const [signedByName, setSignedByName] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.parentElement?.clientWidth || 600;
      canvas.width = width;
      canvas.height = 220;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open]);

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getDrawnDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const getTypedDataUrl = () => {
    if (!typedSignature.trim()) return "";
    const temp = document.createElement("canvas");
    temp.width = 800;
    temp.height = 200;
    const ctx = temp.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.fillStyle = "#111827";
    ctx.font = "48px 'Segoe Script', 'Pacifico', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typedSignature.trim(), 40, temp.height / 2);
    return temp.toDataURL("image/png");
  };

  const handleSign = () => {
    if (!signedByName.trim()) {
      alert("Please enter the signer name/title");
      return;
    }
    const dataUrl = mode === "draw" ? getDrawnDataUrl() : getTypedDataUrl();
    if (!dataUrl || (mode === "draw" && !hasDrawn)) {
      alert("Please add a signature first");
      return;
    }
    onSign(dataUrl, signedByName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[hsl(214_18%_76%_/_0.16)] bg-[linear-gradient(180deg,hsl(220_18%_16%_/_0.98),hsl(220_22%_9%_/_0.99))] text-[#E8EDF4] shadow-[0_28px_64px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="signedByName">Signer name & title</Label>
            <Input
              id="signedByName"
              value={signedByName}
              onChange={(event) => setSignedByName(event.target.value)}
              placeholder="e.g. Jane Smith, CFI"
            />
          </div>

          <div className="flex gap-2 text-sm">
            <Button type="button" variant={mode === "draw" ? "default" : "outline"} onClick={() => setMode("draw")}>
              Draw signature
            </Button>
            <Button type="button" variant={mode === "type" ? "default" : "outline"} onClick={() => setMode("type")}>
              Type signature
            </Button>
          </div>

          {mode === "draw" ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-md border border-[#5d6f85]/20 touch-none">
                <canvas
                  ref={canvasRef}
                  className="w-full h-52 bg-white"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={endDrawing}
                  onPointerLeave={endDrawing}
                />
              </div>
              <div className="flex gap-2 text-sm">
                <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                  Clear
                </Button>
                <p className="self-center text-xs text-muted-foreground">
                  Use finger/stylus on mobile or mouse on desktop.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="typedSignature">Type your name</Label>
              <Input
                id="typedSignature"
                value={typedSignature}
                onChange={(event) => setTypedSignature(event.target.value)}
                placeholder="e.g. Jane Smith"
              />
              <p className="text-xs text-muted-foreground">A styled signature image will be generated.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSign} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign & finalize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
