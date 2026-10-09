import {CommonModule} from "@angular/common";
import {Component,computed,inject} from "@angular/core";
import {RouterLink,RouterLinkActive,RouterOutlet} from "@angular/router";
import {Auth} from "../core/auth";
import {Role} from "../core/models";
interface NavItem {title:string;path:string;roles?:Role[];}
const NAV:NavItem[]=[
 {title:"Overview",path:"/dashboard"},
 {title:"Action center",path:"/maintenance/action-center",roles:["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR"]},
 {title:"Review queue",path:"/maintenance/review-queue",roles:["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR"]},
 {title:"Maintenance reports",path:"/maintenance/reports",roles:["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR"]},
 {title:"Work orders",path:"/work-orders",roles:["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","WORKER"]},
 {title:"Procurement",path:"/procurement/inbox",roles:["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","PROCUREMENT"]},
 {title:"Users",path:"/admin/users",roles:["ADMIN"]},
 {title:"Notifications",path:"/notifications"}
];
@Component({selector:"sf-shell",standalone:true,imports:[CommonModule,RouterLink,RouterLinkActive,RouterOutlet],templateUrl:"./shell.page.html"})
export class ShellPage{
 readonly auth=inject(Auth);
 readonly nav=computed(()=>NAV.filter(link=>!link.roles||!!this.auth.session.user()&&link.roles.includes(this.auth.session.user()!.role)));
}
