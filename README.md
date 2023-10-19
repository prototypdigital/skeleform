# skeleform

Form management and validation toolkit originally a part of https://github.com/prototypdigital/skeletor

### Usage

Handle form value updates and validation with `useForm`. Full TypeScript support, ability to configure optional parameters, custom validation rules.

Flexible in its function, supports multiple validation approaches through callbacks:

1. For on-change validation, use `update("prop", value, true)`
2. To trigger standalone validation, use `validate("prop")`
3. Validate entire form with `validateForm()`

The order of importance when it comes to validating fields is:

1. Custom validation rule - will get the value as-is for your rule to validate it fully. The configuration rule receives the current value, state and optional flag values for you to validate against.
2. If there is no custom validation rule and the primitive value check returns false (there is no value), check if the field is optional. If optional, the validation result is `true`, otherwise it is `false`;
3. If all previous checks have not been triggered, return the primitive "has value" check result. This will return `false` for values such as: `null | undefined | NaN | "" | Invalid Date`. This will return `true` if you have a complex value type such as `object | Array`, <b>so in case you have a complex value type use a custom validation rule to get what you need</b>.

#### Example 1: Simple use case with standalone validation on blur:

```javascript
const {state, validation, update, validate} = useForm({email: "", password: "");

...
<input
  ...
  value={state.email}
	onChange={(e) =>  update("email", e.currentTarget.value)}
	onBlur={() => validate("email")}
/>
...
```

#### Example 2: Simple use case with on-change validation:

```javascript
// See example 1
...
onChange={(e) =>  update("email", e.currentTarget.value, true)}
...
```

#### Example 3: Simple use case with on-submit validation:

```javascript
// See example 1

function submit() {
	if(!validateForm()) {
		// Throw invalid error
		// validation object will be populated
	}
}

...
<input
  ...
	value={state.email}
	onUpdate={(e) =>  update("email", e.currentTarget.value)}
/>
<button onPress={submit}>Submit</button>
```

Validation has three possible values:

1. `undefined` = validation of the field value has not been done yet.
2. `false` = validation has failed, the state value is not considered valid.
3. `true` = validation has succeeded, the state value is considered valid.

What does that mean? Well, it means that when you have `validation.email === false`, you should show an error message on the field. `undefined | true` are not relevant for rendering, only functionally to block form submit events.

#### Example 4: Form configuration

```javascript
const { state, validation, update, validate } = useForm(
{ firstName: "", middleName: "", lastName: ""},
{
	// If left empty, validation.middleName will be true
	optional: ["middleName"],
	// validation.lastName is invalid if lastName is <3 characters long
	// state can be used to compare with other values (ie repeat password)
	rules: { lastName: (value, state, optional) => value.length >= 3,
}
```

#### Example 5: useFormUtils

Utility functions to help with standalone state validation, such as when re-validating a list of form values in a parent components.

```javascript
const { stateValidation } =  useFormUtils<Person>();

function validatePeople() {
	return people.every(person => stateValidation(person).valid);
}
```

Other utilities: `doesValueExist`, `validateByRule`, `isOptional`, `fieldValidation`, `stateValidation`. Some are meant for internal `useForm` usage, such as `fieldValidation` and `validateByRule`, but are not unusable.
