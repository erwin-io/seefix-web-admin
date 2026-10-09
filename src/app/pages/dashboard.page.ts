import {CommonModule} from "@angular/common";
import {Component,inject,OnInit,signal} from "@angular/core";
import {RouterLink} from "@angular/router";
import {forkJoin,map} from "rxjs";
import {Api,errorText} from "../core/api";
import {Auth} from "../core/auth";
import {DataRow,ItemList,Role} from "../core/models";
interface Metric {title:string;path:string;count:number;subtitle:string;}
@Component({selector:"sf-dashboard",standalone:true,imports:[CommonModule,RouterLink],templateUrl:"./dashboard.page.html"})
export class DashboardPage implements OnInit{
 private readonly api=inject(Api);
 readonly auth=inject(Auth);
 readonly metrics=signal<Metric[]>([]);
 readonly loading=signal(true);readonly error=signal("");
 ngOnInit():void{this.refresh();}
 refresh():void{
  this.loading.set(true);this.error.set("");
  const role=this.auth.session.user()?.role as Role;
  const definitions:{title:string;path:string;api:string;subtitle:string;}[]=[];
  if(["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR"].includes(role)){
   definitions.push({title:"Action items",path:"/maintenance/action-center",api:"/maintenance/action-center",subtitle:"Requires staff action"});
   definitions.push({title:"Review queue",path:"/maintenance/review-queue",api:"/maintenance/review-queue",subtitle:"Human triage pending"});
  }
  if(["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","WORKER"].includes(role)){
   definitions.push({title:"Work orders",path:"/work-orders",api:"/work-orders",subtitle:"Execution and progress"});
  }
  if(["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","PROCUREMENT"].includes(role)){
   definitions.push({title:"Procurement handoffs",path:"/procurement/inbox",api:"/procurement/inbox",subtitle:"External workflow status"});
  }
  if(role==="ADMIN")definitions.push({title:"User accounts",path:"/admin/users",api:"/admin/users",subtitle:"Registered identities"});
  forkJoin(definitions.map(d=>this.api.get<ItemList<DataRow>>(d.api).pipe(map(x=>({...d,count:x.items.length}))))).subscribe({
   next:data=>{this.metrics.set(data);this.loading.set(false);},
   error:err=>{this.error.set(errorText(err));this.loading.set(false);}
  });
 }
}
