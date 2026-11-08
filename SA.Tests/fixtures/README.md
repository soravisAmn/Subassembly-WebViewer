# Locked test fixtures

Frozen copies taken from git commit e1fa131 (end of round 4e). Tests compare against these files.
The files with the same names at the repository root are the user's working files: tests must never read them.
`round6/` holds the three MCP test files as they were on 2026-11-09, before the user added `Datum`, so tests have real gaps to catch.
These `.cs` files are excluded from the SA.Tests build (see `SA.Tests.csproj`).
