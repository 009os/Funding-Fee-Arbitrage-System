import { validate } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { Logger } from '@nestjs/common';

export const validateInput = async (
  inputDto: ClassConstructor<any>,
  input: any,
): Promise<void> => {
  const inputData = plainToInstance(inputDto, input);
  const errors = await validate(inputData);

  if (errors.length > 0) {
    Logger.error(errors);
    throw new Error('Input Validation failed');
  }
};
