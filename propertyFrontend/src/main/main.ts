import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from 'src/app/shell/components/app/app.component';
import { apiTransportInterceptor } from 'src/app/core/api/interceptors/api-transport.interceptor';

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withInterceptors([apiTransportInterceptor]))]
}).catch((error) => {
  console.error(error);
});
