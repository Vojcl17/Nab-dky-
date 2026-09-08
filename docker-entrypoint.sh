#!/bin/sh
set -e
echo "Aplikuji databázové migrace…"
node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
echo "Spouštím aplikaci na portu ${PORT:-3000}…"
exec node server.js
