import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from './models';
import { Session } from './session';

/** Only same-app paths may be used after login (no open redirects). */
export function safeReturnUrl(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login')
    ? value
    : '/dashboard';
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session);
  const router = inject(Router);
  try {
    await session.ready();
  } catch {
    return router.createUrlTree(['/unavailable'], { queryParams: { returnUrl: state.url } });
  }
  return session.user() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = async () => {
  const session = inject(Session);
  await session.ready().catch(() => undefined);
  return session.user() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/** Route `data.roles` gate. Deep links outside the role land on Access denied. */
export const roleGuard: CanActivateFn = (route) => {
  const roles = route.data['roles'] as Role[] | undefined;
  return !roles || inject(Session).has(...roles) ? true : inject(Router).createUrlTree(['/denied']);
};
