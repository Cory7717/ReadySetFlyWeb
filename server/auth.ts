// Convenience entrypoint: canonical `auth` module that re-exports the existing implementation.
// Keeps legacy file name `replitAuth.ts` intact while allowing other modules to import from `./auth`.
export * from "./replitAuth";
