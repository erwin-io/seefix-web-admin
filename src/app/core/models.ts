export type Role = "REPORTER"|"ADMIN"|"MAINTENANCE_STAFF"|"MAINTENANCE_SUPERVISOR"|"PROCUREMENT"|"WORKER";
export interface User {id:string;role:Role;email:string;fullName:string;jobTitle?:string|null;}
export interface LoginResponse {user:User;accessToken:string;}
export interface ItemList<T> {items:T[];}
export type DataRow = Record<string, unknown>;
export const MAINTENANCE_ROLES:Role[]=["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR"];
export const PROCUREMENT_ROLES:Role[]=["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","PROCUREMENT"];
export const WORK_ORDER_ROLES:Role[]=["ADMIN","MAINTENANCE_STAFF","MAINTENANCE_SUPERVISOR","WORKER"];
