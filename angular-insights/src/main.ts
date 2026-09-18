import 'zone.js';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { LeadInsightsComponent } from './app/lead-insights.component';

bootstrapApplication(LeadInsightsComponent, {
  providers: [provideHttpClient()],
}).catch((error) => console.error(error));
