import { useCallback, useEffect, useMemo, useState } from "react";

export type Validation<T> = { [K in keyof Partial<T>]?: boolean };
export type Rules<T> = {
  [K in keyof T]?: (
    value: T[K],
    state: T,
    optional: boolean,
  ) => boolean | undefined;
};

export type Values<T> = {
  [K in keyof T]: T[K];
};

export type FormConfig<R> = {
  /** List of optional properties. Optional properties will be marked as valid if left empty. */
  optional?: Array<keyof R>;
  /** Validation rules by specified property name. If you define a validation rule function here, the field will be validated against it. If no rule is set, a crude value check will be used instead (optional || Boolean(value)). Note: For complex value types (objects, arrays, dates etc) it is best to use a custom validation rule. */
  rules?: Rules<R>;
};

/** One-fits-all solution to manage state changes, field validation and optional entries within a form.
 * @example <caption>Simple use case:</caption>
 *  const { state, validation, update } = useForm({ email: '', password: '', });
 *
 *
 * @example <caption>For more complex form states (ie one field can be of multiple types), you should pass the form's type:</caption>
 * const { state, validation, update } = useForm<{ numericOrUndefined: number | undefined }>({ numericOrUndefined: undefined }, { rules: { numericOrUndefined: (value: number | undefined): boolean | undefined => ... }});
 *
 * Note: Avoid using class constructors for form state as it will continuously re-render the form. Every class construct is a new object, so the initial values parameter will always be different thus causing an infinite loop of re-renders. Use plain objects instead or memoize classes before passing them into the hook.
 */
export function useForm<T>(values: Values<T>, config?: FormConfig<T>) {
  const keys = useMemo(() => Object.keys(values) as Array<keyof T>, [values]);
  const [validation, setValidation] = useState<Validation<T>>({});
  const [initialState, setInitialState] = useState(values);
  const [state, setState] = useState(values);
  const { fieldValidation, stateValidation, isOptional } = useFormUtils(config);

  /** Rehydrate current state with new initial values if changed. */
  useEffect(() => {
    const changed = keys.filter((key) => values[key] !== initialState[key]);
    if (!changed.length) {
      return;
    }

    const updatedState = { ...state };
    // biome-ignore lint/complexity/noForEach: <explanation>
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    changed.forEach((key) => (updatedState[key] = values[key]));

    setInitialState({ ...values, ...updatedState });
    setState(updatedState);
  }, [values]);

  /** This function updates the specific property with a new value and validates it if it needs to do so.
   * @example <caption>Usage:</caption>
   * <TextInput ... onChange={(event) => update("nameOfProp", event.nativeEvent.text, false)} onBlur={(event) => update("nameOfProp", event.nativeEvent.text, true)}
   *  */
  function update<K extends keyof T>(
    key: K,
    value: Values<T>[K],
    shouldValidate?: boolean,
  ) {
    setState((s) => ({ ...s, [key]: value }));
    setValidation((s) => ({
      ...s,
      [key]: shouldValidate ? fieldValidation(key, value, state) : undefined,
    }));
  }

  function validate<K extends keyof T>(key: K) {
    setValidation((s) => ({
      ...s,
      [key]: fieldValidation(key, state[key], state),
    }));
  }

  /** Validate entire form, store validation state and return validation value.
   * In human readable terms, use this when you want to validate the form on submit.
   */
  const validateForm = useCallback(() => {
    const formValidationState = stateValidation(state);
    setValidation(formValidationState.validation);
    return formValidationState.valid;
  }, [state]);

  /** Boolean value of whether the form is valid (ie can be submitted). Use this to disable/enable form submission.
   * Only use when validating fields separately, has no value when valiating on form submit. */
  const isFormValid = useCallback(() => {
    return !keys.some((key) =>
      isOptional(key) ? validation[key] === false : !validation[key],
    );
  }, [validation, config]);

  /** Resets changed values to initial state */
  function resetState() {
    setState(values);
  }

  /** Re-initializes initial state from currently passed values. Use this if you need to reinitialize the form after the source values change, i.e. if a different state object comes into play after submitting the form (such as reducer data or API endpoint response data) */
  function resetInitialValues() {
    setInitialState(values);
  }

  /** Resets validation to initial state. */
  function resetValidation() {
    setValidation({});
  }

  /** Resets entire form, state and validation included */
  function clearForm() {
    resetInitialValues();
    resetState();
    resetValidation();
  }

  /** Whether form values have changed in any way from their initial state.  */
  const hasStateChanged = useCallback(() => {
    return keys.some((key) => {
      const value = state[key];
      const initialValue: typeof value = initialState[key];

      /** Check Date values. Dates are also object instances, but we can check their values easily. */
      if (value instanceof Date) {
        return initialValue instanceof Date ? +value !== +initialValue : true;
      }

      /** Check object values in a crude manner. Deep compares are expensive, this works but is sensitive to prop order. Could potentially provide a false positive if objects are the same, but values are ordered differently (ie two arrays, same values but at different indexes == different arrays.) */
      if (state[key] instanceof Object) {
        return JSON.stringify(state[key]) !== JSON.stringify(initialState[key]);
      }

      /** Primitive value check. */
      return value !== initialValue;
    });
  }, [state, initialState]);

  return {
    state,
    validation,
    update,
    validate,
    validateForm,
    isFormValid,
    hasStateChanged,
    clearForm,
    resetState,
    resetValidation,
    resetInitialValues,
  };
}

