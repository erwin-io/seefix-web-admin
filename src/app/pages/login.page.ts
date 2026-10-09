import {CommonModule} from "@angular/common";
import {Component,inject,signal} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {Router} from "@angular/router";
import {Auth} from "../core/auth";
import {errorText} from "../core/api";
@Component({selector:"sf-login",standalone:true,imports:[CommonModule,FormsModule],templateUrl:"./login.page.html"})
export class LoginPage{
  private readonly auth=inject(Auth);
  private readonly router=inject(Router);
  identifier="";password="";
  readonly busy=signal(false);readonly error=signal("");
  submit():void{
    if(!this.identifier.trim()||!this.password||this.busy())return;
    this.busy.set(true);this.error.set("");
    this.auth.login(this.identifier.trim(),this.password).subscribe({
      next:user=>{
        this.busy.set(false);
        if(user.role==="REPORTER"){this.auth.logout();this.error.set("Reporter accounts belong to the Reporter mobile app.");return;}
        void this.router.navigateByUrl("/dashboard");
      },
      error:err=>{this.busy.set(false);this.error.set(errorText(err));}
    });
  }
}
