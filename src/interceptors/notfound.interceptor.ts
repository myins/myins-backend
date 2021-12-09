import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  NotFoundException,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class NotFoundInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    stream$: CallHandler,
  ): Observable<unknown> {
    return stream$.handle().pipe(
      tap((data) => {
        if (!data) {
          throw new NotFoundException(
            'The requested object could not be found 😢',
          );
        }
      }),
    );
  }
}
