import { cn } from '@/lib/utils';
import { type Employee } from '@/types'; 

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
});
