# Import Worker-only modules lazily inside server-function handlers

A `createServerFn` is compiled twice — into the deployed Worker and as a browser
stub — so any browser-reachable module that statically imports a Worker-only
module causes client build resolution failures. See
[`AGENTS.md` § Worker import convention (critical)](../../AGENTS.md#worker-import-convention-critical)
for the concrete rule and current worker-only module list.

Tree-shaking currently hides some leaks, but relying on it breaks the moment
an import is referenced at module scope; the convention is therefore treated as
absolute.
