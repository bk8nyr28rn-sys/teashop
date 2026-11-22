import { AGE_FX, AGE_LIMITS, CFG, RULE_VERSION } from './base';
import { FIELD_CONFIG } from './field-config';
import { NIGHT_CONFIG } from './night-config';
import { FIRST_PERSON } from './state';
import { BANK_CAP, CLOCK } from './time';

// 模拟器和以后的页面共用这份参数。旧原型仍从原有的核心入口读取它自己的规则。
export const LOOP_CONFIG = {
  RULE_VERSION, CFG, AGE_FX, AGE_LIMITS, FIRST_PERSON, BANK_CAP, CLOCK, ...FIELD_CONFIG, ...NIGHT_CONFIG,
} as const;

export * from './base';
export * from './state';
export * from './time';
export * from './field';
export * from './field-config';
export * from './night';
export * from './night-config';
export * from './household';
export * from './economy';
export * from './settlement';
export * from './auto-defense';
export * from './absence';
