import { ApplicationConfig, provideZonelessChangeDetection } from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { appRoutes } from "./app.routes";
import { authInterceptor } from "./core/auth.interceptor";
export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideRouter(appRoutes), provideHttpClient(withInterceptors([authInterceptor]))]
};
