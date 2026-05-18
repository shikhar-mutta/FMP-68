import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let host: ArgumentsHost;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: { method: string; url: string };
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    request = { method: 'GET', url: '/things/42' };
    host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown,
        getRequest: () => request as unknown,
      }),
    } as unknown as ArgumentsHost;

    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('maps HttpException → its status and string message', () => {
    const exception = new HttpException('Forbidden!', HttpStatus.FORBIDDEN);
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'HttpException',
        message: 'Forbidden!',
        path: '/things/42',
        timestamp: expect.any(String),
      }),
    );
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('extracts nested message from HttpException object response', () => {
    const exception = new HttpException(
      { message: ['email is required'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email is required'],
      }),
    );
  });

  it('falls back to full response object when message is missing', () => {
    const exception = new HttpException(
      { error: 'TeapotError' },
      HttpStatus.I_AM_A_TEAPOT,
    );
    filter.catch(exception, host);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.I_AM_A_TEAPOT,
        message: { error: 'TeapotError' },
      }),
    );
  });

  it('treats Error subclasses as 500 with their message + name', () => {
    class CustomError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'CustomError';
      }
    }
    const exception = new CustomError('boom');
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'CustomError',
        message: 'boom',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('uses generic fallback name when Error.name is missing', () => {
    const exception = new Error('plain');
    // simulate name-less Error
    Object.defineProperty(exception, 'name', { value: '' });
    filter.catch(exception, host);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Error', message: 'plain' }),
    );
  });

  it('handles non-Error throwables with InternalServerError defaults', () => {
    filter.catch('totally not an error', host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'Internal server error',
      }),
    );
  });
});
