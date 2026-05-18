import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new NotificationsService(prisma);
  });

  it('create stamps an expiresAt 30 minutes in the future', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    service.create('u1', 'p1', 'My Path');
    const args = prisma.notification.create.mock.calls[0][0];
    expect(args.data.userId).toBe('u1');
    expect(args.data.pathId).toBe('p1');
    expect(args.data.pathTitle).toBe('My Path');
    expect(args.data.type).toBe('follow_approved');
    expect(args.data.expiresAt.getTime()).toBe(now + 30 * 60 * 1000);
  });

  it('findForUser returns non-expired notifications ordered by createdAt desc', () => {
    service.findForUser('u1');
    const args = prisma.notification.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe('u1');
    expect(args.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('dismiss deletes only the matching notification for the owning user', () => {
    service.dismiss('n1', 'u1');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'u1' },
    });
  });
});

describe('NotificationsController', () => {
  let svc: jest.Mocked<NotificationsService>;
  let controller: NotificationsController;

  beforeEach(() => {
    svc = {
      findForUser: jest.fn(),
      dismiss: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;
    controller = new NotificationsController(svc);
  });

  it('getMyNotifications forwards the current user id', () => {
    controller.getMyNotifications('u1');
    expect(svc.findForUser).toHaveBeenCalledWith('u1');
  });

  it('dismiss forwards both the notification id and the current user id', () => {
    controller.dismiss('n1', 'u1');
    expect(svc.dismiss).toHaveBeenCalledWith('n1', 'u1');
  });
});
