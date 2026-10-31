# Isolated Vite environment directory

Vite's `envDir` points here using an absolute URL-derived path. This tracked directory
contains no environment files. Do not place secrets or private configuration here.
Root and application `.env*` files are not loaded by Vite. Public Firebase configuration
is not needed or consumed yet. A later configuration change must be deliberate;
never copy a private .env here. Explicit public process variables can be supplied
by the human when Firebase initialization is implemented.
