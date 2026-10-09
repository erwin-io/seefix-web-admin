import {Injectable,signal} from "@angular/core";
import {User} from "./models";
const KEY="seefix.webadmin.token";
@Injectable({providedIn:"root"})
export class Session{
  readonly token=signal<string|null>(this.saved());
  readonly user=signal<User|null>(null);
  private saved():string|null{try{return sessionStorage.getItem(KEY);}catch{return null;}}
  save(token:string,user:User):void{try{sessionStorage.setItem(KEY,token);}catch{}this.token.set(token);this.user.set(user);}
  clear():void{try{sessionStorage.removeItem(KEY);}catch{}this.token.set(null);this.user.set(null);}
}
