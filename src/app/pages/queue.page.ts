import {CommonModule} from "@angular/common";
import {Component,inject,OnInit,signal} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Api,errorText} from "../core/api";
import {DataRow,ItemList} from "../core/models";
type Kind="actions"|"reviews"|"reports"|"workOrders"|"procurement"|"users"|"notifications";
interface Config {label:string;endpoint:string;columns:string[];}
const CONFIG:Record<Kind,Config>={
 actions:{label:"Maintenance action center",endpoint:"/maintenance/action-center",columns:["ReportNo","ActionType","AssignedRole","PriorityScore"]},
 reviews:{label:"Maintenance review queue",endpoint:"/maintenance/review-queue",columns:["ReportNo","Status","PriorityScore","EffectiveUrgency"]},
 reports:{label:"Maintenance reports",endpoint:"/maintenance/reports?triage=all",columns:["reportNo","status","scopeDecision","priorityScore"]},
 workOrders:{label:"Work orders",endpoint:"/work-orders",columns:["workOrderNo","reportNo","status","responsibleLeadName"]},
 procurement:{label:"Procurement inbox",endpoint:"/procurement/inbox",columns:["HandoffNo","Status","RequestNo","LivePriorityScore"]},
 users:{label:"Admin users",endpoint:"/admin/users",columns:["fullName","email","role","isActive"]},
 notifications:{label:"Notifications",endpoint:"/notifications",columns:["title","message","isRead","createdAt"]}
};
@Component({selector:"sf-queue",standalone:true,imports:[CommonModule],templateUrl:"./queue.page.html"})
export class QueuePage implements OnInit{
 private readonly api=inject(Api);
 private readonly route=inject(ActivatedRoute);
 readonly config=CONFIG[(this.route.snapshot.data["kind"] as Kind)||"actions"];
 readonly items=signal<DataRow[]>([]);
 readonly loading=signal(true);
 readonly error=signal("");
 ngOnInit():void{this.refresh();}
 refresh():void{
  this.loading.set(true);this.error.set("");
  this.api.get<ItemList<DataRow>>(this.config.endpoint).subscribe({
   next:data=>{this.items.set(data.items);this.loading.set(false);},
   error:err=>{this.error.set(errorText(err));this.loading.set(false);}
  });
 }
 value(item:DataRow,key:string):unknown{
  const alternative=key.charAt(0)===key.charAt(0).toUpperCase()?key.charAt(0).toLowerCase()+key.slice(1):key.charAt(0).toUpperCase()+key.slice(1);
  return item[key]??item[alternative]??"—";
 }
}
