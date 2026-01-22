
import { cn, filterNotifications } from '@/lib/utils';
import { type Employee, type Notification } from '@/types'; 
import { formSchema } from '@/components/add-employee-form';

/**
 * APP INTEGRITY TEST SUITE
 * This file verifies the fundamentals of the SmartHouse application logic.
 * It checks helper functions (utils) and the consistency of TypeScript types.
 */
describe('SmartHouse Core Logic Integrity', () => {

  // 1. Check UI utilities (Tailwind Merge)
  describe('Utils: cn (Classname Merger)', () => {
    it('correctly merges Tailwind classes', () => {
      const result = cn('p-4', 'bg-red-500');
      expect(result).toContain('p-4');
      expect(result).toContain('bg-red-500');
    });

    it('resolves class conflicts (overwrites styles)', () => {
      // In Tailwind, "p-8" should override "p-4"
      const result = cn('p-4', 'p-8');
      expect(result).toBe('p-8'); 
    });

    it('ignores conditional false/null/undefined', () => {
      const result = cn('flex', false && 'hidden', null, undefined, 'gap-2');
      expect(result).toBe('flex gap-2');
    });
  });

  // 2. Verify data structures (TypeScript Runtime Check)
  describe('Data Structures Integrity', () => {
    it('allows creating a valid mock Employee object', () => {
      // Create a sample object to check if the TS compiler is satisfied
      const mockEmployee: Employee = {
        id: 'emp-123',
        fullName: 'Kowalski Jan',
        firstName: 'Jan',
        lastName: 'Kowalski',
        coordinatorId: 'coord-1',
        status: 'active',
        checkInDate: '2024-01-01',
        nationality: 'Polska',
        gender: 'Mężczyzna',
        address: 'Testowa 1',
        roomNumber: '101',
        zaklad: 'IT',
        contractStartDate: null,
        contractEndDate: null,
        depositReturned: null,
        depositReturnAmount: null,
        deductionNo30Days: null,
        deductionNo4Months: null,
        deductionRegulation: null,
        deductionReason: undefined
      };

      expect(mockEmployee.id).toBe('emp-123');
      expect(mockEmployee.firstName).toBe('Jan');
      expect(mockEmployee.lastName).toBe('Kowalski');
      expect(mockEmployee.status).toBe('active');
    });
  });
  
  // 3. Test Business Logic Utilities
  describe('Utils: Notification Filtering', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const mockNotifications: Notification[] = [
      { id: '1', actorName: 'Admin', message: 'Test 1', createdAt: today.toISOString(), isRead: false, entityId: 'e1', entityFirstName: 'Jan', entityLastName: 'Kowalski', recipientId: 'coord-1', type: 'info', changes: [] },
      { id: '2', actorName: 'Admin', message: 'Test 2', createdAt: yesterday.toISOString(), isRead: false, entityId: 'e2', entityFirstName: 'Anna', entityLastName: 'Nowak', recipientId: 'coord-2', type: 'info', changes: [] },
      { id: '3', actorName: 'System', message: 'Test 3', createdAt: today.toISOString(), isRead: true, entityId: 'e3', entityFirstName: 'Piotr', entityLastName: 'Zalewski', recipientId: 'coord-1', type: 'warning', changes: [] },
      { id: '4', actorName: 'Admin', message: 'Test 4', createdAt: tomorrow.toISOString(), isRead: false, entityId: 'e4', entityFirstName: 'Jan', entityLastName: 'Iksinski', recipientId: 'coord-2', type: 'info', changes: [] },
    ];

    it('should return all notifications when no filters are applied', () => {
      const result = filterNotifications(mockNotifications, {});
      expect(result).toHaveLength(4);
    });

    it('should filter notifications by a specific date', () => {
      const result = filterNotifications(mockNotifications, { selectedDate: today });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });

    it('should return an empty array if no notifications match the date', () => {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);
        const result = filterNotifications(mockNotifications, { selectedDate: twoDaysAgo });
        expect(result).toHaveLength(0);
    });

    it('should filter by employee name (case-insensitive)', () => {
        const result = filterNotifications(mockNotifications, { employeeNameFilter: 'kowal' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('should filter by coordinator ID', () => {
        const result = filterNotifications(mockNotifications, { selectedCoordinatorId: 'coord-2' });
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('2');
        expect(result[1].id).toBe('4');
    });

    it('should combine date and name filters', () => {
        const result = filterNotifications(mockNotifications, { selectedDate: today, employeeNameFilter: 'piotr' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('3');
    });
  });

  // 4. Test Form Schemas Integrity
  describe('Form Schemas Integrity', () => {
    describe('AddEmployeeForm Schema', () => {
        const validData = {
            firstName: 'Jan',
            lastName: 'Kowalski',
            coordinatorId: 'coord-1',
            locality: 'Warszawa',
            address: 'Testowa 1',
            roomNumber: '101',
            zaklad: 'IT',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            checkInDate: new Date(),
        };

        it('should fail validation if checkInDate is null or undefined', () => {
            // Test with null
            const resultNull = formSchema.safeParse({
                ...validData,
                checkInDate: null,
            });
            
            expect(resultNull.success).toBe(false);
            if (!resultNull.success) {
                const checkInError = resultNull.error.issues.find(issue => issue.path.includes('checkInDate'));
                expect(checkInError).toBeDefined();
                expect(checkInError?.message).toBe('Data zameldowania jest wymagana.');
            }

            // Test with undefined
            const resultUndefined = formSchema.safeParse({
                 ...validData,
                checkInDate: undefined,
            });

            expect(resultUndefined.success).toBe(false);
            if (!resultUndefined.success) {
                const checkInError = resultUndefined.error.issues.find(issue => issue.path.includes('checkInDate'));
                expect(checkInError).toBeDefined();
                 expect(checkInError?.message).toBe('Data zameldowania jest wymagana.');
            }
        });

        it('should pass validation with a valid checkInDate', () => {
             const result = formSchema.safeParse(validData);
             expect(result.success).toBe(true);
        });
    });
  });
});
