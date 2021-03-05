### Transform streams

This is a folder for transport streams, which is exported as functions (see below).

```ts
interface ExampleTransform extends Transform {
	/** Can this class accept option changes on-the-fly? */
	static get Hotreloadable(): boolean;
}

export function createInput(options?: any): ExampleTransform;
export function createOutput(options?: any): ExampleTransform;
```