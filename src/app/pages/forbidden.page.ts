import {Component} from "@angular/core";
import {RouterLink} from "@angular/router";
@Component({selector:"sf-forbidden",standalone:true,imports:[RouterLink],template:"<section class='content'><div class='card'><h1>Access denied</h1><p>Your role cannot open this workspace. Server permissions remain authoritative.</p><a routerLink='/login'>Return to sign in →</a></div></section>"})
export class ForbiddenPage{}
