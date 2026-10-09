import {inject,Injectable} from "@angular/core";
import {Router} from "@angular/router";
import {map,of,tap} from "rxjs";
import {Api} from "./api";
import {LoginResponse,User} from "./models";
import {Session} from "./session";
@Injectable({providedIn:"root"})
export class Auth{
  readonly session=inject(Session);
  private readonly api=inject(Api);
  private readonly router=inject(Router);
  login(identifier:string,password:string){
    return this.api.post<LoginResponse>("/auth/login",{identifier,password}).pipe(
      tap(result=>this.session.save(result.accessToken,result.user)),
      map(result=>result.user)
    );
  }
  ensureUser(){
    const cached=this.session.user();
    if(cached)return of(cached);
    return this.api.get<{user:User}>("/auth/me").pipe(map(r=>r.user),tap(user=>this.session.user.set(user)));
  }
  logout():void{this.session.clear();void this.router.navigateByUrl("/login");}
}