/** Helper hook to validate form state outside of the scope of useForm. */
export function useFormUtils<T>(config?: FormConfig<T>) {
  function doesValueExist(
    value: T[keyof T],
  ): value is Exclude<T[keyof T], null | undefined> {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === "string") {
      return value !== "";
    }

    if (typeof value === "number") {
      return value >= 0 || value < 0 || !Number.isNaN(value);
    }

    if (value instanceof Date) {
      return !Number.isNaN(value.valueOf());
    }

    return true;
  }

  const isOptional = useCallback(
    (key: keyof T) => config?.optional?.includes(key) || false,
    [config],
  );

  /** Validate by custom validation rule. If the rule does not exist, returns undefined. */
  const validateByRule = useCallback(
    <K extends keyof T>(key: K, value: T[K], state: Values<T>) => {
      return config?.rules?.[key]?.(value, state, isOptional(key));
    },
    [config],
  );

  /** Handles validation for a specific form field.
   * Order of priority:
   * 1. If there is a custom validation rule, always use that to preserve all possible type values
   * 2. If there is no value (is a falsy value), check if the field is optional
   * 3. Fallback to simple truthy value check if all other checks are not triggered. */
  function fieldValidation(key: keyof T, value: T[keyof T], state: Values<T>) {
    const hasValue = doesValueExist(value);
    const optional = isOptional(key);

    // If form has custom validation rule, always trigger only that.
    if (config?.rules?.[key]) {
      return validateByRule(key, value, state);
    }
    // If value does not exist (is null, undefined or other falsy value), check if field is optional.
    if (!hasValue) {
      return !!optional;
    }
    // Fallback, simple check if value exists
    return hasValue;
  }

  function stateValidation(state: Values<T>) {
    const keys = Object.keys(state).map((key) => key as keyof T);
    const validation: Validation<T> = {};

    // biome-ignore lint/complexity/noForEach: <explanation>
    keys.forEach((key) => {
      const value = state[key];
      // Force true / false values for entire form. Undefined has no value when submitting.
      validation[key] = fieldValidation(key, value, state) || false;
    });

    return {
      valid: !keys.some((key) => !validation[key]),
      validation,
    };
  }

  return {
    doesValueExist,
    validateByRule,
    isOptional,
    fieldValidation,
    stateValidation,
  };
}
