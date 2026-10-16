import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '@app/core/http/api.service';
import { environment } from '../../../environments/environment';
import { ASK_TIMEOUT_MS, AssistantApi } from './assistant.api';

describe('AssistantApi ask timeout', () => {
  let http: HttpTestingController;
  let api: AssistantApi;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AssistantApi);
  });
  afterEach(() => vi.useRealTimers());

  it('waits longer than the API’s 35 s Agent wait, so a slow (cold-start) answer still arrives', async () => {
    expect(ASK_TIMEOUT_MS).toBeGreaterThan(35_000);
    expect(ASK_TIMEOUT_MS).toBeLessThan(60_000); // Vercel function limit
    const answer = api.ask('What needs my attention today?', null);
    const req = http.expectOne('/api/assistant/ask');
    vi.advanceTimersByTime(25_000); // past the old 20 s cut-off
    req.flush({ status: 'ANSWERED', answer: 'One report waits for review.', citedFactIds: ['queue:1'], navigation: [] });
    await expect(answer).resolves.toMatchObject({ status: 'ANSWERED' });
  });

  it('still gives up when the server never answers', async () => {
    const answer = api.ask('Is anything overdue?', null);
    http.expectOne('/api/assistant/ask');
    const done = expect(answer).rejects.toMatchObject({ kind: 'TIMEOUT' });
    vi.advanceTimersByTime(ASK_TIMEOUT_MS + 1);
    await done;
  });

  it('other requests keep the default timeout', async () => {
    const other = firstValueFrom(TestBed.inject(ApiService).post('/api/assistant/drafts', {}));
    http.expectOne('/api/assistant/drafts');
    const done = expect(other).rejects.toMatchObject({ kind: 'TIMEOUT' });
    vi.advanceTimersByTime(environment.requestTimeoutMs + 1);
    await done;
  });
});
