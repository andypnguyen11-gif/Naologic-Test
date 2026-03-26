import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (typeof localStorage === 'undefined') {
    return next(request);
  }

  const raw = localStorage.getItem('naologic.auth');
  if (!raw) {
    return next(request);
  }

  try {
    const session = JSON.parse(raw) as { token?: string };
    if (!session.token) {
      return next(request);
    }

    return next(request.clone({
      setHeaders: {
        Authorization: `Bearer ${session.token}`
      }
    }));
  } catch {
    return next(request);
  }
};
