import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, catchError, concatMap, from, map, switchMap, throwError, timeout, toArray } from 'rxjs';
import { ApiService } from './api.service';
import { toAppError } from './app-error';

export type UploadPurpose = 'completion-image' | 'procurement-document';

export interface UploadedFile {
  publicId: string;
  /** "image" or "raw" (documents); seefix-api needs it to find a document upload. */
  resourceType: string;
}

interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string | number>;
}

/**
 * Uploads files straight to Cloudinary (seefix-api issue #12): seefix-api signs the upload, the browser sends the
 * file to Cloudinary, and only the returned public IDs go to seefix-api. Files are sent as chosen (no resizing or
 * re-compression): image quality matters for the AI completion check.
 */
@Injectable({ providedIn: 'root' })
export class DirectUploadService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /** Uploads one file at a time and returns the results in the same order. */
  upload(purpose: UploadPurpose, files: File[]): Observable<UploadedFile[]> {
    return this.api.post<SignedUpload>('/api/uploads/sign', { purpose }).pipe(
      switchMap((signed) =>
        from(files).pipe(
          concatMap((file) => this.send(signed, file)),
          toArray(),
        ),
      ),
    );
  }

  private send(signed: SignedUpload, file: File): Observable<UploadedFile> {
    const form = new FormData();
    for (const [key, value] of Object.entries(signed.fields)) form.append(key, String(value));
    form.append('file', file, file.name);
    // Not a seefix-api URL, so the auth interceptor adds no token.
    return this.http.post<{ public_id: string; resource_type: string }>(signed.uploadUrl, form).pipe(
      timeout(environment.uploadTimeoutMs),
      map((result) => ({ publicId: result.public_id, resourceType: result.resource_type })),
      catchError((e: unknown) => throwError(() => toAppError(e))),
    );
  }
}
