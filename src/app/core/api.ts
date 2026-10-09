import {HttpClient,HttpErrorResponse} from "@angular/common/http";
import {inject,Injectable} from "@angular/core";
import {Observable} from "rxjs";
@Injectable({providedIn:"root"})
export class Api{
  private readonly http=inject(HttpClient);
  get<T>(path:string):Observable<T>{return this.http.get<T>("/api"+path);}
  post<T>(path:string,body:unknown={}):Observable<T>{return this.http.post<T>("/api"+path,body);}
  patch<T>(path:string,body:unknown):Observable<T>{return this.http.patch<T>("/api"+path,body);}
}
export function errorText(error:unknown):string{
  if(error instanceof HttpErrorResponse){
    const body=error.error as {error?:{message?:string};message?:string}|null;
    return body?.error?.message||body?.message||(error.status===0?"SEEFIX API is unreachable.":"Request failed (HTTP "+error.status+").");
  }
  return "An unexpected error occurred.";
}
