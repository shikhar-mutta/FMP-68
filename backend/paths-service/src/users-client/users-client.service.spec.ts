import { of, throwError } from 'rxjs';
import { UsersClientService } from './users-client.service';

const makeHttp = () => ({ get: jest.fn(), post: jest.fn() });

const makeConfig = (url?: string) => ({
  get: jest.fn().mockReturnValue(url),
});

describe('UsersClientService (paths-service)', () => {
  let http: ReturnType<typeof makeHttp>;
  let service: UsersClientService;

  beforeEach(() => {
    http = makeHttp();
    service = new UsersClientService(
      http as any,
      makeConfig('http://users:4002') as any,
    );
  });

  describe('findById', () => {
    it('returns the user from the upstream service', async () => {
      http.get.mockReturnValue(of({ data: { id: 'u1' } }));
      await expect(service.findById('u1')).resolves.toEqual({ id: 'u1' });
      expect(http.get).toHaveBeenCalledWith(
        'http://users:4002/internal/users/u1',
      );
    });

    it('returns null on upstream failure', async () => {
      http.get.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.findById('u1')).resolves.toBeNull();
    });
  });

  describe('findManyByIds', () => {
    it('returns an empty array immediately when no ids', async () => {
      await expect(service.findManyByIds([])).resolves.toEqual([]);
      expect(http.post).not.toHaveBeenCalled();
    });

    it('POSTs the ids and returns data', async () => {
      http.post.mockReturnValue(of({ data: [{ id: 'u1' }] }));
      await expect(service.findManyByIds(['u1'])).resolves.toEqual([
        { id: 'u1' },
      ]);
      expect(http.post).toHaveBeenCalledWith(
        'http://users:4002/internal/users/by-ids',
        { ids: ['u1'] },
      );
    });

    it('returns an empty array when data is null', async () => {
      http.post.mockReturnValue(of({ data: null }));
      await expect(service.findManyByIds(['u1'])).resolves.toEqual([]);
    });

    it('returns an empty array on upstream failure', async () => {
      http.post.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.findManyByIds(['u1'])).resolves.toEqual([]);
    });
  });

  describe('findFollowerProfilesByIds', () => {
    it('returns an empty array immediately when no ids', async () => {
      await expect(
        service.findFollowerProfilesByIds([]),
      ).resolves.toEqual([]);
      expect(http.post).not.toHaveBeenCalled();
    });

    it('POSTs the ids and returns data', async () => {
      http.post.mockReturnValue(of({ data: [{ id: 'u1', name: 'A' }] }));
      await expect(
        service.findFollowerProfilesByIds(['u1']),
      ).resolves.toEqual([{ id: 'u1', name: 'A' }]);
      expect(http.post).toHaveBeenCalledWith(
        'http://users:4002/internal/users/follower-profiles',
        { ids: ['u1'] },
      );
    });

    it('returns an empty array when data is null', async () => {
      http.post.mockReturnValue(of({ data: null }));
      await expect(
        service.findFollowerProfilesByIds(['u1']),
      ).resolves.toEqual([]);
    });

    it('returns an empty array on upstream failure', async () => {
      http.post.mockReturnValue(throwError(() => new Error('boom')));
      await expect(
        service.findFollowerProfilesByIds(['u1']),
      ).resolves.toEqual([]);
    });
  });

  it('falls back to localhost when USERS_SERVICE_URL is unset', async () => {
    const localService = new UsersClientService(
      http as any,
      makeConfig(undefined) as any,
    );
    http.get.mockReturnValue(of({ data: { id: 'u1' } }));
    await localService.findById('u1');
    expect(http.get).toHaveBeenCalledWith(
      'http://localhost:4002/internal/users/u1',
    );
  });

  describe('error coalescence (err?.message ?? err)', () => {
    it('handles non-Error throws in findById', async () => {
      http.get.mockReturnValue(throwError(() => 'string-thrown'));
      await expect(service.findById('u1')).resolves.toBeNull();
    });

    it('handles non-Error throws in findManyByIds', async () => {
      http.post.mockReturnValue(throwError(() => 'string-thrown'));
      await expect(service.findManyByIds(['u1'])).resolves.toEqual([]);
    });

    it('handles non-Error throws in findFollowerProfilesByIds', async () => {
      http.post.mockReturnValue(throwError(() => 'string-thrown'));
      await expect(
        service.findFollowerProfilesByIds(['u1']),
      ).resolves.toEqual([]);
    });
  });
});
