import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function findNonSerializable(obj: any, path: string = 'root'): { path: string; value: any } | null {
  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  // Check for non-plain objects, but allow arrays
  if (Object.prototype.toString.call(obj) !== '[object Object]' && !Array.isArray(obj)) {
    // Allow Date objects for now, as they are a common culprit but might be handled differently
    if (obj instanceof Date) {
        return { path, value: obj };
    }
    // Check if it's a class instance (other than Array or a few built-ins)
    if (obj.constructor !== Object) {
       return { path, value: obj };
    }
  }
  
  if (obj instanceof Date) {
    return { path, value: obj };
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newPath = Array.isArray(obj) ? `${path}[${key}]` : `${path}.${key}`;
      const value = obj[key];

      if (value !== null && typeof value === 'object') {
         if (value instanceof Date) {
          return { path: newPath, value: value };
        }

        const result = findNonSerializable(value, newPath);
        if (result) {
          return result;
        }
      } else if (typeof value === 'function') {
        return { path: newPath, value: value };
      }
    }
  }

  return null;
}
