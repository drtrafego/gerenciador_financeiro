import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack/server";
import { Suspense } from "react";

export default function Handler(props: unknown) {
  return (
    <Suspense>
      <StackHandler fullPage app={stackServerApp} routeProps={props as any} />
    </Suspense>
  );
}
