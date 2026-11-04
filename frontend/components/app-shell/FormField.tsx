"use client";

import { useId, forwardRef, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "search" | "url";
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  id?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, type = "text", error, hint, required, disabled, leftIcon, rightIcon, className, id: providedId, children: _children, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
      <div className={`form-field ${error ? "has-error" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}>
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </label>
        <div className="field-input-wrapper">
          {leftIcon && <span className="field-icon field-icon-left" aria-hidden="true">{leftIcon}</span>}
          <input
            ref={ref}
            id={id}
            type={type}
            className="field-input"
            disabled={disabled}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />
          {rightIcon && <span className="field-icon field-icon-right" aria-hidden="true">{rightIcon}</span>}
        </div>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
      </div>
    );
  }
);

FormField.displayName = "FormField";

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, required, disabled, className, id: providedId, children: _children, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
      <div className={`form-field ${error ? "has-error" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}>
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </label>
        <textarea
          ref={ref}
          id={id}
          className="field-textarea"
          disabled={disabled}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...props}
        />
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
      </div>
    );
  }
);

TextareaField.displayName = "TextareaField";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, placeholder, error, hint, required, disabled, className, id: providedId, children: _children, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
      <div className={`form-field ${error ? "has-error" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}>
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </label>
        <select
          ref={ref}
          id={id}
          className="field-select"
          disabled={disabled}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
      </div>
    );
  }
);

SelectField.displayName = "SelectField";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function CheckboxField({ label, checked, onChange, error, hint, required, disabled, className }: CheckboxFieldProps) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const hintId = `${generatedId}-hint`;

  return (
    <div className={`form-field form-field-checkbox ${error ? "has-error" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}>
      <label className="checkbox-label">
        <input
          type="checkbox"
          id={generatedId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="checkbox-input"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        />
        <span className="checkbox-custom" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="checkbox-text">{label}</span>
        {required && <span className="required-indicator" aria-hidden="true">*</span>}
      </label>
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
    </div>
  );
}

interface RadioGroupProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
}

export function RadioGroup({ label, options, value, onChange, error, hint, required, disabled, className, inline }: RadioGroupProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const hintId = `${groupId}-hint`;

  return (
    <div className={`form-field form-field-radio ${error ? "has-error" : ""} ${disabled ? "disabled" : ""} ${className || ""}`}>
      <fieldset>
        <legend className="field-label">
          {label}
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </legend>
        <div className={`radio-group ${inline ? "inline" : ""}`} role="radiogroup" aria-labelledby={groupId} aria-invalid={error ? "true" : "false"} aria-describedby={error ? errorId : hint ? hintId : undefined}>
          {options.map((opt) => (
            <label key={opt.value} className="radio-label">
              <input
                type="radio"
                name={groupId}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="radio-input"
              />
              <span className="radio-custom" aria-hidden="true" />
              <span className="radio-text">{opt.label}</span>
            </label>
          ))}
        </div>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
      </fieldset>
    </div>
  );
}