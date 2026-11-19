/**
 * Utility to sanitize objects before sending to Cloud Firestore.
 * Firestore will reject writes with 'Unsupported field value: undefined'
 * if any property or nested property is undefined.
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (item !== null && typeof item === 'object') {
            return cleanForFirestore(item);
          }
          return item;
        });
      } else {
        result[key] = cleanForFirestore(value);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
