import {Routes} from "@angular/router";
import {signedIn,allowedRole} from "./core/guards";
import {MAINTENANCE_ROLES,PROCUREMENT_ROLES,WORK_ORDER_ROLES} from "./core/models";
import {LoginPage} from "./pages/login.page";
import {ForbiddenPage} from "./pages/forbidden.page";
import {ShellPage} from "./pages/shell.page";
import {DashboardPage} from "./pages/dashboard.page";
import {QueuePage} from "./pages/queue.page";
export const appRoutes:Routes=[
 {path:"login",component:LoginPage},
 {path:"forbidden",component:ForbiddenPage},
 {path:"",component:ShellPage,canActivate:[signedIn,allowedRole],children:[
  {path:"",pathMatch:"full",redirectTo:"dashboard"},
  {path:"dashboard",component:DashboardPage},
  {path:"maintenance/action-center",component:QueuePage,data:{roles:MAINTENANCE_ROLES,kind:"actions"},canActivate:[allowedRole]},
  {path:"maintenance/review-queue",component:QueuePage,data:{roles:MAINTENANCE_ROLES,kind:"reviews"},canActivate:[allowedRole]},
  {path:"maintenance/reports",component:QueuePage,data:{roles:MAINTENANCE_ROLES,kind:"reports"},canActivate:[allowedRole]},
  {path:"work-orders",component:QueuePage,data:{roles:WORK_ORDER_ROLES,kind:"workOrders"},canActivate:[allowedRole]},
  {path:"procurement/inbox",component:QueuePage,data:{roles:PROCUREMENT_ROLES,kind:"procurement"},canActivate:[allowedRole]},
  {path:"admin/users",component:QueuePage,data:{roles:["ADMIN"],kind:"users"},canActivate:[allowedRole]},
  {path:"notifications",component:QueuePage,data:{kind:"notifications"}}
 ]},
 {path:"**",redirectTo:"dashboard"}
];
