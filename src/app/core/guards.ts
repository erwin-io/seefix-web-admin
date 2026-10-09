import {inject} from "@angular/core";
import {CanActivateFn,Router} from "@angular/router";
import {catchError,map,of} from "rxjs";
import {Auth} from "./auth";
import {Role} from "./models";
import {Session} from "./session";
export const signedIn:CanActivateFn=()=>{
  const session=inject(Session),router=inject(Router);
  return session.token()?true:router.parseUrl("/login");
};
export const allowedRole:CanActivateFn=route=>{
  const auth=inject(Auth),router=inject(Router);
  const roles=(route.data["roles"] as Role[]|undefined)??[];
  return auth.ensureUser().pipe(
    map(user=>user.role!=="REPORTER"&&(!roles.length||roles.includes(user.role))?true:router.parseUrl("/forbidden")),
    catchError(()=>of(router.parseUrl("/login")))
  );
};
