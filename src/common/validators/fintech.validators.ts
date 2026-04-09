import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// ── Nigerian NUBAN account number validator ────────────────────────────────────
@ValidatorConstraint({ name: 'isNuban', async: false })
export class IsNubanConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    return typeof value === 'string' && /^\d{10}$/.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid 10-digit NUBAN account number`;
  }
}

export function IsNuban(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsNubanConstraint,
    });
  };
}

// ── Positive decimal (max 2dp) validator ──────────────────────────────────────
@ValidatorConstraint({ name: 'isPositiveDecimal', async: false })
export class IsPositiveDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'number') return false;
    if (value <= 0) return false;
    // max 2 decimal places
    return /^\d+(\.\d{1,2})?$/.test(String(value));
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a positive number with at most 2 decimal places`;
  }
}

export function IsPositiveDecimal(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsPositiveDecimalConstraint,
    });
  };
}

// ── Nigerian BVN validator ────────────────────────────────────────────────────
@ValidatorConstraint({ name: 'isBvn', async: false })
export class IsBvnConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    return typeof value === 'string' && /^\d{11}$/.test(value);
  }

  defaultMessage() {
    return 'BVN must be an 11-digit number';
  }
}

export function IsBvn(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsBvnConstraint,
    });
  };
}
