// Plain helpers shared between the onboarding Server Components, the
// onboarding Server Actions (src/lib/actions/onboarding.ts), and
// (app)/layout.tsx's own gate — kept out of the "use server" action
// file since a "use server" file may only export async functions.

export const ONBOARDING_STEP_ROUTES = [
  "/onboarding/horarios",
  "/onboarding/servicos",
  "/onboarding/profissionais",
  "/onboarding/concluido",
] as const;

/**
 * Where a company at this onboarding_step belongs. Step 3 (fully
 * onboarded) resolves to /onboarding/concluido — NOT directly to
 * /dashboard — on purpose: advanceOnboardingStep()'s own
 * revalidatePath("/onboarding/profissionais") makes Next.js re-render
 * that page's Server Component as part of the action's response, and
 * since its guard now sees onboarding_step === 3, it redirects via
 * this same function. Routing step 3 anywhere other than where the
 * client's own router.push(nextRoute) is ALSO about to go would race
 * the two navigations; pointing both at /onboarding/concluido makes
 * them agree, so the owner reliably sees the booking link instead of
 * the framework's own revalidation redirect winning first and
 * skipping straight to /dashboard. Any value past 3 still falls back
 * to /dashboard, kept as a safety net, not a real case.
 */
export function onboardingStepRoute(step: number): string {
  return ONBOARDING_STEP_ROUTES[step] ?? "/dashboard";
}
