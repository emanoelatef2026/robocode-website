/**
 * `Input` pinned to `type="email"` with the correct `autoComplete`/
 * `inputMode` defaults and built-in HTML5 email-format validation exposed
 * through the same `invalid`/`helperText` contract every field shares.
 */
import { forwardRef } from "react";
import { Input, type InputProps } from "../Input/Input";

export type EmailInputProps = Omit<InputProps, "type">;

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(function EmailInput(
  { autoComplete = "email", inputMode = "email", ...props },
  ref
) {
  return <Input {...props} ref={ref} type="email" autoComplete={autoComplete} inputMode={inputMode} />;
});
