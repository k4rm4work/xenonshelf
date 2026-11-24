/** The library a read-only static build carries inside it; see `@library` in vite.config.ts. */
declare module '@library' {
  const library: import('./types').Library;
  export default library;
}
