import type { ReactNode } from "react";
import type { Demo2DMapSurfaceProps } from "@/components/demo/demoMapTypes";

export default function Demo2DMapSurface(props: Demo2DMapSurfaceProps & { children: ReactNode }) {
  return <>{props.children}</>;
}
