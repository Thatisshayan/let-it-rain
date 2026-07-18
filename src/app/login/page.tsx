"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandIcon, BrandLogo } from "@/components/app/brand";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="paper-grid editorial-surface hidden min-h-[38rem] rounded-[2rem] border-border/80 lg:flex lg:flex-col lg:justify-between">
          <CardHeader className="space-y-6 p-8">
            <div className="max-w-[32rem]">
              <BrandLogo priority />
            </div>
            <Badge variant="outline" className="w-fit border-primary/20 bg-primary/8 text-primary">
              Internal operations console
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-2xl font-heading text-5xl font-semibold leading-[0.94] tracking-[-0.06em]">
                Inventory trust starts with a calmer operating surface.
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-7 text-muted-foreground">
                Let It Rain is built for the daily operational rhythm: inventory visibility,
                dispatch coordination, movement history, and fast accounting snapshots.
              </CardDescription>
              <p className="serif-accent text-3xl leading-none text-primary/78">
                Read pressure early. Move deliberately.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-0 border-t border-border/75 sm:grid-cols-3">
            <div className="space-y-2 border-b border-border/75 p-6 sm:border-b-0 sm:border-r">
              <p className="rule-label">
                Inventory
              </p>
              <p className="text-lg font-semibold">Low-stock visibility</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Shortages surfaced before they turn into delivery problems.
              </p>
            </div>
            <div className="space-y-2 border-b border-border/75 p-6 sm:border-b-0 sm:border-r">
              <p className="rule-label">
                Orders
              </p>
              <p className="text-lg font-semibold">Driver workflow</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Assignment, dispatch, and delivery states in one controlled lane.
              </p>
            </div>
            <div className="space-y-2 p-6">
              <p className="rule-label">
                Reports
              </p>
              <p className="text-lg font-semibold">Daily cash picture</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Revenue, margin, and restock drag without accounting clutter.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="editorial-surface w-full rounded-[2rem] border-border/80 bg-card shadow-[0_30px_90px_-40px_rgba(31,41,55,0.22)]">
          <CardHeader className="items-center gap-4 border-b border-border/75 px-8 py-8 text-center">
            <div className="w-20 overflow-hidden rounded-[1.8rem] shadow-[0_18px_38px_-24px_rgba(7,35,94,0.42)]">
              <BrandIcon priority />
            </div>
            <div className="mx-auto max-w-[22rem]">
              <BrandLogo priority />
            </div>
            <CardTitle className="sr-only">Let It Rain</CardTitle>
            <CardDescription className="max-w-sm text-balance text-sm leading-6">
              Sign in to access inventory operations, dispatch status, activity history, and
              reporting for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 py-8">
            <form action={formAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <Button type="submit" className="h-11 w-full text-sm" disabled={pending}>
                {pending ? "Signing in..." : "Enter workspace"}
              </Button>
            </form>
            <div className="border-t border-border/75 pt-5">
              <p className="rule-label">Access model</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Administrative, reporting, and inventory actions are permission-scoped after sign-in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
