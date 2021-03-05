### Protocol plugins

This is a folder for plugins, which is exported as functions (see below).

```ts
export function ClientPlugin(client: Client, options?: any): void;
export function ServerPlugin(server: Server, options?: any): void;
```