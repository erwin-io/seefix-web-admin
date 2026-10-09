import {HttpErrorResponse,HttpInterceptorFn} from "@angular/common/http";
import {inject} from "@angular/core";
import {Router} from "@angular/router";
import {catchError,throwError} from "rxjs";
import {Session} from "./session";
export const authInterceptor:HttpInterceptorFn=(request,next)=>{
  const session=inject(Session),router=inject(Router);
  const ownApi=request.url.startsWith("/api/");
  const token=session.token();
  const outgoing=ownApi&&token?request.clone({setHeaders:{Authorization:"Bearer "+token}}):request;
  return next(outgoing).pipe(catchError((error:unknown)=>{
    if(ownApi&&error instanceof HttpErrorResponse&&error.status===401&&!request.url.endsWith("/auth/login")
      &&error.error?.error?.code!=="CURRENT_PASSWORD_INCORRECT"){
      session.clear();void router.navigateByUrl("/login");
    }
    return throwError(()=>error);
  }));
};
