import { z } from 'zod';

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().optional(),
    isAdmin: z.boolean().default(false),
    isDriver: z.boolean().default(false),
    isRekrutacja: z.boolean().default(false),
    isBok: z.boolean().default(false),
    canEditPastControlCards: z.boolean().default(false),
    departments: z.array(z.string()).default([]),
    visibilityMode: z.enum(['department', 'strict']).default('department'),
});

const values = {
    uid: `coord-${Date.now()}`,
    name: 'Test',
    password: '',
    isAdmin: false,
    isDriver: false,
    isRekrutacja: false,
    isBok: false,
    canEditPastControlCards: false,
    departments: [],
    visibilityMode: 'department'
};

const res = coordinatorSchema.safeParse(values);
console.log(res);
